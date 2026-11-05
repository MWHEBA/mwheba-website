import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getPayload } from 'payload';
import { sql } from '@payloadcms/db-postgres';
import config from '../src/payload.config';
import { Inquiries } from '../src/modules/content/collections/Inquiries';
import { InquirySettings } from '../src/modules/content/globals/InquirySettings';
import { inquirySchema } from '../src/modules/content/lib/inquiryValidation';
import { submitInquiry } from '../src/modules/content/actions/submitInquiry';
import { resolveClientIp } from '../src/shared/lib/clientIp';
import {
  checkRateLimitPersistent,
  checkRateLimitInMemory,
  resetLocalRateLimitsForTesting,
} from '../src/modules/content/lib/inquiryRateLimiter';
import {
  dispatchInquiryNotification,
  retryFailedInquiryNotification,
  interpolateTemplate,
  MAX_EMAIL_RETRY_ATTEMPTS,
} from '../src/modules/content/lib/leadNotifications';
import { ContactInquiryForm } from '../src/modules/content/ui/ContactInquiryForm';
import ContactPage, { generateMetadata } from '../src/app/(frontend)/[locale]/contact/page';

// Mock next/headers for Server Action testing
let mockHeaders = new Headers();
vi.mock('next/headers', () => ({
  headers: vi.fn().mockImplementation(() => Promise.resolve(mockHeaders)),
}));

describe('CMS-05: Agency Lead Capture & Inquiries Engine', () => {
  let payloadInstance: any;

  beforeAll(async () => {
    payloadInstance = await getPayload({ config });
    await (payloadInstance.db as any).drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS "rate_limit_events" (
        "id" serial PRIMARY KEY NOT NULL,
        "key" varchar NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "rate_limit_events_key_created_idx" ON "rate_limit_events" ("key", "created_at");
    `);
  }, 30000);

  beforeEach(async () => {
    resetLocalRateLimitsForTesting();
    try {
      await (payloadInstance.db as any).drizzle.execute(sql`DELETE FROM "rate_limit_events";`);
    } catch {
      // Ignore if table not yet initialized
    }
    mockHeaders = new Headers();
    mockHeaders.set('x-forwarded-for', '192.168.1.100');
  });

  describe('Collection Schema & Global Settings Configuration', () => {
    it('defines Inquiries collection with required fields and public creation access', () => {
      expect(Inquiries.slug).toBe('inquiries');
      expect(typeof Inquiries.access?.create).toBe('function');
      expect((Inquiries.access?.create as any)()).toBe(true);

      const fieldNames = Inquiries.fields.map((f: any) => f.name);
      expect(fieldNames).toContain('fullName');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phone');
      expect(fieldNames).toContain('companyName');
      expect(fieldNames).toContain('serviceInterest');
      expect(fieldNames).toContain('estimatedBudget');
      expect(fieldNames).toContain('projectDetails');
      expect(fieldNames).toContain('status');
      expect(fieldNames).toContain('emailDeliveryStatus');
      expect(fieldNames).toContain('emailDeliveryError');
      expect(fieldNames).toContain('emailRecipient');

      const statusField: any = Inquiries.fields.find((f: any) => f.name === 'emailDeliveryStatus');
      const statusValues = statusField.options.map((o: any) => o.value);
      expect(statusValues).toContain('requires_manual_followup');
    });

    it('defines InquirySettings global with reviewable recipient and template fields', () => {
      expect(InquirySettings.slug).toBe('inquiry-settings');
      const globalFields = InquirySettings.fields.map((f: any) => f.name);
      expect(globalFields).toContain('recipientEmail');
      expect(globalFields).toContain('emailSubjectTemplate');
      expect(globalFields).toContain('emailBodyTemplate');
      expect(globalFields).toContain('enableRealDispatch');

      const recipientField: any = InquirySettings.fields.find((f: any) => f.name === 'recipientEmail');
      expect(recipientField.defaultValue).toBe('sales@mwheba.com');

      const dispatchField: any = InquirySettings.fields.find((f: any) => f.name === 'enableRealDispatch');
      expect(dispatchField.defaultValue).toBe(false); // Default is review mode
    });
  });

  describe('Trusted Proxy IP Resolution & Header Spoofing Defense', () => {
    it('defends against X-Forwarded-For spoofing by resolving from trusted proxy depth', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.1, 198.51.100.55');

      // With trustedProxyDepth = 1, it must resolve to 198.51.100.55 and NEVER spoofed 203.0.113.1
      const resolved = resolveClientIp(headers, { trustedProxyDepth: 1, trustCloudflare: false });
      expect(resolved).toBe('198.51.100.55');
    });

    it('rejects untrusted CF-Connecting-IP header unless explicitly configured', () => {
      const headers = new Headers();
      headers.set('cf-connecting-ip', '198.51.100.77');

      // When trustCloudflare is false (default), it must NOT blindly trust the header
      const resolvedUntrusted = resolveClientIp(headers, { trustCloudflare: false, trustedProxyDepth: 0 });
      expect(resolvedUntrusted).toBe('127.0.0.1');

      // Only when trustCloudflare is true, it honors the Cloudflare edge header
      const resolvedTrusted = resolveClientIp(headers, { trustCloudflare: true });
      expect(resolvedTrusted).toBe('198.51.100.77');
    });

    it('ignores X-Forwarded-For when trustedProxyDepth is 0 or unconfigured by default', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.199');

      // Explicit depth 0
      const resolvedExplicit = resolveClientIp(headers, { trustedProxyDepth: 0, trustCloudflare: false });
      expect(resolvedExplicit).toBe('127.0.0.1');

      // Default unconfigured (must default to depth 0 per security requirements)
      const resolvedDefault = resolveClientIp(headers);
      expect(resolvedDefault).toBe('127.0.0.1');
    });

    it('falls back to 127.0.0.1 when no proxy headers are present', () => {
      const headers = new Headers();
      expect(resolveClientIp(headers)).toBe('127.0.0.1');
    });
  });

  describe('Persistent Rate Limiter across Restarts and Multi-Process', () => {
    it('enforces rate limits persistently using PostgreSQL records across simulated process restart', async () => {
      const persistentTestIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;

      // 1. Submit 5 attempts recorded into PostgreSQL table rate_limit_events
      for (let i = 1; i <= 5; i++) {
        const attempt = await checkRateLimitPersistent(payloadInstance, persistentTestIp);
        expect(attempt.allowed).toBe(true);
      }

      // 2. SIMULATE PROCESS RESTART: wipe the in-memory fallback completely
      resetLocalRateLimitsForTesting();

      // 3. Check persistent rate limit on the new "process"
      const check = await checkRateLimitPersistent(payloadInstance, persistentTestIp);

      // Must be blocked because PostgreSQL persistently remembers the previous 5 attempts!
      expect(check.allowed).toBe(false);
      expect(check.remaining).toBe(0);
      expect(check.currentCount).toBe(6);

      // Different IP should still be allowed
      const checkOther = await checkRateLimitPersistent(payloadInstance, '198.51.100.99');
      expect(checkOther.allowed).toBe(true);
    });

    it('strictly prevents race conditions under high concurrency (10 concurrent requests from same IP)', async () => {
      const concurrentIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;

      // Simulate 10 simultaneous requests from the same IP hitting checkRateLimitPersistent concurrently
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          checkRateLimitPersistent(payloadInstance, concurrentIp)
        )
      );

      const allowed = results.filter((r) => r.allowed);
      const blocked = results.filter((r) => !r.allowed);

      // Exactly 5 allowed and exactly 5 blocked (atomic enforcement)
      expect(allowed.length).toBe(5);
      expect(blocked.length).toBe(5);
    });

    it('fails safely (fail-closed) when database is unavailable and rejects concurrent requests safely', async () => {
      // Simulate broken DB connection
      const brokenPayload = {
        db: {
          drizzle: {
            transaction: vi.fn().mockRejectedValue(new Error('PostgreSQL connection terminated unexpectedly')),
          },
        },
      } as any;

      const failingIp = '198.51.100.222';

      // 10 concurrent requests hitting rate limiter during DB failure
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          checkRateLimitPersistent(brokenPayload, failingIp)
        )
      );

      // All 10 must be safely rejected (allowed: false) without silent bypass
      expect(results.every((r) => r.allowed === false)).toBe(true);
      expect(results.every((r) => r.error === 'RATE_LIMIT_STORE_UNAVAILABLE')).toBe(true);
      expect(results.every((r) => r.remaining === 0)).toBe(true);
    });

    it('in-memory fallback limits synchronous requests correctly', () => {
      const testIp = '10.0.0.42';
      for (let i = 1; i <= 5; i++) {
        const check = checkRateLimitInMemory(testIp);
        expect(check.allowed).toBe(true);
      }
      const sixth = checkRateLimitInMemory(testIp);
      expect(sixth.allowed).toBe(false);
      expect(sixth.remaining).toBe(0);
    });
  });

  describe('Zod Validation Schema & Anti-Spam Honeypot', () => {
    it('validates correct inquiry inputs in Egyptian and international formats', () => {
      const validEg = {
        fullName: 'أحمد محمود',
        email: 'ahmed@company.com',
        phone: '01012345678',
        companyName: 'مجموعة النيل للتجارة',
        serviceInterest: 'branding',
        estimatedBudget: '150k_500k',
        projectDetails: 'نحتاج إعادة تصميم الهوية البصرية للشركة والكتيبات التسويقية.',
        locale: 'ar',
      };
      expect(inquirySchema.safeParse(validEg).success).toBe(true);

      const validIntl = {
        fullName: 'Sarah Jenkins',
        email: 'sarah@globaltech.com',
        phone: '+971 50 123 4567',
        serviceInterest: 'marketing',
        projectDetails: 'We are launching a new product line in the MENA region.',
        locale: 'en',
      };
      expect(inquirySchema.safeParse(validIntl).success).toBe(true);
    });

    it('rejects invalid email and invalid phone numbers', () => {
      const invalidEmail = {
        fullName: 'أحمد',
        email: 'not-an-email',
        phone: '01012345678',
        serviceInterest: 'branding',
        projectDetails: 'مشروع هوية تجارية متكامل للشركة.',
      };
      const resEmail = inquirySchema.safeParse(invalidEmail);
      expect(resEmail.success).toBe(false);

      const invalidPhone = {
        fullName: 'أحمد',
        email: 'ahmed@test.com',
        phone: 'abc-invalid',
        serviceInterest: 'branding',
        projectDetails: 'مشروع هوية تجارية متكامل للشركة.',
      };
      const resPhone = inquirySchema.safeParse(invalidPhone);
      expect(resPhone.success).toBe(false);
    });

    it('rejects too short project details (under 10 characters)', () => {
      const shortDetails = {
        fullName: 'أحمد',
        email: 'ahmed@test.com',
        phone: '01012345678',
        serviceInterest: 'branding',
        projectDetails: 'مرحبا',
      };
      const res = inquirySchema.safeParse(shortDetails);
      expect(res.success).toBe(false);
    });
  });

  describe('Template Interpolation & Review Mode Settings', () => {
    it('interpolates template tags correctly', () => {
      const template = 'Lead from {{fullName}} at {{companyName}} for {{serviceInterest}}';
      const result = interpolateTemplate(template, {
        fullName: 'كريم سامي',
        companyName: 'رواد الأعمال',
        serviceInterest: 'branding',
      });
      expect(result).toBe('Lead from كريم سامي at رواد الأعمال for branding');
    });

    it('records skipped_review_mode when enableRealDispatch is false', async () => {
      const doc = await payloadInstance.create({
        collection: 'inquiries',
        data: {
          fullName: 'عميل تجريبي في وضع المراجعة',
          email: 'review-lead@test.com',
          phone: '01234567890',
          serviceInterest: 'media',
          projectDetails: 'استفسار تجريبي للتحقق من وضع المراجعة للإشعارات.',
          status: 'new',
        },
      });

      try {
        const dispatchRes = await dispatchInquiryNotification(payloadInstance, {
          id: doc.id,
          fullName: doc.fullName,
          email: doc.email,
          phone: doc.phone,
          serviceInterest: doc.serviceInterest,
          projectDetails: doc.projectDetails,
        });

        expect(dispatchRes.status).toBe('skipped_review_mode');
        expect(dispatchRes.recipient).toBe('sales@mwheba.com');

        const updatedDoc = await payloadInstance.findByID({
          collection: 'inquiries',
          id: doc.id,
        });
        expect(updatedDoc.emailDeliveryStatus).toBe('skipped_review_mode');
        expect(updatedDoc.emailRecipient).toBe('sales@mwheba.com');
      } finally {
        await payloadInstance.delete({
          collection: 'inquiries',
          id: doc.id,
        });
      }
    });
  });

  describe('Retry Mechanism with Deduplication & Requires Manual Follow-up', () => {
    it('safely retains inquiry in database and flags delivery as failed when email dispatch fails', async () => {
      await payloadInstance.updateGlobal({
        slug: 'inquiry-settings',
        data: {
          recipientEmail: 'sales@mwheba.com',
          enableRealDispatch: true,
        },
      });

      const sendEmailSpy = vi.spyOn(payloadInstance, 'sendEmail').mockRejectedValueOnce(
        new Error('SMTP connection refused: mail.mwheba.com:587')
      );

      const doc = await payloadInstance.create({
        collection: 'inquiries',
        data: {
          fullName: 'عميل حقيقي مع فشل خادم البريد',
          email: 'resilient-lead@enterprise.com',
          phone: '01123456789',
          companyName: 'المؤسسة الوطنية للتوزيع',
          serviceInterest: 'merchandise',
          projectDetails: 'طلب توريد 1000 طقم هدايا مؤسسية تنفيذية بنهاية الربع الأول.',
          status: 'new',
        },
      });

      try {
        const dispatchRes = await dispatchInquiryNotification(payloadInstance, {
          id: doc.id,
          fullName: doc.fullName,
          email: doc.email,
          phone: doc.phone,
          companyName: doc.companyName,
          serviceInterest: doc.serviceInterest,
          projectDetails: doc.projectDetails,
        });

        expect(dispatchRes.status).toBe('failed');
        expect(dispatchRes.error).toContain('SMTP connection refused');

        const savedInquiry = await payloadInstance.findByID({
          collection: 'inquiries',
          id: doc.id,
        });

        expect(savedInquiry).toBeDefined();
        expect(savedInquiry.emailDeliveryStatus).toBe('failed');
        expect(savedInquiry.emailDeliveryAttempts).toBe(1);
      } finally {
        sendEmailSpy.mockRestore();
        await payloadInstance.updateGlobal({
          slug: 'inquiry-settings',
          data: {
            enableRealDispatch: false,
          },
        });
        await payloadInstance.delete({
          collection: 'inquiries',
          id: doc.id,
        });
      }
    });

    it('prevents duplicate sending when retrying already delivered inquiries', async () => {
      const doc = await payloadInstance.create({
        collection: 'inquiries',
        data: {
          fullName: 'عميل تم إرسال إشعاره بالفعل',
          email: 'sent-already@test.com',
          phone: '01099887766',
          serviceInterest: 'branding',
          projectDetails: 'استفسار تم إرسال إشعاره بنجاح في محاولة سابقة.',
          status: 'new',
          emailDeliveryStatus: 'sent',
          emailDeliveryAttempts: 1,
        },
      });

      try {
        const retryRes = await retryFailedInquiryNotification(payloadInstance, doc.id);
        expect(retryRes.status).toBe('already_sent');
      } finally {
        await payloadInstance.delete({
          collection: 'inquiries',
          id: doc.id,
        });
      }
    });

    it('transitions to requires_manual_followup after reaching max retry attempts', async () => {
      await payloadInstance.updateGlobal({
        slug: 'inquiry-settings',
        data: {
          enableRealDispatch: true,
        },
      });

      const sendEmailSpy = vi.spyOn(payloadInstance, 'sendEmail').mockRejectedValue(
        new Error('Permanent mail server rejection')
      );

      const doc = await payloadInstance.create({
        collection: 'inquiries',
        data: {
          fullName: 'استفسار متعدد الإخفاقات',
          email: 'hard-fail@test.com',
          phone: '01011112222',
          serviceInterest: 'general',
          projectDetails: 'استفسار فشل في المحاولات السابقة وسيتحول إلى المتابعة اليدوية.',
          status: 'new',
          emailDeliveryStatus: 'failed',
          emailDeliveryAttempts: MAX_EMAIL_RETRY_ATTEMPTS - 1, // 2 attempts
        },
      });

      try {
        // Attempt 3 (final attempt)
        const retryRes = await retryFailedInquiryNotification(payloadInstance, doc.id);

        expect(retryRes.status).toBe('requires_manual_followup');

        const updatedDoc = await payloadInstance.findByID({
          collection: 'inquiries',
          id: doc.id,
        });
        expect(updatedDoc.emailDeliveryStatus).toBe('requires_manual_followup');
        expect(updatedDoc.emailDeliveryAttempts).toBe(MAX_EMAIL_RETRY_ATTEMPTS);
      } finally {
        sendEmailSpy.mockRestore();
        await payloadInstance.updateGlobal({
          slug: 'inquiry-settings',
          data: {
            enableRealDispatch: false,
          },
        });
        await payloadInstance.delete({
          collection: 'inquiries',
          id: doc.id,
        });
      }
    });
  });

  describe('Server Action End-to-End Submission & Honeypot Interception', () => {
    it('successfully processes valid inquiry via Server Action and saves to database', async () => {
      mockHeaders.set('x-forwarded-for', '10.50.60.70');

      const actionResult = await submitInquiry({
        fullName: 'م. أحمد خالد',
        email: 'ahmed.khaled@corp.eg',
        phone: '01099887766',
        companyName: 'الشرق للأدوية',
        serviceInterest: 'branding',
        estimatedBudget: '50k_150k',
        projectDetails: 'تطوير الهوية التجارية لقطاع المستحضرات التجميلية الجديد.',
        locale: 'ar',
      });

      expect(actionResult.success).toBe(true);
      expect(actionResult.message).toContain('تم استلام استفسارك بنجاح');

      const found = await payloadInstance.find({
        collection: 'inquiries',
        where: {
          email: { equals: 'ahmed.khaled@corp.eg' },
        },
      });

      expect(found.docs.length).toBeGreaterThanOrEqual(1);
      const savedDoc = found.docs[0];
      expect(savedDoc.fullName).toBe('م. أحمد خالد');
      expect(savedDoc.status).toBe('new');

      await payloadInstance.delete({
        collection: 'inquiries',
        id: savedDoc.id,
      });
    });

    it('silently flags spam when honeypot field is filled', async () => {
      mockHeaders.set('x-forwarded-for', '10.50.60.71');

      const spamResult = await submitInquiry({
        fullName: 'Spam Bot 3000',
        email: 'bot@spamnetwork.com',
        phone: '01000000000',
        serviceInterest: 'marketing',
        projectDetails: 'Cheap marketing services buy now click link.',
        honeypot: 'http://malicious-spam-url.com',
        locale: 'ar',
      });

      expect(spamResult.success).toBe(true);

      const spamDocs = await payloadInstance.find({
        collection: 'inquiries',
        where: {
          email: { equals: 'bot@spamnetwork.com' },
        },
      });

      expect(spamDocs.docs.length).toBeGreaterThanOrEqual(1);
      const spamDoc = spamDocs.docs[0];
      expect(spamDoc.status).toBe('spam');
      expect(spamDoc.notes).toContain('honeypot');

      await payloadInstance.delete({
        collection: 'inquiries',
        id: spamDoc.id,
      });
    });

    it('gracefully returns maintenance message when rate limiter store is unavailable', async () => {
      // Mock checkRateLimitPersistent to simulate store failure
      const limiterModule = await import('../src/modules/content/lib/inquiryRateLimiter');
      const spy = vi.spyOn(limiterModule, 'checkRateLimitPersistent').mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        currentCount: 5,
        error: 'RATE_LIMIT_STORE_UNAVAILABLE',
      });

      const res = await submitInquiry({
        fullName: 'عميل الصيانة',
        email: 'client@maintenance.eg',
        phone: '01011223344',
        serviceInterest: 'branding',
        projectDetails: 'طلب مشروع جديد أثناء انقطاع قاعدة بيانات المعدل.',
        locale: 'ar',
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('أعمال الصيانة');

      spy.mockRestore();
    });
  });

  describe('UI Component & Page Rendering', () => {
    it('renders ContactInquiryForm in Arabic and English with accessible controls', () => {
      const arHtml = renderToString(<ContactInquiryForm locale="ar" />);
      expect(arHtml).toContain('الاسم الكامل *');
      expect(arHtml).toContain('البريد الإلكتروني المهني *');
      expect(arHtml).toContain('رقم الهاتف / الواتساب *');
      expect(arHtml).toContain('الخدمة الرئيسية المطلوبة *');
      expect(arHtml).toContain('إرسال طلب المشروع');

      const enHtml = renderToString(<ContactInquiryForm locale="en" />);
      expect(enHtml).toContain('Full Name *');
      expect(enHtml).toContain('Work Email *');
      expect(enHtml).toContain('Primary Service Needed *');
      expect(enHtml).toContain('Submit Project Inquiry');
    });

    it('generates localized metadata for contact page', async () => {
      const arMeta = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
      expect(arMeta.title).toContain('تواصل معنا');

      const enMeta = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
      expect(enMeta.title).toContain('Contact Us');
    });

    it('renders ContactPage component with direct agency coordinates and form', async () => {
      const pageJsx = await ContactPage({ params: Promise.resolve({ locale: 'ar' }) });
      const html = renderToString(pageJsx);

      expect(html).toContain('بيانات التواصل والمقر');
      expect(html).toContain('info@mwheba.com');
      expect(html).toContain('الإسكندرية');
      expect(html).toContain('نموذج تسجيل استفسار مشروع');
    });
  });
});

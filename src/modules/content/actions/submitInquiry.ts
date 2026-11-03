'use server';

import { headers } from 'next/headers';
import { getPayloadClient } from '../../../lib/payload';
import { checkRateLimitPersistent } from '../lib/inquiryRateLimiter';
import { dispatchInquiryNotification } from '../lib/leadNotifications';
import { inquirySchema, type InquiryInput } from '../lib/inquiryValidation';
import { resolveClientIp } from '../../../shared/lib/clientIp';
import { logger } from '../../../shared/lib/logger';

export type { InquiryInput };

export interface SubmitInquiryResult {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

export async function submitInquiry(rawInput: unknown): Promise<SubmitInquiryResult> {
  const reqHeaders = await headers();
  const trustedProxyDepth = Number(process.env.TRUSTED_PROXY_DEPTH || 0);
  const ip = resolveClientIp(reqHeaders, { trustedProxyDepth });
  const payload = await getPayloadClient();

  // 1. Persistent Rate Limit Enforcement (Backed by PostgreSQL)
  const rateLimit = await checkRateLimitPersistent(payload, ip);
  if (!rateLimit.allowed) {
    if (rateLimit.error === 'RATE_LIMIT_STORE_UNAVAILABLE') {
      logger.error('Inquiry submission rejected: persistent rate limit store unavailable', { ip });
      return {
        success: false,
        message: 'خدمة استقبال الاستفسارات غير متاحة مؤقتًا بسبب أعمال الصيانة. يرجى المحاولة بعد قليل أو التواصل عبر البريد مباشرة.',
      };
    }

    logger.warn('Inquiry submission rate limit exceeded', {
      ip,
      currentCount: rateLimit.currentCount,
    });
    return {
      success: false,
      message: 'تم تجاوز الحد المسموح به من الطلبات مؤقتًا. يرجى المحاولة بعد قليل.',
    };
  }

  // 2. Validate input schema
  const parsed = inquirySchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      message: 'بيانات النموذج غير مكتملة أو غير صحيحة.',
      errors: fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const isArabic = data.locale !== 'en';

  // 3. Spam Honeypot Defense
  if (data.honeypot && data.honeypot.trim().length > 0) {
    logger.warn('Spam submission intercepted via honeypot field', { ip, honeypotValue: data.honeypot });
    try {
      await payload.create({
        collection: 'inquiries',
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          companyName: data.companyName || undefined,
          serviceInterest: data.serviceInterest,
          estimatedBudget: data.estimatedBudget ? (data.estimatedBudget as any) : undefined,
          projectDetails: data.projectDetails,
          status: 'spam',
          ipAddress: ip,
          emailDeliveryStatus: 'skipped_review_mode',
          notes: 'Flagged as spam: honeypot field was filled.',
        },
      });
    } catch {
      // Ignore errors for spam record
    }

    return {
      success: true,
      message: isArabic
        ? 'تم استلام استفسارك بنجاح وسيتواصل معك فريق موهبة في أقرب وقت.'
        : 'Thank you. Your inquiry has been received and our team will contact you shortly.',
    };
  }

  // 4. Persist valid inquiry into database
  try {
    const inquiryDoc = await payload.create({
      collection: 'inquiries',
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName || undefined,
        serviceInterest: data.serviceInterest,
        estimatedBudget: data.estimatedBudget ? (data.estimatedBudget as any) : undefined,
        projectDetails: data.projectDetails,
        status: 'new',
        ipAddress: ip,
        emailDeliveryStatus: 'pending',
      },
    });

    // 5. Trigger notification dispatch
    await dispatchInquiryNotification(payload, {
      id: inquiryDoc.id,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      companyName: data.companyName,
      serviceInterest: data.serviceInterest,
      estimatedBudget: data.estimatedBudget,
      projectDetails: data.projectDetails,
    });

    return {
      success: true,
      message: isArabic
        ? 'تم استلام استفسارك بنجاح وسيتواصل معك مستشار المشروعات في وكالة موهبة خلال ساعات العمل.'
        : 'Thank you. Your inquiry has been received. Our senior project consultant will reach out shortly.',
    };
  } catch (dbError: any) {
    logger.error('Failed to persist client inquiry in database', { error: dbError.message, ip });
    return {
      success: false,
      message: isArabic
        ? 'عذرًا، حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى أو التواصل معنا عبر الهاتف مباشرة.'
        : 'An error occurred while submitting your inquiry. Please try again or reach out directly by phone.',
    };
  }
}

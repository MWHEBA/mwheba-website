import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { getBilingualNavigation } from '../src/modules/content/ui/Navigation';
import { GET as previewHandler } from '../src/app/api/preview/route';
import { GET as exitPreviewHandler } from '../src/app/api/exit-preview/route';
import DynamicCmsPage from '../src/app/(frontend)/[locale]/[...slug]/page';
import {
  generatePreviewToken,
  verifyPreviewToken,
} from '../src/modules/content/lib/previewTokens';
import { NextRequest } from 'next/server';

let mockDraftModeEnabled = true;

// Mock next/headers for isolated unit test execution of route handlers and RSC
vi.mock('next/headers', () => {
  return {
    draftMode: vi.fn().mockImplementation(() =>
      Promise.resolve({
        isEnabled: mockDraftModeEnabled,
        enable: vi.fn(),
        disable: vi.fn(),
      })
    ),
    headers: vi.fn().mockImplementation(() => Promise.resolve(new Headers())),
  };
});

// Mock next/navigation for notFound handling
vi.mock('next/navigation', () => {
  return {
    notFound: vi.fn().mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
  };
});

describe('CMS-02: Bilingual Dynamic Routing, Navigation & Hardened Draft Mode', () => {
  let payloadInstance: any;

  beforeAll(async () => {
    payloadInstance = await getPayload({ config });
  }, 30000);

  beforeEach(() => {
    mockDraftModeEnabled = true;
  });

  describe('Page-Specific HMAC Signed Preview Tokens', () => {
    it('generates a valid signed preview token bound to slug and locale', () => {
      const token = generatePreviewToken({ slug: 'strategic-consulting', locale: 'ar' });
      expect(token).toBeDefined();
      expect(token).toContain('.');

      const result = verifyPreviewToken(token, {
        expectedSlug: 'strategic-consulting',
        expectedLocale: 'ar',
      });
      expect(result.valid).toBe(true);
      expect(result.payload?.slug).toBe('strategic-consulting');
      expect(result.payload?.locale).toBe('ar');
    });

    it('rejects tampered tokens with invalid HMAC signature', () => {
      const token = generatePreviewToken({ slug: 'summer-campaign', locale: 'ar' });
      const [payload, sig] = token.split('.');
      const tamperedToken = `${payload}.${sig.slice(0, -3)}xyz`;

      const result = verifyPreviewToken(tamperedToken, {
        expectedSlug: 'summer-campaign',
        expectedLocale: 'ar',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });

    it('rejects cross-page reuse: token issued for page-a cannot be used for page-b', () => {
      const tokenPageA = generatePreviewToken({ slug: 'page-a', locale: 'ar' });

      // Attacker attempts to use page-a token to preview page-b
      const result = verifyPreviewToken(tokenPageA, {
        expectedSlug: 'page-b',
        expectedLocale: 'ar',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('PAGE_MISMATCH');
    });

    it('rejects cross-language reuse: token issued for Arabic cannot be used for English', () => {
      const tokenAr = generatePreviewToken({ slug: 'our-services', locale: 'ar' });

      const result = verifyPreviewToken(tokenAr, {
        expectedSlug: 'our-services',
        expectedLocale: 'en',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('LOCALE_MISMATCH');
    });

    it('rejects expired preview tokens', () => {
      // Generate token with negative TTL (already expired)
      const expiredToken = generatePreviewToken({
        slug: 'expired-promo',
        locale: 'ar',
        ttlSeconds: -10,
      });

      const result = verifyPreviewToken(expiredToken, {
        expectedSlug: 'expired-promo',
        expectedLocale: 'ar',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Dynamic Page Bilingual Resolution', () => {
    it('creates a published corporate page and resolves it in both Arabic and English', async () => {
      const pageSlug = `profile-${Date.now()}`;

      // 1. Create published page in Arabic
      const createdAr = await payloadInstance.create({
        collection: 'pages',
        locale: 'ar',
        data: {
          title: 'الملف التعريفي للوكالة',
          slug: pageSlug,
          _status: 'published',
          layout: [
            {
              blockType: 'hero',
              headline: 'ريادة التصميم والمنصات الرقمية',
              subtitle: 'نص وصفي عن الوكالة وتاريخها.',
            },
          ],
        },
      });

      expect(createdAr.id).toBeDefined();

      // 2. Add English version
      await payloadInstance.update({
        collection: 'pages',
        id: createdAr.id,
        locale: 'en',
        data: {
          title: 'Corporate Agency Profile',
          layout: [
            {
              blockType: 'hero',
              headline: 'Pioneering Design & Digital Platforms',
              subtitle: 'Corporate agency history and capabilities.',
            },
          ],
        },
      });

      // 3. Resolve for Arabic visitor
      const resAr = await payloadInstance.find({
        collection: 'pages',
        where: {
          and: [
            { slug: { equals: pageSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'ar',
        draft: false,
      });

      expect(resAr.docs).toHaveLength(1);
      expect(resAr.docs[0].title).toBe('الملف التعريفي للوكالة');
      expect(resAr.docs[0].layout[0].headline).toBe('ريادة التصميم والمنصات الرقمية');

      // 4. Resolve for English visitor
      const resEn = await payloadInstance.find({
        collection: 'pages',
        where: {
          and: [
            { slug: { equals: pageSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'en',
        draft: false,
      });

      expect(resEn.docs).toHaveLength(1);
      expect(resEn.docs[0].title).toBe('Corporate Agency Profile');
      expect(resEn.docs[0].layout[0].headline).toBe('Pioneering Design & Digital Platforms');

      // Clean up
      await payloadInstance.delete({
        collection: 'pages',
        id: createdAr.id,
      });
    });
  });

  describe('Draft Mode & Access Control Security', () => {
    it('strictly isolates unpublished drafts from public visitors while permitting authorized preview', async () => {
      const draftSlug = `draft-campaign-${Date.now()}`;

      // 1. Create an unpublished draft document (_status: 'draft')
      const draftDoc = await payloadInstance.create({
        collection: 'pages',
        locale: 'ar',
        data: {
          title: 'حملة تسويقية مسودة لم تنشر بعد',
          slug: draftSlug,
          _status: 'draft',
          layout: [
            {
              blockType: 'cta',
              title: 'عرض ترويجي سري حصري',
            },
          ],
        },
      });

      expect(draftDoc.id).toBeDefined();

      // 2. Public / Non-editor visitor query (draft: false, status: published)
      const publicQuery = await payloadInstance.find({
        collection: 'pages',
        where: {
          and: [
            { slug: { equals: draftSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'ar',
        draft: false,
      });

      // Crucial security gate: Public visitor MUST NOT see unpublished draft
      expect(publicQuery.docs).toHaveLength(0);

      // 3. Authorized Editor Draft query (draft: true)
      const editorDraftQuery = await payloadInstance.find({
        collection: 'pages',
        where: {
          slug: { equals: draftSlug },
        },
        locale: 'ar',
        draft: true,
      });

      // Authorized preview successfully loads draft
      expect(editorDraftQuery.docs).toHaveLength(1);
      expect(editorDraftQuery.docs[0].title).toBe('حملة تسويقية مسودة لم تنشر بعد');
      expect(editorDraftQuery.docs[0].layout[0].title).toBe('عرض ترويجي سري حصري');

      // Clean up
      await payloadInstance.delete({
        collection: 'pages',
        id: draftDoc.id,
      });
    });

    it('rejects preview requests without a page-specific token', async () => {
      const req = new NextRequest('http://localhost:3000/api/preview?slug=test&locale=ar');
      const res = await previewHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('MISSING_PREVIEW_TOKEN');
      expect(json.message).toContain('Missing page-specific preview token');
    });

    it('rejects preview requests when token is reused for a different slug (cross-page preview rejection)', async () => {
      const tokenForPageA = generatePreviewToken({ slug: 'landing-page-a', locale: 'ar' });
      // Attacker passes tokenForPageA but requests slug 'landing-page-b'
      const req = new NextRequest(
        `http://localhost:3000/api/preview?token=${tokenForPageA}&slug=landing-page-b&locale=ar`
      );
      const res = await previewHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('PREVIEW_TOKEN_MISMATCH');
      expect(json.message).toContain('Preview token was issued for a different page');
    });

    it('rejects preview when token is valid but editor is not logged in', async () => {
      const validToken = generatePreviewToken({ slug: 'summer-campaign', locale: 'ar' });
      // Mock unauthenticated visitor
      vi.spyOn(payloadInstance, 'auth').mockResolvedValueOnce({
        user: null,
        permissions: {} as any,
      });

      const unauthReq = new NextRequest(
        `http://localhost:3000/api/preview?token=${validToken}&slug=summer-campaign&locale=ar`
      );
      const res = await previewHandler(unauthReq);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED_PREVIEW');
      expect(json.message).toContain('Authentication required');
    });

    it('rejects preview with 403 Forbidden when user is logged in as non-editor (e.g. customer)', async () => {
      const validToken = generatePreviewToken({ slug: 'summer-campaign', locale: 'ar' });
      // Mock authenticated customer
      vi.spyOn(payloadInstance, 'auth').mockResolvedValueOnce({
        user: { id: 'cust_1', email: 'client@example.com', roles: ['customer'] } as any,
        permissions: {} as any,
      });

      const forbiddenReq = new NextRequest(
        `http://localhost:3000/api/preview?token=${validToken}&slug=summer-campaign&locale=ar`
      );
      const res = await previewHandler(forbiddenReq);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN_PREVIEW');
      expect(json.message).toContain('Forbidden. Only users with super_admin or marketer role');
    });

    it('accepts authorized preview with valid token and editor role (marketer), redirecting to localized draft route', async () => {
      const validToken = generatePreviewToken({ slug: 'summer-campaign', locale: 'ar' });
      // Mock authenticated editor with marketer role
      vi.spyOn(payloadInstance, 'auth').mockResolvedValueOnce({
        user: { id: 'usr_editor', email: 'editor@mwheba.com', roles: ['marketer'] } as any,
        permissions: {} as any,
      });

      const authorizedReq = new NextRequest(
        `http://localhost:3000/api/preview?token=${validToken}&slug=summer-campaign&locale=ar`
      );
      const res = await previewHandler(authorizedReq);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/ar/summer-campaign');
    });

    it('defense-in-depth: blocks draft rendering when editor logs out even if draft mode cookie remains in browser', async () => {
      const draftSlug = `logged-out-draft-${Date.now()}`;

      // 1. Create an unpublished draft document
      const draftDoc = await payloadInstance.create({
        collection: 'pages',
        locale: 'ar',
        data: {
          title: 'صفحة مسودة للمحررين فقط',
          slug: draftSlug,
          _status: 'draft',
          layout: [
            {
              blockType: 'hero',
              headline: 'عنوان مسودة سرية',
            },
          ],
        },
      });

      // 2. Scenario A: Editor is logged in with active draft mode -> successfully renders draft
      vi.spyOn(payloadInstance, 'auth').mockResolvedValueOnce({
        user: { id: 'usr_1', roles: ['marketer'] } as any,
        permissions: {} as any,
      });
      mockDraftModeEnabled = true;

      const pageComponentAuthorized = await DynamicCmsPage({
        params: Promise.resolve({ locale: 'ar', slug: [draftSlug] }),
      });
      const htmlAuthorized = renderToString(pageComponentAuthorized);
      expect(htmlAuthorized).toContain('عنوان مسودة سرية');
      expect(htmlAuthorized).toContain('وضع معاينة المسودة');

      // 3. Scenario B: Editor logged out! Session is expired/null, but draft cookie remains active (mockDraftModeEnabled = true)
      vi.spyOn(payloadInstance, 'auth').mockResolvedValueOnce({
        user: null,
        permissions: {} as any,
      });

      // Must throw NEXT_NOT_FOUND (404), completely blocking access to the draft!
      await expect(
        DynamicCmsPage({
          params: Promise.resolve({ locale: 'ar', slug: [draftSlug] }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // Clean up
      await payloadInstance.delete({
        collection: 'pages',
        id: draftDoc.id,
      });
    });

    it('handles exit preview and redirects to specified path', async () => {
      const exitReq = new NextRequest('http://localhost:3000/api/exit-preview?redirect=/ar/services');
      const res = await exitPreviewHandler(exitReq);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/ar/services');
    });
  });

  describe('Bilingual Navigation Global', () => {
    it('provides localized navigation items with sensible defaults when global is unseeded', async () => {
      const arNav = await getBilingualNavigation('ar');
      expect(arNav.headerMenu.length).toBeGreaterThan(0);
      expect(arNav.headerMenu.some((item) => item.label === 'الرئيسية')).toBe(true);
      expect(arNav.headerMenu.some((item) => item.href === '/ar/store')).toBe(true);

      const enNav = await getBilingualNavigation('en');
      expect(enNav.headerMenu.length).toBeGreaterThan(0);
      expect(enNav.headerMenu.some((item) => item.label === 'Home')).toBe(true);
      expect(enNav.headerMenu.some((item) => item.href === '/en/store')).toBe(true);
    });
  });
});

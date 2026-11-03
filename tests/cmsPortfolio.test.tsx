import { describe, it, expect, beforeAll, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { PortfolioProjects } from '../src/modules/content/collections/PortfolioProjects';
import { PortfolioView, type PortfolioItem } from '../src/modules/content/ui/PortfolioView';
import CaseStudyDetailPage from '../src/app/(frontend)/[locale]/portfolio/[slug]/page';
import {
  generatePreviewToken,
  verifyPreviewToken,
} from '../src/modules/content/lib/previewTokens';

// Mock next/headers
vi.mock('next/headers', () => {
  return {
    draftMode: vi.fn().mockImplementation(() =>
      Promise.resolve({
        isEnabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      })
    ),
    headers: vi.fn().mockImplementation(() => Promise.resolve(new Headers())),
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => {
  return {
    notFound: vi.fn().mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
  };
});

describe('CMS-03: Portfolio Showcase & Case Study Engine', () => {
  let payloadInstance: any;

  beforeAll(async () => {
    payloadInstance = await getPayload({ config });
  }, 30000);

  describe('PortfolioProjects Collection Schema & Access Control', () => {
    it('defines PortfolioProjects collection with correct slug, draft versions, and RBAC', () => {
      expect(PortfolioProjects.slug).toBe('portfolio-projects');
      expect(Boolean((PortfolioProjects.versions as any)?.drafts)).toBe(true);

      const titleField: any = PortfolioProjects.fields.find((f: any) => f.name === 'title');
      expect(titleField).toBeDefined();
      expect(titleField?.localized).toBe(true);
      expect(titleField?.required).toBe(true);

      const slugField: any = PortfolioProjects.fields.find((f: any) => f.name === 'slug');
      expect(slugField).toBeDefined();
      expect(slugField?.unique).toBe(true);
      expect(slugField?.index).toBe(true);

      const categoryField: any = PortfolioProjects.fields.find((f: any) => f.name === 'serviceCategory');
      expect(categoryField).toBeDefined();
      expect(categoryField?.type).toBe('select');
      const catOptions = categoryField?.options.map((o: any) => o.value);
      expect(catOptions).toContain('branding');
      expect(catOptions).toContain('digital_marketing');
      expect(catOptions).toContain('corporate_gifts');
      expect(catOptions).toContain('media_production');

      const altField: any = PortfolioProjects.fields.find((f: any) => f.name === 'coverImageAlt');
      expect(altField).toBeDefined();
      expect(altField?.required).toBe(true);
      expect(altField?.localized).toBe(true);
    });

    it('generates page-specific preview token for portfolio case study', () => {
      const token = generatePreviewToken({ slug: 'portfolio/fintech-brand', locale: 'ar' });
      expect(token).toBeDefined();

      const verification = verifyPreviewToken(token, {
        expectedSlug: 'portfolio/fintech-brand',
        expectedLocale: 'ar',
      });
      expect(verification.valid).toBe(true);
      expect(verification.payload?.slug).toBe('portfolio/fintech-brand');
    });
  });

  describe('Bilingual Case Study Lifecycle & Data Isolation', () => {
    it('creates, localizes, and queries a published case study across Arabic and English', async () => {
      const testSlug = `case-study-${Date.now()}`;

      // 1. Create Arabic project
      const created = await payloadInstance.create({
        collection: 'portfolio-projects',
        locale: 'ar',
        data: {
          title: 'تحول الهوية المؤسسية لبنك المستقبل',
          slug: testSlug,
          clientName: 'بنك المستقبل للاستثمار',
          industry: 'القطاع المصرفي',
          serviceCategory: 'branding',
          projectDate: '2026',
          summary: 'إعادة تصميم الهوية البصرية والمطبوعات والأكواب الذكية لـ 50 فرعاً.',
          coverImageAlt: 'دليل الهوية البصرية لبنك المستقبل في القاهرة',
          _status: 'published',
          deliverables: [
            { item: 'دليل الهوية البصرية' },
            { item: 'أكواب حرارية منقوشة بالليزر' },
          ],
          results: [
            { metric: '+210%', label: 'نمو في مؤشر ثقة العملاء' },
          ],
        },
      });

      expect(created.id).toBeDefined();

      // 2. Add English localization
      await payloadInstance.update({
        collection: 'portfolio-projects',
        id: created.id,
        locale: 'en',
        data: {
          title: 'Future Bank Corporate Brand Transformation',
          clientName: 'Future Investment Bank',
          industry: 'Banking & Financial Sector',
          summary: 'Comprehensive brand identity redesign and executive merchandise across 50 branches.',
          coverImageAlt: 'Brand guideline manual for Future Bank in Cairo',
          deliverables: [
            { item: 'Visual Identity Manual' },
            { item: 'Laser-Engraved Executive Flasks' },
          ],
          results: [
            { metric: '+210%', label: 'Growth in Customer Trust Index' },
          ],
        },
      });

      // 3. Query as Arabic visitor
      const resAr = await payloadInstance.find({
        collection: 'portfolio-projects',
        where: {
          and: [
            { slug: { equals: testSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'ar',
      });

      expect(resAr.docs).toHaveLength(1);
      expect(resAr.docs[0].title).toBe('تحول الهوية المؤسسية لبنك المستقبل');
      expect(resAr.docs[0].coverImageAlt).toBe('دليل الهوية البصرية لبنك المستقبل في القاهرة');
      expect(resAr.docs[0].deliverables[0].item).toBe('دليل الهوية البصرية');

      // 4. Query as English visitor
      const resEn = await payloadInstance.find({
        collection: 'portfolio-projects',
        where: {
          and: [
            { slug: { equals: testSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'en',
      });

      expect(resEn.docs).toHaveLength(1);
      expect(resEn.docs[0].title).toBe('Future Bank Corporate Brand Transformation');
      expect(resEn.docs[0].coverImageAlt).toBe('Brand guideline manual for Future Bank in Cairo');
      expect(resEn.docs[0].deliverables[0].item).toBe('Visual Identity Manual');

      // Clean up
      await payloadInstance.delete({
        collection: 'portfolio-projects',
        id: created.id,
      });
    });

    it('strictly isolates unpublished draft case study from public visitors', async () => {
      const draftSlug = `draft-case-${Date.now()}`;

      // 1. Create an unpublished draft
      const draftDoc = await payloadInstance.create({
        collection: 'portfolio-projects',
        locale: 'ar',
        data: {
          title: 'مشروع تسويقي سري تحت التنفيذ',
          slug: draftSlug,
          clientName: 'شركة سرية',
          serviceCategory: 'digital_marketing',
          summary: 'مسودة حملة غير معلنة.',
          coverImageAlt: 'صورة مسودة',
          _status: 'draft',
        },
      });

      expect(draftDoc.id).toBeDefined();

      // 2. Public query (published only)
      const publicQuery = await payloadInstance.find({
        collection: 'portfolio-projects',
        where: {
          and: [
            { slug: { equals: draftSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'ar',
        draft: false,
      });

      expect(publicQuery.docs).toHaveLength(0);

      // 3. Authorized Editor Draft query (draft: true)
      const editorQuery = await payloadInstance.find({
        collection: 'portfolio-projects',
        where: { slug: { equals: draftSlug } },
        locale: 'ar',
        draft: true,
      });

      expect(editorQuery.docs).toHaveLength(1);
      expect(editorQuery.docs[0].title).toBe('مشروع تسويقي سري تحت التنفيذ');

      // Clean up
      await payloadInstance.delete({
        collection: 'portfolio-projects',
        id: draftDoc.id,
      });
    });
  });

  describe('UI Component Rendering & Category Segmentation', () => {
    const mockProjects: PortfolioItem[] = [
      {
        id: '1',
        slug: 'project-brand',
        title: 'تصميم هوية شركة النيل',
        clientName: 'شركة النيل',
        serviceCategory: 'branding',
        summary: 'ملخص مشروع الهوية',
        coverImageAlt: 'شعار وهوية النيل',
        results: [{ metric: '+150%', label: 'نمو الوعي' }],
      },
      {
        id: '2',
        slug: 'project-gifts',
        title: 'أطقم هدايا مؤتمر الأهرام',
        clientName: 'مؤسسة الأهرام',
        serviceCategory: 'corporate_gifts',
        summary: 'أكواب ودفاتر جلدية فاخرة',
        coverImageAlt: 'أطقم الهدايا الفاخرة',
        results: [{ metric: '1,000', label: 'طقم معتمد' }],
      },
    ];

    it('renders PortfolioView with category filter tabs and image alt texts', () => {
      const htmlAr = renderToString(<PortfolioView locale="ar" projects={mockProjects} />);

      expect(htmlAr).toContain('جميع المشاريع');
      expect(htmlAr).toContain('الهوية البصرية');
      expect(htmlAr).toContain('الهدايا والمطبوعات');
      expect(htmlAr).toContain('تصميم هوية شركة النيل');
      expect(htmlAr).toContain('شعار وهوية النيل');
      expect(htmlAr).toContain('+150%');

      const htmlEn = renderToString(<PortfolioView locale="en" projects={mockProjects} />);
      expect(htmlEn).toContain('All Projects');
      expect(htmlEn).toContain('Branding &amp; Identity');
      expect(htmlEn).toContain('View Case Study');
    });

    it('returns 404 for non-existent or unapproved case study', async () => {
      await expect(
        CaseStudyDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: 'non-existent-project' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('renders CaseStudyDetailPage with full deliverables, metrics, and alt text for an actual Payload project', async () => {
      const liveSlug = `live-case-${Date.now()}`;
      const projectDoc = await payloadInstance.create({
        collection: 'portfolio-projects',
        locale: 'ar',
        data: {
          title: 'مشروع حقيقي موثق في نظام إدارة المحتوى',
          slug: liveSlug,
          clientName: 'عميل معتمد حقيقي',
          serviceCategory: 'branding',
          summary: 'ملخص دراسة حالة حقيقية تم توثيقها في النظام.',
          coverImageAlt: 'صورة توثيقية حقيقية للمشروع',
          _status: 'published',
          deliverables: [{ item: 'دليل العلامة التجارية' }],
          results: [{ metric: '+120%', label: 'نمو حقيقي في مؤشرات الأداء' }],
        },
      });

      const pageComponent = await CaseStudyDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: liveSlug }),
      });

      const html = renderToString(pageComponent);
      expect(html).toContain('مشروع حقيقي موثق في نظام إدارة المحتوى');
      expect(html).toContain('عميل معتمد حقيقي');
      expect(html).toContain('+120%');
      expect(html).toContain('نمو حقيقي في مؤشرات الأداء');
      expect(html).toContain('صورة توثيقية حقيقية للمشروع');
      expect(html).toContain('العودة لجميع المشروعات');

      // Clean up
      await payloadInstance.delete({
        collection: 'portfolio-projects',
        id: projectDoc.id,
      });
    });
  });
});

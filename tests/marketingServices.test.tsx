import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ServicesHubPage, {
  generateMetadata as generateHubMetadata,
  generateStaticParams as generateHubStaticParams,
} from '@/app/(frontend)/[locale]/services/page';
import ServiceDetailPage, {
  generateMetadata as generateDetailMetadata,
  generateStaticParams as generateDetailStaticParams,
} from '@/app/(frontend)/[locale]/services/[slug]/page';
import { legacyServicesData } from '@/scripts/migration/data/legacyServices';

describe('Phase 10.2: Services Hub & Dedicated Subpages Suite', () => {
  describe('Services Hub Page (/services)', () => {
    it('generates static params for all supported locales', () => {
      const params = generateHubStaticParams();
      expect(params).toEqual([{ locale: 'ar' }, { locale: 'en' }]);
    });

    it('generates rich metadata in Arabic and English', async () => {
      const metaAr = await generateHubMetadata({ params: Promise.resolve({ locale: 'ar' }) });
      expect(metaAr.title).toContain('خدماتنا المؤسسية والحلول الإبداعية');
      expect(metaAr.description).toContain('استكشف تخصصات وكالة موهبة الست');

      const metaEn = await generateHubMetadata({ params: Promise.resolve({ locale: 'en' }) });
      expect(metaEn.title).toContain('Our Corporate Services');
      expect(metaEn.description).toContain('Explore MWHEBA Agency’s 6 core disciplines');
    });

    it('renders all 6 services on the hub page with links and deliverables', async () => {
      const component = await ServicesHubPage({ params: Promise.resolve({ locale: 'ar' }) });
      const html = renderToString(component);

      expect(html).toContain('منظومة إبداعية وإنتاجية متكاملة لنمو علامتك التجارية');
      expect(html).toContain('خدماتنا');

      for (const service of legacyServicesData) {
        expect(html).toContain(service.ar.title);
        expect(html).toContain(`/ar/services/${service.slug}`);
      }

      // Check that printing links to the B2B store as well
      expect(html).toContain('/ar/store');
    });
  });

  describe('Service Detail Pages (/services/[slug])', () => {
    it('generates static params for all 6 services in both locales (12 total paths)', () => {
      const params = generateDetailStaticParams();
      expect(params.length).toBe(12);

      const arSlugs = params.filter((p) => p.locale === 'ar').map((p) => p.slug);
      expect(arSlugs).toContain('brand-identity');
      expect(arSlugs).toContain('web-development');
      expect(arSlugs).toContain('ui-ux-design');
      expect(arSlugs).toContain('digital-marketing');
      expect(arSlugs).toContain('media-production');
      expect(arSlugs).toContain('printing');
    });

    it('renders Brand Identity detail page with full copy, deliverables, and SLA', async () => {
      const meta = await generateDetailMetadata({
        params: Promise.resolve({ locale: 'ar', slug: 'brand-identity' }),
      });
      expect(meta.title).toContain('هوية العلامة التجارية');

      const component = await ServiceDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: 'brand-identity' }),
      });
      const html = renderToString(component);

      expect(html).toContain('هوية العلامة التجارية');
      expect(html).toContain('بناء وتطوير الهويات المؤسسية المتكاملة');
      expect(html).toContain('دليل الهوية الشامل (PDF)');
      expect(html).toContain('ضمان الجودة المؤسسي من موهبة');
      expect(html).toContain('/ar/contact?service=brand-identity');
    });

    it('renders Web Development detail page with authentic technical scope', async () => {
      const component = await ServiceDetailPage({
        params: Promise.resolve({ locale: 'en', slug: 'web-development' }),
      });
      const html = renderToString(component);

      expect(html).toContain('Web Application &amp; Software Development');
      expect(html).toContain('Next.js, React, and TypeScript');
      expect(html).toContain('Core Web Vitals');
      expect(html).toContain('Standard Deliverables &amp; SLA');
    });

    it('renders Printing & Corporate Merchandise detail page with B2B store bridge', async () => {
      const component = await ServiceDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: 'printing' }),
      });
      const html = renderToString(component);

      expect(html).toContain('الطباعة التجارية والهدايا المؤسسية');
      expect(html).toContain('متجر هدايا الشركات (MOQ 10)');
      expect(html).toContain('/ar/store');
      expect(html).toContain('توريد وتخصيص الهدايا الترويجية (VIP Corporate Giveaways)');
    });
  });
});

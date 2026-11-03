import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Pages } from '../src/modules/content/collections/Pages';
import {
  HeroBlock,
  ServicesGridBlock,
  PortfolioShowcaseBlock,
  ClientsLogoBlock,
  StatsBlock,
  FAQBlock,
  CallToActionBlock,
  FormBlock,
  pageBlocks,
} from '../src/modules/content/blocks';
import { BlockRenderer } from '../src/modules/content/ui/BlockRenderer';
import { getPayload } from 'payload';
import config from '../src/payload.config';

describe('CMS-01: Reusable Page Blocks & Content Collections Schema', () => {
  describe('Collection and Blocks Schema Integrity', () => {
    it('defines Pages collection with correct slug, drafts, permissions, and localized layout', () => {
      expect(Pages.slug).toBe('pages');
      expect(Boolean((Pages.versions as any)?.drafts)).toBe(true);
      expect(Pages.admin?.useAsTitle).toBe('title');

      const titleField: any = Pages.fields.find((f: any) => f.name === 'title');
      expect(titleField).toBeDefined();
      expect(titleField?.localized).toBe(true);
      expect(titleField?.required).toBe(true);

      const slugField: any = Pages.fields.find((f: any) => f.name === 'slug');
      expect(slugField).toBeDefined();
      expect(slugField?.unique).toBe(true);
      expect(slugField?.index).toBe(true);

      const layoutField: any = Pages.fields.find((f: any) => f.name === 'layout');
      expect(layoutField).toBeDefined();
      expect(layoutField?.type).toBe('blocks');
      // Crucial: layout must be localized to guarantee total block and sequence isolation between languages
      expect(layoutField?.localized).toBe(true);
    });

    it('contains all 8 required corporate page blocks', () => {
      expect(pageBlocks).toHaveLength(8);

      const blockSlugs = pageBlocks.map((b) => b.slug);
      expect(blockSlugs).toContain('hero');
      expect(blockSlugs).toContain('servicesGrid');
      expect(blockSlugs).toContain('portfolioShowcase');
      expect(blockSlugs).toContain('clientsLogo');
      expect(blockSlugs).toContain('stats');
      expect(blockSlugs).toContain('faq');
      expect(blockSlugs).toContain('cta');
      expect(blockSlugs).toContain('formBlock');
    });

    it('verifies HeroBlock fields and options', () => {
      expect(HeroBlock.slug).toBe('hero');
      const headline: any = HeroBlock.fields.find((f: any) => f.name === 'headline');
      expect(headline?.required).toBe(true);

      const theme: any = HeroBlock.fields.find((f: any) => f.name === 'theme');
      expect(theme?.type).toBe('select');
    });

    it('verifies ServicesGridBlock fields and array sub-fields', () => {
      expect(ServicesGridBlock.slug).toBe('servicesGrid');
      const services: any = ServicesGridBlock.fields.find((f: any) => f.name === 'services');
      expect(services?.type).toBe('array');
    });

    it('verifies PortfolioShowcaseBlock, ClientsLogoBlock, StatsBlock, FAQBlock, CallToActionBlock, FormBlock schema', () => {
      expect(PortfolioShowcaseBlock.slug).toBe('portfolioShowcase');
      expect(ClientsLogoBlock.slug).toBe('clientsLogo');
      expect(StatsBlock.slug).toBe('stats');
      expect(FAQBlock.slug).toBe('faq');
      expect(CallToActionBlock.slug).toBe('cta');
      expect(FormBlock.slug).toBe('formBlock');
    });
  });

  describe('BlockRenderer Component & Sequence Verification', () => {
    const mockArabicBlocks = [
      {
        id: 'block-hero-01',
        blockType: 'hero',
        badge: 'وكالة متكاملة // منذ 2018',
        headline: 'تصميم الهوية وتطوير المنصات الرقمية',
        subtitle: 'نبني العلامات التجارية الرائدة ونطوّر الحلول التقنية المتقدمة للشركات.',
        primaryCta: { label: 'استكشف خدماتنا', url: '/ar/services' },
        secondaryCta: { label: 'تواصل معنا', url: '/ar/contact' },
        theme: 'dark',
      },
      {
        id: 'block-services-02',
        blockType: 'servicesGrid',
        eyebrow: 'خدماتنا الاستراتيجية',
        title: 'حلول متكاملة لنمو الأعمال',
        subtitle: 'منظومة إبداعية وهندسية تلبي تطلعات المؤسسات الكبرى.',
        services: [
          { title: 'تصميم الهوية التجارية', description: 'أدلة إرشادية متكاملة للعلامات التجارية.', linkUrl: '/ar/services/branding' },
          { title: 'تطوير المواقع والمنصات', description: 'منصات ويب سريعة، آمنة وقابلة للتوسع.', linkUrl: '/ar/services/digital' },
        ],
      },
      {
        id: 'block-stats-03',
        blockType: 'stats',
        title: 'أرقام وإنجازات تعكس ثقة الشركاء',
        stats: [
          { value: '500+', label: 'مشروع منجز', description: 'بأعلى معايير الجودة' },
          { value: '7+', label: 'سنوات خبرة', description: 'في السوق المصري والإقليمي' },
        ],
      },
      {
        id: 'block-cta-04',
        blockType: 'cta',
        eyebrow: 'جاهزون لبدء مشروعكم القادم؟',
        title: 'دعنا نحول رؤيتك إلى واقع ملموس',
        description: 'فريقنا مستعد لتطوير هويتكم التجارية وإطلاق منصتكم الرقمية القادمة.',
        primaryCta: { label: 'طلب عرض سعر', url: '/ar/quote' },
        theme: 'dark',
      },
    ];

    it('renders 4 configured blocks in exact sequential order in Arabic', () => {
      const html = renderToString(<BlockRenderer blocks={mockArabicBlocks} locale="ar" />);

      // Verify all 4 blocks render
      expect(html).toContain('data-block-type="hero"');
      expect(html).toContain('data-block-type="servicesGrid"');
      expect(html).toContain('data-block-type="stats"');
      expect(html).toContain('data-block-type="cta"');

      // Verify sequence in HTML
      const heroIdx = html.indexOf('data-block-type="hero"');
      const servicesIdx = html.indexOf('data-block-type="servicesGrid"');
      const statsIdx = html.indexOf('data-block-type="stats"');
      const ctaIdx = html.indexOf('data-block-type="cta"');

      expect(heroIdx).toBeLessThan(servicesIdx);
      expect(servicesIdx).toBeLessThan(statsIdx);
      expect(statsIdx).toBeLessThan(ctaIdx);

      // Verify content
      expect(html).toContain('تصميم الهوية وتطوير المنصات الرقمية');
      expect(html).toContain('حلول متكاملة لنمو الأعمال');
      expect(html).toContain('أرقام وإنجازات تعكس ثقة الشركاء');
      expect(html).toContain('دعنا نحول رؤيتك إلى واقع ملموس');
    });

    it('renders 4 configured blocks in English when localized', () => {
      const mockEnglishBlocks = [
        {
          id: 'block-hero-01',
          blockType: 'hero',
          badge: 'Integrated Agency // Est. 2018',
          headline: 'Brand Architecture & Digital Engineering',
          subtitle: 'We craft iconic identities and high-performance digital platforms.',
          primaryCta: { label: 'Explore Services', url: '/en/services' },
          theme: 'light',
        },
        {
          id: 'block-services-02',
          blockType: 'servicesGrid',
          eyebrow: 'Core Capabilities',
          title: 'Strategic Solutions for Corporate Growth',
          services: [
            { title: 'Brand Identity Systems', description: 'Comprehensive design guidelines and identity assets.' },
          ],
        },
        {
          id: 'block-stats-03',
          blockType: 'stats',
          title: 'Measured Milestones',
          stats: [{ value: '500+', label: 'Delivered Projects' }],
        },
        {
          id: 'block-cta-04',
          blockType: 'cta',
          title: 'Ready to elevate your corporate presence?',
          primaryCta: { label: 'Request a Proposal', url: '/en/quote' },
          theme: 'dark',
        },
      ];

      const html = renderToString(<BlockRenderer blocks={mockEnglishBlocks} locale="en" />);
      expect(html).toContain('Brand Architecture &amp; Digital Engineering');
      expect(html).toContain('Strategic Solutions for Corporate Growth');
      expect(html).toContain('Measured Milestones');
      expect(html).toContain('Ready to elevate your corporate presence?');
    });

    it('demonstrates reordering blocks in layout changes output sequence', () => {
      // Reorder: stats first, then hero
      const reorderedBlocks = [
        mockArabicBlocks[2], // stats
        mockArabicBlocks[0], // hero
        mockArabicBlocks[3], // cta
        mockArabicBlocks[1], // servicesGrid
      ];

      const html = renderToString(<BlockRenderer blocks={reorderedBlocks} locale="ar" />);
      const heroIdx = html.indexOf('data-block-type="hero"');
      const statsIdx = html.indexOf('data-block-type="stats"');

      // Now stats must appear BEFORE hero
      expect(statsIdx).toBeLessThan(heroIdx);
    });
  });

  describe('Payload Local API Bilingual Layout Isolation & Order Persistence', () => {
    let payloadInstance: any;
    let createdPageId: string | number;

    beforeAll(async () => {
      payloadInstance = await getPayload({ config });
    });

    it('proves complete isolation of title, blocks, and sequence between Arabic and English', async () => {
      const testSlug = `cms-isolation-${Date.now()}`;

      const arabicBlocks = [
        {
          blockType: 'hero',
          headline: 'العنوان الرئيسي العربي',
          subtitle: 'وصف الهيرو باللغة العربية.',
          theme: 'dark',
        },
        {
          blockType: 'servicesGrid',
          title: 'شبكة الخدمات بالعربية',
          services: [
            {
              title: 'تصميم الهوية التجارية',
              description: 'تصميم متكامل للشعارات والخطوط.',
            },
          ],
        },
        {
          blockType: 'stats',
          title: 'إحصائيات وأرقام عربية',
          stats: [
            {
              value: '500+',
              label: 'مشروع عربي',
            },
          ],
        },
        {
          blockType: 'cta',
          title: 'ابدأ مشروعك بالعربية اليوم',
          theme: 'dark',
        },
      ];

      const englishBlocks = [
        {
          blockType: 'hero',
          headline: 'English Hero Headline',
          subtitle: 'English hero subtitle description.',
          theme: 'light',
        },
        {
          blockType: 'servicesGrid',
          title: 'English Services Grid Title',
          services: [
            {
              title: 'Brand Architecture',
              description: 'Comprehensive identity systems.',
            },
          ],
        },
        {
          blockType: 'stats',
          title: 'English Stats Title',
          stats: [
            {
              value: '500+',
              label: 'Delivered Projects',
            },
          ],
        },
        {
          blockType: 'cta',
          title: 'Start Your English Project Today',
          theme: 'dark',
        },
      ];

      // 1. Create page with Arabic content and Arabic layout sequence (Hero, ServicesGrid, Stats, CTA)
      const createdPage = await payloadInstance.create({
        collection: 'pages',
        locale: 'ar',
        data: {
          title: 'صفحة تجربة كتل الـ CMS بالعربية',
          slug: testSlug,
          layout: arabicBlocks,
          _status: 'published',
        },
      });

      expect(createdPage).toBeDefined();
      expect(createdPage.id).toBeDefined();
      createdPageId = createdPage.id;

      // 2. Populate English locale with its own independent English blocks (Hero, ServicesGrid, Stats, CTA)
      await payloadInstance.update({
        collection: 'pages',
        id: createdPageId,
        locale: 'en',
        data: {
          title: 'CMS Blocks Test Page in English',
          layout: englishBlocks,
        },
      });

      // 3. Reorder the Arabic layout to a completely different sequence: CTA -> Stats -> Hero -> ServicesGrid
      const reorderedArabicBlocks = [
        arabicBlocks[3], // CTA
        arabicBlocks[2], // Stats
        arabicBlocks[0], // Hero
        arabicBlocks[1], // ServicesGrid
      ];

      await payloadInstance.update({
        collection: 'pages',
        id: createdPageId,
        locale: 'ar',
        data: {
          layout: reorderedArabicBlocks,
        },
      });

      // 4. Strict Isolation Verification: Read Arabic document
      const readArabic = await payloadInstance.findByID({
        collection: 'pages',
        id: createdPageId,
        locale: 'ar',
      });

      // Assert Arabic title, block count, block order, and content
      expect(readArabic.title).toBe('صفحة تجربة كتل الـ CMS بالعربية');
      expect(readArabic.layout).toHaveLength(4);
      expect(readArabic.layout[0].blockType).toBe('cta');
      expect(readArabic.layout[0].title).toBe('ابدأ مشروعك بالعربية اليوم');

      expect(readArabic.layout[1].blockType).toBe('stats');
      expect(readArabic.layout[1].title).toBe('إحصائيات وأرقام عربية');

      expect(readArabic.layout[2].blockType).toBe('hero');
      expect(readArabic.layout[2].headline).toBe('العنوان الرئيسي العربي');

      expect(readArabic.layout[3].blockType).toBe('servicesGrid');
      expect(readArabic.layout[3].title).toBe('شبكة الخدمات بالعربية');

      // 5. Strict Isolation Verification: Read English document
      const readEnglish = await payloadInstance.findByID({
        collection: 'pages',
        id: createdPageId,
        locale: 'en',
      });

      // Assert English title, block count, block order, and content are COMPLETELY UNTOUCHED by Arabic reordering
      expect(readEnglish.title).toBe('CMS Blocks Test Page in English');
      expect(readEnglish.layout).toHaveLength(4);
      expect(readEnglish.layout[0].blockType).toBe('hero');
      expect(readEnglish.layout[0].headline).toBe('English Hero Headline');

      expect(readEnglish.layout[1].blockType).toBe('servicesGrid');
      expect(readEnglish.layout[1].title).toBe('English Services Grid Title');

      expect(readEnglish.layout[2].blockType).toBe('stats');
      expect(readEnglish.layout[2].title).toBe('English Stats Title');

      expect(readEnglish.layout[3].blockType).toBe('cta');
      expect(readEnglish.layout[3].title).toBe('Start Your English Project Today');

      // 6. Clean up test document
      await payloadInstance.delete({
        collection: 'pages',
        id: createdPageId,
      });
    });
  });
});

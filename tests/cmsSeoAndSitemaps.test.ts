import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { buildBilingualMetadata, SITE_URL } from '../src/shared/lib/seo';
import robots from '../src/app/robots';
import sitemap, { dynamic as sitemapDynamic, revalidate as sitemapRevalidate } from '../src/app/sitemap';

describe('CMS-06: Technical SEO, Dynamic Sitemaps & OpenGraph Engine', () => {
  let payloadInstance: any;

  beforeAll(async () => {
    payloadInstance = await getPayload({ config });
  }, 30000);

  describe('Bilingual Metadata Builder', () => {
    it('generates canonical and hreflang alternate links correctly for Arabic', () => {
      const meta = buildBilingualMetadata({
        title: 'من نحن وتاريخ الوكالة',
        description: 'قصة وكالة موهبة الرائدة في الدعاية والإعلان في مصر.',
        path: '/about',
        locale: 'ar',
      });

      expect(meta.title).toBe('من نحن وتاريخ الوكالة | وكالة موهبة');
      expect(meta.description).toBe('قصة وكالة موهبة الرائدة في الدعاية والإعلان في مصر.');
      expect(meta.alternates?.canonical).toBe(`${SITE_URL}/ar/about`);
      expect(meta.alternates?.languages?.['ar']).toBe(`${SITE_URL}/ar/about`);
      expect(meta.alternates?.languages?.['en']).toBe(`${SITE_URL}/en/about`);
      expect(meta.alternates?.languages?.['x-default']).toBe(`${SITE_URL}/ar/about`);

      expect(meta.openGraph?.locale).toBe('ar_EG');
      expect(meta.openGraph?.alternateLocale).toContain('en_US');
    });

    it('generates canonical and hreflang alternate links correctly for English', () => {
      const meta = buildBilingualMetadata({
        title: 'About MWHEBA',
        description: 'Leading creative branding and production powerhouse in Cairo.',
        path: '/about',
        locale: 'en',
      });

      expect(meta.title).toBe('About MWHEBA | MWHEBA Agency');
      expect(meta.alternates?.canonical).toBe(`${SITE_URL}/en/about`);
      expect(meta.alternates?.languages?.['ar']).toBe(`${SITE_URL}/ar/about`);
      expect(meta.alternates?.languages?.['en']).toBe(`${SITE_URL}/en/about`);
      expect(meta.openGraph?.locale).toBe('en_US');
    });

    it('generates OpenGraph and Twitter card summary tags with fallback image', () => {
      const meta = buildBilingualMetadata({
        title: 'خدمات الهوية البصرية',
        description: 'تصميم الهويات والعلامات التجارية.',
        path: '/services/branding',
        locale: 'ar',
      });

      expect((meta.openGraph as any)?.type).toBe('website');
      expect(meta.openGraph?.images).toBeDefined();
      expect((meta.twitter as any)?.card).toBe('summary_large_image');
      expect(meta.robots).toEqual(
        expect.objectContaining({
          index: true,
          follow: true,
        })
      );
    });

    it('honors noIndex flag for private or sensitive routes', () => {
      const meta = buildBilingualMetadata({
        title: 'Checkout',
        description: 'Order checkout.',
        path: '/checkout',
        locale: 'ar',
        noIndex: true,
      });

      expect(meta.robots).toEqual({
        index: false,
        follow: false,
      });
    });
  });

  describe('Robots Directives (/robots.txt)', () => {
    it('produces valid robots configuration disallowing admin, checkout, and preview routes', () => {
      const rob = robots();
      expect(rob.sitemap).toBe(`${SITE_URL}/sitemap.xml`);

      const rules = Array.isArray(rob.rules) ? rob.rules : [rob.rules];
      expect(rules.length).toBeGreaterThan(0);

      const mainRule = rules[0];
      expect(mainRule.userAgent).toBe('*');

      const disallow = Array.isArray(mainRule.disallow) ? mainRule.disallow : [mainRule.disallow];
      expect(disallow).toContain('/admin');
      expect(disallow).toContain('/admin/');
      expect(disallow).toContain('/api/');
      expect(disallow).toContain('/ar/checkout');
      expect(disallow).toContain('/en/checkout');
      expect(disallow).toContain('/*preview*');
      expect(disallow).toContain('/*token*');

      const allow = Array.isArray(mainRule.allow) ? mainRule.allow : [mainRule.allow];
      expect(allow).toContain('/ar');
      expect(allow).toContain('/en');
    });
  });

  describe('Dynamic Sitemap Generator (/sitemap.xml)', () => {
    it('generates well-formed bilingual sitemap entries for static and dynamic published content', async () => {
      const sitemapEntries = await sitemap();

      expect(Array.isArray(sitemapEntries)).toBe(true);
      expect(sitemapEntries.length).toBeGreaterThanOrEqual(10); // At least 10 static entries (5 pages x 2 locales)

      const urls = sitemapEntries.map((e) => e.url);

      // Core static routes must all be present
      expect(urls).toContain(`${SITE_URL}/ar`);
      expect(urls).toContain(`${SITE_URL}/en`);
      expect(urls).toContain(`${SITE_URL}/ar/store`);
      expect(urls).toContain(`${SITE_URL}/en/store`);
      expect(urls).toContain(`${SITE_URL}/ar/portfolio`);
      expect(urls).toContain(`${SITE_URL}/en/portfolio`);
      expect(urls).toContain(`${SITE_URL}/ar/blog`);
      expect(urls).toContain(`${SITE_URL}/en/blog`);
      expect(urls).toContain(`${SITE_URL}/ar/contact`);
      expect(urls).toContain(`${SITE_URL}/en/contact`);

      // All URLs must be absolute HTTPS
      for (const entry of sitemapEntries) {
        expect(entry.url).toMatch(/^https:\/\//);
        expect(entry.lastModified).toBeInstanceOf(Date);
        expect(entry.priority).toBeGreaterThan(0);
        expect(entry.priority).toBeLessThanOrEqual(1.0);
        expect(entry.alternates?.languages).toBeDefined();
        expect(entry.alternates?.languages?.['ar']).toMatch(/^https:\/\//);
        expect(entry.alternates?.languages?.['en']).toMatch(/^https:\/\//);
      }
    });

    it('indexes published blog posts and excludes unpublished drafts', async () => {
      const timestamp = Date.now();
      const pubSlug = `seo-indexed-post-${timestamp}`;
      const draftSlug = `seo-draft-post-${timestamp}`;

      const pubPost = await payloadInstance.create({
        collection: 'blog-posts',
        locale: 'ar',
        draft: false,
        data: {
          title: 'مقال سيو مفهرس',
          slug: pubSlug,
          author: 'فريق السيو',
          category: 'marketing',
          excerpt: 'نبذة عن أهمية السيو.',
          coverImageAlt: 'صورة السيو',
          content: 'محتوى مفهرس في خريطة الموقع...',
          _status: 'published',
        },
      });

      const draftPost = await payloadInstance.create({
        collection: 'blog-posts',
        locale: 'ar',
        draft: true,
        data: {
          title: 'مسودة سيو غير مفهرسة',
          slug: draftSlug,
          author: 'فريق السيو',
          category: 'marketing',
          excerpt: 'نبذة مسودة.',
          coverImageAlt: 'صورة المسودة',
          content: 'محتوى غير منشور...',
          _status: 'draft',
        },
      });

      try {
        const entries = await sitemap();
        const urls = entries.map((e) => e.url);

        expect(urls).toContain(`${SITE_URL}/ar/blog/${pubSlug}`);
        expect(urls).toContain(`${SITE_URL}/en/blog/${pubSlug}`);

        expect(urls).not.toContain(`${SITE_URL}/ar/blog/${draftSlug}`);
        expect(urls).not.toContain(`${SITE_URL}/en/blog/${draftSlug}`);
      } finally {
        await payloadInstance.delete({
          collection: 'blog-posts',
          id: pubPost.id,
        });
        await payloadInstance.delete({
          collection: 'blog-posts',
          id: draftPost.id,
        });
      }
    });

    it('exports dynamic force-dynamic and revalidate 0 for immediate on-demand sitemap refresh', () => {
      expect(sitemapDynamic).toBe('force-dynamic');
      expect(sitemapRevalidate).toBe(0);
    });

    it('immediately reflects new content created dynamically after initial generation', async () => {
      const initialEntries = await sitemap();
      const initialCount = initialEntries.length;

      const dynamicSlug = `realtime-update-${Date.now()}`;
      const newPost = await payloadInstance.create({
        collection: 'blog-posts',
        locale: 'ar',
        draft: false,
        data: {
          title: 'مقال محدث فوريًا',
          slug: dynamicSlug,
          author: 'فريق السيو المباشر',
          category: 'branding',
          excerpt: 'نبذة عن التحديث الفوري.',
          coverImageAlt: 'صورة حية',
          content: 'محتوى يثبت فورية تحديث خريطة الموقع...',
          _status: 'published',
        },
      });

      try {
        // Without rebuilding or restarting, the dynamic sitemap must include the new article immediately
        const updatedEntries = await sitemap();
        expect(updatedEntries.length).toBe(initialCount + 2); // 1 for /ar, 1 for /en
        const urls = updatedEntries.map((e) => e.url);
        expect(urls).toContain(`${SITE_URL}/ar/blog/${dynamicSlug}`);
        expect(urls).toContain(`${SITE_URL}/en/blog/${dynamicSlug}`);
      } finally {
        await payloadInstance.delete({
          collection: 'blog-posts',
          id: newPost.id,
        });
      }
    });
  });
});

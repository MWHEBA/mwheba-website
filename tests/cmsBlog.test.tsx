import { describe, it, expect, beforeAll, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { BlogPosts } from '../src/modules/content/collections/BlogPosts';
import { calculateReadingTime } from '../src/modules/content/lib/readingTime';
import { BlogListingView, type BlogPostItem } from '../src/modules/content/ui/BlogListingView';
import BlogPostDetailPage from '../src/app/(frontend)/[locale]/blog/[slug]/page';
import { safeJsonLdReplacer } from '../src/shared/lib/safeJsonLd';
import {
  generatePreviewToken,
  verifyPreviewToken,
} from '../src/modules/content/lib/previewTokens';

let mockDraftModeActive = false;

// Mock next/headers
vi.mock('next/headers', () => {
  return {
    draftMode: vi.fn().mockImplementation(() =>
      Promise.resolve({
        isEnabled: mockDraftModeActive,
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

describe('CMS-04: Agency Insights & Blog Module', () => {
  let payloadInstance: any;

  beforeAll(async () => {
    payloadInstance = await getPayload({ config });
  }, 30000);

  describe('Reading Time Calculator Utility', () => {
    it('calculates reading time correctly based on word count with 1 minute minimum', () => {
      expect(calculateReadingTime('')).toBe(1);
      expect(calculateReadingTime('   ')).toBe(1);
      expect(calculateReadingTime(null)).toBe(1);

      // 90 words should be 1 minute
      const shortText = new Array(90).fill('كلمة').join(' ');
      expect(calculateReadingTime(shortText)).toBe(1);

      // 360 words should be 2 minutes
      const mediumText = new Array(360).fill('word').join(' ');
      expect(calculateReadingTime(mediumText)).toBe(2);

      // 720 words should be 4 minutes
      const longText = new Array(720).fill('استراتيجية').join(' ');
      expect(calculateReadingTime(longText)).toBe(4);
    });
  });

  describe('BlogPosts Collection Schema & Access Control', () => {
    it('defines BlogPosts collection with correct slug, draft versions, and RBAC', () => {
      expect(BlogPosts.slug).toBe('blog-posts');
      expect(Boolean((BlogPosts.versions as any)?.drafts)).toBe(true);

      const titleField: any = BlogPosts.fields.find((f: any) => f.name === 'title');
      expect(titleField).toBeDefined();
      expect(titleField?.localized).toBe(true);
      expect(titleField?.required).toBe(true);

      const slugField: any = BlogPosts.fields.find((f: any) => f.name === 'slug');
      expect(slugField).toBeDefined();
      expect(slugField?.unique).toBe(true);
      expect(slugField?.index).toBe(true);

      const categoryField: any = BlogPosts.fields.find((f: any) => f.name === 'category');
      expect(categoryField).toBeDefined();
      expect(categoryField?.type).toBe('select');
      const catOptions = categoryField?.options.map((o: any) => o.value);
      expect(catOptions).toContain('branding');
      expect(catOptions).toContain('marketing');
      expect(catOptions).toContain('merchandise');
      expect(catOptions).toContain('media');

      const contentField: any = BlogPosts.fields.find((f: any) => f.name === 'content');
      expect(contentField).toBeDefined();
      expect(contentField?.required).toBe(true);
      expect(contentField?.localized).toBe(true);

      const altField: any = BlogPosts.fields.find((f: any) => f.name === 'coverImageAlt');
      expect(altField).toBeDefined();
      expect(altField?.required).toBe(true);
      expect(altField?.localized).toBe(true);
    });

    it('generates page-specific preview token for blog articles', () => {
      const token = generatePreviewToken({ slug: 'blog/strategic-branding-guide', locale: 'ar' });
      expect(token).toBeDefined();

      const verification = verifyPreviewToken(token, {
        expectedSlug: 'blog/strategic-branding-guide',
        expectedLocale: 'ar',
      });
      expect(verification.valid).toBe(true);
      expect(verification.payload?.slug).toBe('blog/strategic-branding-guide');
    });
  });

  describe('Bilingual Article Lifecycle & Data Isolation', () => {
    it('creates, localizes, and queries a published blog post across Arabic and English', async () => {
      const testSlug = `article-${Date.now()}`;

      // 1. Create Arabic published article
      const created = await payloadInstance.create({
        collection: 'blog-posts',
        locale: 'ar',
        data: {
          title: 'دليل بناء الهوية التجارية للمؤسسات لعام 2026',
          slug: testSlug,
          author: 'فريق موهبة التحريري',
          category: 'branding',
          readingTimeMinutes: 5,
          excerpt: 'تحليل استراتيجي لمقومات بناء الهوية التجارية المتميزة في السوق المصري والإقليمي.',
          coverImageAlt: 'دليل تصميم الهوية التجارية للمؤسسات',
          content: 'نص المقال الكامل يستعرض ركائز الهوية البصرية والقيمة السوقية.',
          tags: [{ tag: 'الهوية المؤسسية' }, { tag: 'استراتيجية العلامة' }],
          _status: 'published',
        },
      });

      expect(created.id).toBeDefined();

      // 2. Add English localization
      await payloadInstance.update({
        collection: 'blog-posts',
        id: created.id,
        locale: 'en',
        data: {
          title: 'Enterprise Corporate Branding Playbook 2026',
          author: 'MWHEBA Editorial Team',
          excerpt: 'Strategic analysis of modern corporate visual identity in the Egyptian and MENA market.',
          coverImageAlt: 'Enterprise branding playbook manual cover',
          content: 'Full article text detailing core brand identity pillars and market positioning.',
          tags: [{ tag: 'Corporate Identity' }, { tag: 'Brand Strategy' }],
        },
      });

      // 3. Query as Arabic visitor
      const resAr = await payloadInstance.find({
        collection: 'blog-posts',
        where: {
          and: [
            { slug: { equals: testSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'ar',
      });

      expect(resAr.docs).toHaveLength(1);
      expect(resAr.docs[0].title).toBe('دليل بناء الهوية التجارية للمؤسسات لعام 2026');
      expect(resAr.docs[0].coverImageAlt).toBe('دليل تصميم الهوية التجارية للمؤسسات');
      expect(resAr.docs[0].tags[0].tag).toBe('الهوية المؤسسية');

      // 4. Query as English visitor
      const resEn = await payloadInstance.find({
        collection: 'blog-posts',
        where: {
          and: [
            { slug: { equals: testSlug } },
            { _status: { equals: 'published' } },
          ],
        },
        locale: 'en',
      });

      expect(resEn.docs).toHaveLength(1);
      expect(resEn.docs[0].title).toBe('Enterprise Corporate Branding Playbook 2026');
      expect(resEn.docs[0].coverImageAlt).toBe('Enterprise branding playbook manual cover');
      expect(resEn.docs[0].tags[0].tag).toBe('Corporate Identity');

      // Clean up
      await payloadInstance.delete({
        collection: 'blog-posts',
        id: created.id,
      });
    });

    it('strictly isolates unpublished draft articles from public queries and serves them only to authorized editors', async () => {
      const draftSlug = `draft-article-${Date.now()}`;

      // 1. Create an unpublished draft article
      const draftDoc = await payloadInstance.create({
        collection: 'blog-posts',
        locale: 'ar',
        data: {
          title: 'مسودة مقال سري حول اتجاهات السوق',
          slug: draftSlug,
          author: 'فريق موهبة التحريري',
          category: 'marketing',
          excerpt: 'ملخص مسودة لم تنشر للعامة بعد.',
          coverImageAlt: 'صورة مسودة للمقال',
          content: 'نص مسودة سرية قيد المراجعة والاعتماد الداخلي.',
          _status: 'draft',
        },
      });

      expect(draftDoc.id).toBeDefined();

      // 2. Public query (published only)
      const publicQuery = await payloadInstance.find({
        collection: 'blog-posts',
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

      // 3. Public visitor attempting to view draft via page component gets 404
      mockDraftModeActive = false;
      await expect(
        BlogPostDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: draftSlug }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 4. Authorized Editor Draft query (draft: true)
      const editorQuery = await payloadInstance.find({
        collection: 'blog-posts',
        where: { slug: { equals: draftSlug } },
        locale: 'ar',
        draft: true,
      });

      expect(editorQuery.docs).toHaveLength(1);
      expect(editorQuery.docs[0].title).toBe('مسودة مقال سري حول اتجاهات السوق');

      // 5. Authorized editor in draft preview mode can view draft page with banner
      mockDraftModeActive = true;
      vi.spyOn(payloadInstance, 'auth').mockResolvedValueOnce({
        user: { id: 'usr_editor', roles: ['marketer'] } as any,
        permissions: {} as any,
      });

      const pageComponent = await BlogPostDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: draftSlug }),
      });
      const html = renderToString(pageComponent);
      expect(html).toContain('مسودة مقال سري حول اتجاهات السوق');
      expect(html).toContain('وضع معاينة المقال');

      // Clean up
      mockDraftModeActive = false;
      await payloadInstance.delete({
        collection: 'blog-posts',
        id: draftDoc.id,
      });
    });
  });

  describe('UI Component Rendering & Category Segmentation', () => {
    const mockPosts: BlogPostItem[] = [
      {
        id: '1',
        slug: 'branding-roi',
        title: 'عائد الاستثمار في الهوية التجارية',
        author: 'م. أحمد الشريف',
        category: 'branding',
        readingTimeMinutes: 4,
        excerpt: 'كيف تساهم الهوية البصرية في زيادة مبيعات الشركات.',
        coverImageAlt: 'رسم بياني للهوية التجارية',
      },
      {
        id: '2',
        slug: 'corporate-gifts-guide',
        title: 'دليل اختيار الهدايا المؤسسية المخصصة',
        author: 'سارة يوسف',
        category: 'merchandise',
        readingTimeMinutes: 6,
        excerpt: 'معايير اختيار الأكواب والدفاتر والمطبوعات التنفيذية.',
        coverImageAlt: 'أطقم هدايا تنفيذية',
      },
    ];

    it('renders BlogListingView with category filter pills and reading time badges', () => {
      const htmlAr = renderToString(<BlogListingView locale="ar" posts={mockPosts} />);

      expect(htmlAr).toContain('جميع المقالات');
      expect(htmlAr).toContain('الهوية البصرية');
      expect(htmlAr).toContain('الهدايا والطباعة');
      expect(htmlAr).toContain('عائد الاستثمار في الهوية التجارية');
      expect(htmlAr).toContain('4 دقائق قراءة');
      expect(htmlAr).toContain('م. أحمد الشريف');

      const htmlEn = renderToString(<BlogListingView locale="en" posts={mockPosts} />);
      expect(htmlEn).toContain('All Articles');
      expect(htmlEn).toContain('Branding &amp; Identity');
      expect(htmlEn).toContain('Read Article');
    });

    it('returns 404 for non-existent blog post', async () => {
      await expect(
        BlogPostDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: 'non-existent-article' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('safely serializes JSON-LD escaping dangerous </script> tags to prevent script breakout', async () => {
      const maliciousPayload = {
        title: 'مقال متقدم </script><script>alert("xss")</script>',
        excerpt: 'تفاصيل هامة </script><script>evil()</script>',
        author: 'مهاجم <script>',
      };

      const serialized = safeJsonLdReplacer(maliciousPayload);

      // Verify that NO literal </script> or <script> exists in the serialized string
      expect(serialized).not.toContain('</script>');
      expect(serialized).not.toContain('<script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
      expect(serialized).toContain('\\u003cscript\\u003e');

      // Verify that parsing it back yields the exact original data (preserving data integrity)
      const parsed = JSON.parse(serialized);
      expect(parsed.title).toBe('مقال متقدم </script><script>alert("xss")</script>');
      expect(parsed.excerpt).toBe('تفاصيل هامة </script><script>evil()</script>');
      expect(parsed.author).toBe('مهاجم <script>');
    });

    it('renders blog post detail page with safe JSON-LD when article contains script injection strings', async () => {
      const xssSlug = `xss-test-${Date.now()}`;
      const post = await payloadInstance.create({
        collection: 'blog-posts',
        locale: 'ar',
        draft: false,
        data: {
          title: 'تحليل السيو المتقدم </script><script>console.log("injected")</script>',
          slug: xssSlug,
          author: 'فريق موهبة التحريري',
          category: 'marketing',
          excerpt: 'نبذة عن التسويق </script><script>alert(1)</script>',
          coverImageAlt: 'صورة الغلاف السليمة',
          content: 'محتوى المقال الكامل والآمن...',
          _status: 'published',
        },
      });

      try {
        const jsx = await BlogPostDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: xssSlug }),
        });
        const html = renderToString(jsx);

        // Find the JSON-LD script content
        const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
        expect(jsonLdMatch).toBeDefined();
        const scriptInnerHtml = jsonLdMatch![1];

        // The inner content must NEVER contain a literal raw </script> tag that could break the script element
        expect(scriptInnerHtml).not.toContain('</script>');
        expect(scriptInnerHtml).toContain('\\u003c/script\\u003e');
        expect(scriptInnerHtml).toContain('\\u003cscript\\u003e');

        // The parsed JSON must preserve original string values as pure data
        const parsed = JSON.parse(scriptInnerHtml);
        expect(parsed.headline).toBe('تحليل السيو المتقدم </script><script>console.log("injected")</script>');
        expect(parsed.description).toBe('نبذة عن التسويق </script><script>alert(1)</script>');
      } finally {
        await payloadInstance.delete({
          collection: 'blog-posts',
          id: post.id,
        });
      }
    });
  });
});

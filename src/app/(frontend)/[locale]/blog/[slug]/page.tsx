import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { draftMode, headers } from 'next/headers';
import Link from 'next/link';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { safeJsonLdReplacer } from '@/shared/lib/safeJsonLd';
import { generateArticleSchema, generateBreadcrumbSchema } from '@/shared/lib/schemaGenerator';
import { getPayloadClient } from '@/lib/payload';
import { hasRole } from '@/modules/identity/access/roles';

interface BlogPostDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: BlogPostDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const payload = await getPayloadClient();

  try {
    const res = await payload.find({
      collection: 'blog-posts',
      where: {
        and: [
          { slug: { equals: slug } },
          { _status: { equals: 'published' } },
        ],
      },
      locale: locale as Locale,
      limit: 1,
    });

    if (res.docs?.[0]) {
      const doc = res.docs[0];
      const title = doc.meta?.title || `${doc.title} | ${isArabic ? 'وكالة موهبة' : 'MWHEBA Agency'}`;
      const description = doc.meta?.description || doc.excerpt || '';

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'article',
          locale: isArabic ? 'ar_EG' : 'en_US',
        },
      };
    }
  } catch (e) {
    // ignore
  }

  return {};
}

export default async function BlogPostDetailPage({ params }: BlogPostDetailPageProps) {
  const { locale, slug } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const isArabic = locale === 'ar';
  const { isEnabled: isDraftModeCookieActive } = await draftMode();
  const payload = await getPayloadClient();

  // Defense-in-depth: Re-verify editor session on draft render
  let isAuthorizedEditor = false;
  if (isDraftModeCookieActive) {
    try {
      const reqHeaders = await headers();
      const { user } = await payload.auth({ headers: reqHeaders });
      if (user && hasRole(user, ['super_admin', 'marketer'])) {
        isAuthorizedEditor = true;
      }
    } catch {
      isAuthorizedEditor = false;
    }
  }

  const shouldServeDraft = isDraftModeCookieActive && isAuthorizedEditor;

  const whereCondition: any = shouldServeDraft
    ? { slug: { equals: slug } }
    : {
        and: [
          { slug: { equals: slug } },
          { _status: { equals: 'published' } },
        ],
      };

  let post: any = null;

  try {
    const res = await payload.find({
      collection: 'blog-posts',
      where: whereCondition,
      locale: locale as Locale,
      draft: shouldServeDraft,
      limit: 1,
    });

    if (res.docs && res.docs.length > 0) {
      const doc = res.docs[0];
      post = {
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        author: doc.author || (isArabic ? 'فريق موهبة التحريري' : 'MWHEBA Editorial Team'),
        publishedAt: doc.publishedAt,
        category: doc.category || 'branding',
        categoryLabel:
          doc.category === 'branding'
            ? isArabic ? 'الهوية البصرية والعلامة التجارية' : 'Branding & Identity'
            : doc.category === 'marketing'
            ? isArabic ? 'التسويق الرقمي واستراتيجيات النمو' : 'Digital Marketing'
            : doc.category === 'merchandise'
            ? isArabic ? 'الهدايا المؤسسية والطباعة' : 'Corporate Gifts & Print'
            : isArabic ? 'الإنتاج الإعلامي والمرئي' : 'Media & Creative Production',
        readingTimeMinutes: doc.readingTimeMinutes || 4,
        excerpt: doc.excerpt,
        coverImageUrl: doc.coverImageUrl || doc.coverImage?.url || '',
        coverImageAlt: doc.coverImageAlt || doc.title,
        content: doc.content,
        tags: doc.tags?.map((t: any) => t.tag) || [],
      };
    }
  } catch (error) {
    console.error('Error fetching blog post:', error);
  }

  // Strict 404 for unapproved, unpublished, or non-existent articles
  if (!post) {
    notFound();
  }

  // Schema.org Article & Breadcrumbs Structured Data (JSON-LD)
  const articleSchema = generateArticleSchema(
    {
      title: post.title,
      description: post.excerpt,
      slug: post.slug,
      publishedAt: post.publishedAt,
      authorName: post.author,
      imageUrl: post.coverImage,
    },
    locale as 'ar' | 'en',
  );

  const breadcrumbsSchema = generateBreadcrumbSchema([
    { name: isArabic ? 'الرئيسية' : 'Home', url: `/${locale}` },
    { name: isArabic ? 'المدونة المعرفية' : 'Knowledge Blog', url: `/${locale}/blog` },
    { name: post.title, url: `/${locale}/blog/${post.slug}` },
  ]);

  return (
    <article className="blog-post-detail-wrapper" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Schema.org Structured Data (Safely encoded to prevent </script> injection) */}
      <script
        type="application/ld+json"
        id="article-jsonld"
        dangerouslySetInnerHTML={{ __html: safeJsonLdReplacer(articleSchema) }}
      />
      <script
        type="application/ld+json"
        id="article-breadcrumbs-jsonld"
        dangerouslySetInnerHTML={{ __html: safeJsonLdReplacer(breadcrumbsSchema) }}
      />

      {/* Draft Mode Active Inspection Banner */}
      {shouldServeDraft && (
        <aside
          role="alert"
          style={{
            backgroundColor: 'var(--status-warning-bg)',
            borderBottom: '1px solid var(--status-warning)',
            padding: '0.75rem 1.5rem',
            fontSize: '0.8125rem',
            color: 'var(--status-warning)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <span>⚠️</span>
            <span>
              {isArabic
                ? 'وضع معاينة المقال (Draft Preview Mode) - أنت تستعرض مسودة مقال غير منشورة للعامة'
                : 'Article Draft Preview Mode - Viewing unpublished draft'}
            </span>
          </div>
          <Link
            href={`/api/exit-preview?redirect=/${locale}/blog/${slug}`}
            style={{
              padding: '0.25rem 0.65rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--status-warning)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-warning)',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.75rem',
            }}
          >
            {isArabic ? 'إنهاء وضع المعاينة ✕' : 'Exit Preview ✕'}
          </Link>
        </aside>
      )}

      {/* Article Header */}
      <header
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          paddingBlock: '4rem 4.5rem',
        }}
      >
        <div className="container" style={{ maxWidth: '850px', marginInline: 'auto', paddingInline: '1.5rem' }}>
          {/* Back Navigation Link */}
          <div style={{ marginBottom: '2rem' }}>
            <Link
              href={`/${locale}/blog`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--brand-primary)',
                textDecoration: 'none',
              }}
            >
              <span aria-hidden="true">{isArabic ? '→' : '←'}</span>
              <span>{isArabic ? 'العودة لجميع المقالات والرؤى' : 'Back to All Articles'}</span>
            </Link>
          </div>

          {/* Metadata Row: Category & Reading Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-primary-dark)',
                color: 'var(--text-inverted)',
                fontSize: '0.8125rem',
                fontWeight: 700,
              }}
            >
              {post.categoryLabel}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {isArabic ? `⏱️ ${post.readingTimeMinutes} دقائق قراءة` : `⏱️ ${post.readingTimeMinutes} min read`}
            </span>
            {post.publishedAt && (
              <>
                <span style={{ color: 'var(--border-strong)' }}>•</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{post.publishedAt}</span>
              </>
            )}
          </div>

          {/* Article Title */}
          <h1
            style={{
              fontSize: 'clamp(2.1rem, 4.5vw, 3.2rem)',
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: 'var(--brand-primary-dark)',
              margin: '0 0 1.5rem',
            }}
          >
            {post.title}
          </h1>

          {/* Author Byline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {isArabic ? `بقلم: ${post.author}` : `By ${post.author}`}
            </span>
          </div>
        </div>
      </header>

      {/* Article Content Area */}
      <main className="container" style={{ maxWidth: '850px', marginInline: 'auto', paddingInline: '1.5rem', paddingBlock: '4rem 6rem' }}>
        {/* Cover Image */}
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-muted)',
            marginBottom: '3rem',
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {post.coverImageUrl ? (
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{post.coverImageAlt}</p>
            </div>
          )}
        </div>

        {/* Executive Excerpt Callout */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderInlineStart: '4px solid var(--brand-primary)',
            padding: '1.5rem 1.75rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '3rem',
            fontSize: '1.125rem',
            lineHeight: 1.75,
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {post.excerpt}
        </div>

        {/* Full Article Body */}
        <div
          style={{
            fontSize: '1.125rem',
            lineHeight: 1.9,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-line',
            marginBottom: '4rem',
          }}
        >
          {post.content}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingBlock: '1.5rem',
              borderTop: '1px solid var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '3.5rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginInlineEnd: '0.5rem' }}>
              {isArabic ? 'الكلمات المفتاحية:' : 'Tags:'}
            </span>
            {post.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                style={{
                  padding: '0.25rem 0.65rem',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Author Bio Box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '2rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '4rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary)',
              color: 'var(--text-inverted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            M
          </div>
          <div>
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {post.author}
            </h4>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              {isArabic
                ? 'فريق الاستشارات التحريرية والتحليل الاستراتيجي في وكالة موهبة للدعاية والإعلان.'
                : 'Strategic research and creative editorial team at MWHEBA Agency.'}
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            borderTop: '1px solid var(--border-default)',
            paddingTop: '2.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <Link
            href={`/${locale}/blog`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--brand-primary)',
              textDecoration: 'none',
            }}
          >
            <span aria-hidden="true">{isArabic ? '→' : '←'}</span>
            <span>{isArabic ? 'العودة لجميع المقالات' : 'Back to All Articles'}</span>
          </Link>

          <Link
            href={`/${locale}/contact`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--brand-primary)',
              color: 'var(--text-inverted)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            {isArabic ? 'تواصل مع فريقنا' : 'Connect with Us'}
          </Link>
        </div>
      </main>
    </article>
  );
}

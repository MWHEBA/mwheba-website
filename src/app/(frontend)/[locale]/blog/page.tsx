import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { BlogListingView, type BlogPostItem } from '@/modules/content/ui/BlogListingView';

interface BlogPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'المدونة والرؤى التسويقية | وكالة موهبة'
    : 'Agency Insights & Blog | MWHEBA Agency';
  const description = isArabic
    ? 'مقالات متخصصة وتحليلات استراتيجية في بناء الهوية المؤسسية، التسويق الرقمي، الهدايا الدعائية، والإنتاج المرئي في مصر والشرق الأوسط.'
    : 'Strategic insights, corporate branding trends, marketing ROI analyses, and creative production thought leadership from MWHEBA Agency.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: isArabic ? 'ar_EG' : 'en_US',
    },
  };
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const isArabic = locale === 'ar';
  const payload = await getPayloadClient();

  let posts: BlogPostItem[] = [];

  try {
    const res = await payload.find({
      collection: 'blog-posts',
      where: {
        _status: { equals: 'published' },
      },
      locale: locale as Locale,
      sort: '-createdAt',
      limit: 50,
    });

    if (res.docs && res.docs.length > 0) {
      posts = res.docs.map((doc: any) => ({
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        author: doc.author || (isArabic ? 'فريق موهبة التحريري' : 'MWHEBA Editorial Team'),
        publishedAt: doc.publishedAt,
        category: doc.category || 'branding',
        readingTimeMinutes: doc.readingTimeMinutes || 4,
        excerpt: doc.excerpt,
        coverImageUrl: doc.coverImageUrl || doc.coverImage?.url || '',
        coverImageAlt: doc.coverImageAlt || doc.title,
        tags: doc.tags?.map((t: any) => ({ tag: t.tag })) || [],
      }));
    }
  } catch (error) {
    console.error('Error querying blog posts:', error);
  }

  return (
    <div className="blog-page-wrapper" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header Banner */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          paddingBlock: '4.5rem 4rem',
        }}
      >
        <div className="container" style={{ maxWidth: '1000px', marginInline: 'auto', textAlign: 'center', paddingInline: '1.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--brand-primary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            {isArabic ? 'الرؤى والتحليلات الاستراتيجية' : 'Strategic Insights & Thought Leadership'}
          </span>
          <h1
            style={{
              fontSize: 'clamp(2.15rem, 5vw, 3.25rem)',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: 'var(--brand-primary-dark)',
              margin: '0 0 1.25rem',
            }}
          >
            {isArabic ? 'المدونة والرؤى المعرفية' : 'Agency Insights & Blog'}
          </h1>
          <p
            style={{
              fontSize: '1.125rem',
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: '750px',
              marginInline: 'auto',
              marginBlock: 0,
            }}
          >
            {isArabic
              ? 'مقالات متخصصة ودراسات تحليلية يقدمها خبراؤنا في الهوية التجارية، التسويق الرقمي، الهدايا المؤسسية، واستراتيجيات التوسع في السوق المصري والإقليمي.'
              : 'Actionable analyses, design systems perspectives, and commercial marketing strategies delivered by MWHEBA creative specialists.'}
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container" style={{ maxWidth: '1200px', marginInline: 'auto', paddingInline: '1.5rem' }}>
        {posts.length === 0 ? (
          <div
            data-testid="blog-empty-state"
            style={{
              textAlign: 'center',
              padding: '5rem 1.5rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '640px',
              marginInline: 'auto',
              marginBlock: '3.5rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            >
              {isArabic ? 'لا توجد مقالات منشورة حاليًا' : 'No Published Articles Currently'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              {isArabic
                ? 'يتم حالياً إعداد وتحرير مقالات متخصصة عبر لوحة الإدارة تمهيداً لنشرها للعامة.'
                : 'Articles and research pieces are currently being curated in the CMS.'}
            </p>
          </div>
        ) : (
          <BlogListingView locale={locale} posts={posts} />
        )}
      </main>

      {/* Bottom CTA Section */}
      <section
        style={{
          backgroundColor: 'var(--bg-dark)',
          color: 'var(--text-inverted)',
          paddingBlock: '5rem',
          textAlign: 'center',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <div className="container" style={{ maxWidth: '750px', marginInline: 'auto', paddingInline: '1.5rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              lineHeight: 1.25,
              color: 'var(--text-inverted)',
              margin: '0 0 1.25rem',
            }}
          >
            {isArabic ? 'هل تبحث عن استراتيجية تسويقية مخصصة لشركتك؟' : 'Looking for a Tailored Marketing Strategy?'}
          </h2>
          <p
            style={{
              fontSize: '1.0625rem',
              lineHeight: 1.7,
              color: 'var(--text-inverted-muted)',
              marginBottom: '2.25rem',
            }}
          >
            {isArabic
              ? 'تواصل مع فريقنا الاستشاري لبحث متطلبات علامتك التجارية، أو تصفح معرض أعمالنا ودراسات الحالة.'
              : 'Consult with our senior specialists or explore our verified portfolio and corporate case studies.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href={`/${locale}/contact`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.875rem 1.75rem',
                backgroundColor: 'var(--brand-primary-light)',
                color: 'var(--text-inverted)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                textDecoration: 'none',
              }}
            >
              {isArabic ? 'تواصل معنا الآن' : 'Contact Our Team'}
            </Link>
            <Link
              href={`/${locale}/portfolio`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.875rem 1.75rem',
                backgroundColor: 'transparent',
                color: 'var(--text-inverted)',
                border: '1px solid var(--text-inverted-muted)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                textDecoration: 'none',
              }}
            >
              {isArabic ? 'استعرض أعمالنا' : 'Explore Case Studies'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

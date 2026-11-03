import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { PortfolioView, type PortfolioItem } from '@/modules/content/ui/PortfolioView';

interface PortfolioPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PortfolioPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'أعمالنا ودراسات الحالة | وكالة موهبة'
    : 'Our Portfolio & Case Studies | MWHEBA Agency';
  const description = isArabic
    ? 'استكشف مشروعاتنا وقصص نجاح عملائنا في الهوية البصرية، التسويق الرقمي، الهدايا المؤسسية، والإنتاج المرئي في مصر والشرق الأوسط.'
    : 'Explore our client transformations across corporate branding, digital marketing, executive merchandise, and video production in Egypt and the MENA region.';

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

export default async function PortfolioPage({ params }: PortfolioPageProps) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const isArabic = locale === 'ar';
  const payload = await getPayloadClient();

  let projects: PortfolioItem[] = [];

  try {
    const res = await payload.find({
      collection: 'portfolio-projects',
      where: {
        _status: { equals: 'published' },
      },
      locale: locale as Locale,
      sort: '-createdAt',
      limit: 50,
    });

    if (res.docs && res.docs.length > 0) {
      projects = res.docs.map((doc: any) => ({
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        clientName: doc.clientName,
        industry: doc.industry,
        serviceCategory: doc.serviceCategory || 'branding',
        projectDate: doc.projectDate,
        featured: doc.featured,
        summary: doc.summary,
        coverImageUrl: doc.coverImageUrl || doc.coverImage?.url || '',
        coverImageAlt: doc.coverImageAlt || doc.title,
        deliverables: doc.deliverables?.map((d: any) => ({ item: d.item })) || [],
        results: doc.results?.map((r: any) => ({ metric: r.metric, label: r.label })) || [],
      }));
    }
  } catch (error) {
    console.error('Error querying portfolio projects:', error);
  }

  return (
    <div className="portfolio-page-wrapper" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
            {isArabic ? 'سجل الإنجاز والتحول المؤسسي' : 'Proven Track Record & Client ROI'}
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
            {isArabic ? 'أعمالنا ودراسات الحالة' : 'Portfolio & Case Studies'}
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
              ? 'نماذج واقعية من شراكاتنا مع الشركات والمؤسسات لتطوير الهوية التجارية، وتصنيع الهدايا الترويجية الراقية، وقيادة حملات التسويق الرقمي.'
              : 'Measurable impact delivered for forward-thinking enterprises across branding, executive merchandise, and growth marketing campaigns.'}
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container" style={{ maxWidth: '1200px', marginInline: 'auto', paddingInline: '1.5rem' }}>
        {projects.length === 0 ? (
          <div
            data-testid="portfolio-empty-state"
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
              {isArabic ? 'لا توجد دراسات حالة منشورة حاليًا' : 'No Published Case Studies Currently'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              {isArabic
                ? 'يتم حالياً مراجعة وتوثيق المشاريع المعتمدة عبر لوحة الإدارة تمهيداً لنشرها للعامة.'
                : 'Approved case studies and portfolio records are currently being curated in the CMS.'}
            </p>
          </div>
        ) : (
          <PortfolioView locale={locale} projects={projects} />
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
            {isArabic ? 'هل أنت مستعد لبدء قصة نجاح علامتك التالية؟' : 'Ready to Craft Your Next Brand Success Story?'}
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
              ? 'تواصل مع فريقنا الاستشاري لبحث متطلبات علامتك التجارية، أو تصفح متجرنا للهدايا المؤسسية المخصصة.'
              : 'Consult with our senior creative and marketing team or browse our catalog of precision-customized corporate merchandise.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href={`/${locale}/store`}
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
              {isArabic ? 'استكشف متجر الهدايا المؤسسية' : 'Explore Corporate Merchandise'}
            </Link>
            <Link
              href={`/${locale}/contact`}
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
              {isArabic ? 'طلب استشارة مخصصة' : 'Request a Custom Consultation'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

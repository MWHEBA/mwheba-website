import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { draftMode, headers } from 'next/headers';
import Link from 'next/link';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { hasRole } from '@/modules/identity/access/roles';

interface CaseStudyPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const payload = await getPayloadClient();

  try {
    const res = await payload.find({
      collection: 'portfolio-projects',
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
      const title = `${doc.title} | ${isArabic ? 'وكالة موهبة' : 'MWHEBA Agency'}`;
      const description = doc.summary || '';

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

export default async function CaseStudyDetailPage({ params }: CaseStudyPageProps) {
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

  let project: any = null;

  try {
    const res = await payload.find({
      collection: 'portfolio-projects',
      where: whereCondition,
      locale: locale as Locale,
      draft: shouldServeDraft,
      limit: 1,
    });

    if (res.docs && res.docs.length > 0) {
      const doc = res.docs[0];
      project = {
        title: doc.title,
        clientName: doc.clientName,
        industry: doc.industry,
        serviceCategory: doc.serviceCategory,
        categoryLabel:
          doc.serviceCategory === 'branding'
            ? isArabic ? 'الهوية البصرية' : 'Branding & Identity'
            : doc.serviceCategory === 'digital_marketing'
            ? isArabic ? 'التسويق الرقمي' : 'Digital Marketing'
            : doc.serviceCategory === 'corporate_gifts'
            ? isArabic ? 'الهدايا المؤسسية' : 'Corporate Gifts'
            : isArabic ? 'الإنتاج المرئي' : 'Media Production',
        projectDate: doc.projectDate,
        summary: doc.summary,
        coverImageUrl: doc.coverImageUrl || doc.coverImage?.url || '',
        coverImageAlt: doc.coverImageAlt || doc.title,
        results: doc.results?.map((r: any) => ({ metric: r.metric, label: r.label })) || [],
        deliverables: doc.deliverables?.map((d: any) => ({ item: d.item })) || [],
        narrative: doc.narrative,
        gallery: doc.gallery?.map((g: any) => ({
          imageUrl: g.imageUrl || g.image?.url || '',
          alt: g.alt || doc.title,
          caption: g.caption || '',
        })) || [],
      };
    }
  } catch (error) {
    console.error('Error fetching case study project:', error);
  }

  // Strict 404 for unapproved, unpublished, or non-existent projects
  if (!project) {
    notFound();
  }

  return (
    <article className="case-study-page-wrapper" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
                ? 'وضع معاينة دراسة الحالة (Draft Preview Mode) - أنت تستعرض مسودة غير منشورة للعامة'
                : 'Case Study Draft Preview Mode - Viewing unpublished draft'}
            </span>
          </div>
          <Link
            href={`/api/exit-preview?redirect=/${locale}/portfolio/${slug}`}
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

      {/* Case Study Header */}
      <header
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          paddingBlock: '4rem 4.5rem',
        }}
      >
        <div className="container" style={{ maxWidth: '960px', marginInline: 'auto', paddingInline: '1.5rem' }}>
          {/* Back Navigation Link */}
          <div style={{ marginBottom: '2rem' }}>
            <Link
              href={`/${locale}/portfolio`}
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
              <span>{isArabic ? 'العودة لجميع الأعمال ودراسات الحالة' : 'Back to All Case Studies'}</span>
            </Link>
          </div>

          {/* Metadata Row: Category & Client */}
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
              {project.categoryLabel}
            </span>
            <span
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {project.clientName}
            </span>
            {project.projectDate && (
              <>
                <span style={{ color: 'var(--border-strong)' }}>•</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{project.projectDate}</span>
              </>
            )}
          </div>

          {/* Case Study Title */}
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
            {project.title}
          </h1>

          {/* Executive Summary */}
          <p
            style={{
              fontSize: '1.1875rem',
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {project.summary}
          </p>
        </div>
      </header>

      {/* Case Study Body & Sections */}
      <main className="container" style={{ maxWidth: '960px', marginInline: 'auto', paddingInline: '1.5rem', paddingBlock: '4rem 6rem' }}>
        {/* Visual Cover Asset */}
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-muted)',
            marginBottom: '4rem',
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {project.coverImageUrl ? (
            <img
              src={project.coverImageUrl}
              alt={project.coverImageAlt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{project.coverImageAlt}</p>
            </div>
          )}
        </div>

        {/* Results & Metrics Grid */}
        {project.results && project.results.length > 0 && (
          <section
            aria-labelledby="case-study-results-heading"
            style={{
              marginBottom: '4.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '2.5rem 2rem',
            }}
          >
            <h2
              id="case-study-results-heading"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--brand-primary-dark)',
                margin: '0 0 2rem',
                textAlign: 'center',
              }}
            >
              {isArabic ? 'النتائج المحققة ومؤشرات الأداء' : 'Measurable Impact & Key Results'}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
                gap: '2rem',
                textAlign: 'center',
              }}
            >
              {project.results.map((r: any, idx: number) => (
                <div key={idx} style={{ padding: '1rem' }}>
                  <div
                    style={{
                      fontSize: 'clamp(2.25rem, 5vw, 3rem)',
                      fontWeight: 700,
                      color: 'var(--brand-primary)',
                      lineHeight: 1,
                      marginBottom: '0.75rem',
                    }}
                  >
                    {r.metric}
                  </div>
                  <div
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {r.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Deliverables List */}
        {project.deliverables && project.deliverables.length > 0 && (
          <section
            aria-labelledby="case-study-deliverables-heading"
            style={{ marginBottom: '4.5rem' }}
          >
            <h2
              id="case-study-deliverables-heading"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
              }}
            >
              {isArabic ? 'مخرجات المشروع ونطاق التنفيذ' : 'Project Deliverables & Scope'}
            </h2>
            <ul
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1rem',
                padding: 0,
                listStyle: 'none',
                margin: 0,
              }}
            >
              {project.deliverables.map((d: any, idx: number) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--status-success)',
                      fontWeight: 700,
                      fontSize: '1.125rem',
                    }}
                  >
                    ✓
                  </span>
                  <span>{d.item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Strategic Narrative Story */}
        {project.narrative && (
          <section
            aria-labelledby="case-study-narrative-heading"
            style={{ marginBottom: '4.5rem' }}
          >
            <h2
              id="case-study-narrative-heading"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
              }}
            >
              {isArabic ? 'قصة التحول والاستراتيجية المنفذة' : 'Strategic Transformation Story'}
            </h2>
            <div
              style={{
                fontSize: '1.0625rem',
                lineHeight: 1.85,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-line',
              }}
            >
              {project.narrative}
            </div>
          </section>
        )}

        {/* Visual Gallery */}
        {project.gallery && project.gallery.length > 0 && (
          <section
            aria-labelledby="case-study-gallery-heading"
            style={{ marginBottom: '4.5rem' }}
          >
            <h2
              id="case-study-gallery-heading"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
              }}
            >
              {isArabic ? 'معرض الصور والمخرجات المرئية' : 'Visual Gallery & Assets'}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '2rem',
              }}
            >
              {project.gallery.map((g: any, idx: number) => (
                <figure
                  key={idx}
                  style={{
                    margin: 0,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '16/10',
                      backgroundColor: 'var(--bg-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {g.imageUrl ? (
                      <img
                        src={g.imageUrl}
                        alt={g.alt}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {g.alt}
                      </span>
                    )}
                  </div>
                  {g.caption && (
                    <figcaption
                      style={{
                        padding: '1rem',
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        borderTop: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-secondary)',
                      }}
                    >
                      {g.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Back Link & Bottom Action */}
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
            href={`/${locale}/portfolio`}
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
            <span>{isArabic ? 'العودة لجميع المشروعات' : 'Back to All Projects'}</span>
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
            {isArabic ? 'ابدأ مشروعك معنا' : 'Start Your Project With Us'}
          </Link>
        </div>
      </main>
    </article>
  );
}

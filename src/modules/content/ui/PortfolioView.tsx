'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export interface PortfolioItem {
  id: string | number;
  slug: string;
  title: string;
  clientName: string;
  industry?: string;
  serviceCategory: 'branding' | 'digital_marketing' | 'corporate_gifts' | 'media_production';
  projectDate?: string;
  featured?: boolean;
  summary: string;
  coverImageUrl?: string;
  coverImageAlt: string;
  deliverables?: Array<{ item: string }>;
  results?: Array<{ metric: string; label: string }>;
}

interface PortfolioViewProps {
  locale: string;
  projects: PortfolioItem[];
}

export function PortfolioView({ locale, projects }: PortfolioViewProps) {
  const isArabic = locale === 'ar';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => [
    { id: 'all', label: isArabic ? 'جميع المشاريع' : 'All Projects' },
    { id: 'branding', label: isArabic ? 'الهوية البصرية' : 'Branding & Identity' },
    { id: 'digital_marketing', label: isArabic ? 'التسويق الرقمي' : 'Digital Marketing' },
    { id: 'corporate_gifts', label: isArabic ? 'الهدايا والمطبوعات' : 'Corporate Gifts' },
    { id: 'media_production', label: isArabic ? 'الإنتاج المرئي' : 'Media Production' },
  ], [isArabic]);

  const filteredProjects = useMemo(() => {
    if (selectedCategory === 'all') return projects;
    return projects.filter((p) => p.serviceCategory === selectedCategory);
  }, [projects, selectedCategory]);

  return (
    <div className="portfolio-showcase-container" style={{ paddingBlock: '3rem 5rem' }}>
      {/* Category Filter Pills */}
      <div
        role="tablist"
        aria-label={isArabic ? 'تصفية المشاريع حسب التصنيف' : 'Filter projects by category'}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.625rem',
          justifyContent: 'center',
          marginBottom: '3rem',
        }}
      >
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          const count = cat.id === 'all'
            ? projects.length
            : projects.filter((p) => p.serviceCategory === cat.id).length;

          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: isActive ? 'var(--brand-primary)' : 'var(--border-default)',
                backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--bg-surface)',
                color: isActive ? 'var(--text-inverted)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
              }}
            >
              <span>{cat.label}</span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.125rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--brand-primary-hover)' : 'var(--bg-muted)',
                  color: isActive ? 'var(--text-inverted)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            maxWidth: '600px',
            marginInline: 'auto',
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
            {isArabic
              ? 'لا توجد مشاريع مسجلة في هذا التصنيف حاليًا.'
              : 'No projects registered in this category at this time.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '2rem',
          }}
        >
          {filteredProjects.map((project) => {
            const projectHref = `/${locale}/portfolio/${project.slug}`;
            const primaryResult = project.results?.[0];

            return (
              <article
                key={project.id}
                data-testid={`portfolio-card-${project.slug}`}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.2s ease, transform 0.2s ease',
                }}
              >
                {/* Visual Cover Asset */}
                <Link
                  href={projectHref}
                  style={{
                    display: 'block',
                    aspectRatio: '16/10',
                    backgroundColor: 'var(--bg-muted)',
                    position: 'relative',
                    overflow: 'hidden',
                    textDecoration: 'none',
                  }}
                >
                  {project.coverImageUrl ? (
                    <img
                      src={project.coverImageUrl}
                      alt={project.coverImageAlt}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-muted)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        padding: '1.5rem',
                        textAlign: 'center',
                      }}
                    >
                      <span>{project.coverImageAlt}</span>
                    </div>
                  )}

                  {/* Category Pill Tag */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '0.85rem',
                      insetInlineEnd: '0.85rem',
                      padding: '0.3rem 0.65rem',
                      backgroundColor: 'var(--brand-primary-dark)',
                      color: 'var(--text-inverted)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-sm)',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {project.serviceCategory === 'branding' && (isArabic ? 'هوية بصرية' : 'Branding')}
                    {project.serviceCategory === 'digital_marketing' && (isArabic ? 'تسويق رقمي' : 'Marketing')}
                    {project.serviceCategory === 'corporate_gifts' && (isArabic ? 'هدايا مؤسسية' : 'Corporate Gifts')}
                    {project.serviceCategory === 'media_production' && (isArabic ? 'إنتاج مرئي' : 'Media')}
                  </span>
                </Link>

                {/* Card Content */}
                <div
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                  }}
                >
                  {/* Client & Industry Label */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    <span>{project.clientName}</span>
                    {project.industry && <span>{project.industry}</span>}
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: '1.1875rem',
                      fontWeight: 700,
                      lineHeight: 1.35,
                      margin: '0 0 0.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Link
                      href={projectHref}
                      style={{
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      {project.title}
                    </Link>
                  </h3>

                  {/* Summary */}
                  <p
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      color: 'var(--text-secondary)',
                      margin: '0 0 1.25rem',
                      flexGrow: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {project.summary}
                  </p>

                  {/* Metric Result Highlight (if available) */}
                  {primaryResult && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '1.125rem',
                          color: 'var(--brand-primary)',
                        }}
                      >
                        {primaryResult.metric}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {primaryResult.label}
                      </span>
                    </div>
                  )}

                  {/* Deliverables Tags */}
                  {project.deliverables && project.deliverables.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.375rem',
                        marginBottom: '1.25rem',
                      }}
                    >
                      {project.deliverables.slice(0, 3).map((d, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.2rem 0.5rem',
                            backgroundColor: 'var(--bg-muted)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                          }}
                        >
                          {d.item}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Link */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '1rem',
                      marginTop: 'auto',
                    }}
                  >
                    <Link
                      href={projectHref}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: 'var(--brand-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      <span>{isArabic ? 'استعراض دراسة الحالة' : 'View Case Study'}</span>
                      <span aria-hidden="true">{isArabic ? '←' : '→'}</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

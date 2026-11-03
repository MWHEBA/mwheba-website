'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export interface BlogPostItem {
  id: string | number;
  slug: string;
  title: string;
  author: string;
  publishedAt?: string;
  category: 'branding' | 'marketing' | 'merchandise' | 'media';
  readingTimeMinutes?: number;
  excerpt: string;
  coverImageUrl?: string;
  coverImageAlt: string;
  tags?: Array<{ tag: string }>;
}

interface BlogListingViewProps {
  locale: string;
  posts: BlogPostItem[];
}

export function BlogListingView({ locale, posts }: BlogListingViewProps) {
  const isArabic = locale === 'ar';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(
    () => [
      { id: 'all', label: isArabic ? 'جميع المقالات' : 'All Articles' },
      { id: 'branding', label: isArabic ? 'الهوية البصرية' : 'Branding & Identity' },
      { id: 'marketing', label: isArabic ? 'التسويق الرقمي' : 'Digital Marketing' },
      { id: 'merchandise', label: isArabic ? 'الهدايا والطباعة' : 'Corporate Gifts' },
      { id: 'media', label: isArabic ? 'الإنتاج المرئي' : 'Media Production' },
    ],
    [isArabic]
  );

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'all') return posts;
    return posts.filter((p) => p.category === selectedCategory);
  }, [posts, selectedCategory]);

  return (
    <div className="blog-listing-container" style={{ paddingBlock: '3rem 5rem' }}>
      {/* Category Filter Pills */}
      <div
        role="tablist"
        aria-label={isArabic ? 'تصفية المقالات حسب الموضوع' : 'Filter articles by topic'}
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
          const count =
            cat.id === 'all'
              ? posts.length
              : posts.filter((p) => p.category === cat.id).length;

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

      {/* Articles Grid */}
      {filteredPosts.length === 0 ? (
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
            {isArabic ? 'لا توجد مقالات منشورة في هذا التصنيف حاليًا' : 'No Published Articles in This Topic'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
            {isArabic
              ? 'يتم حالياً إعداد وتحرير مقالات متخصصة في هذا المجال تمهيداً لنشرها للعامة.'
              : 'Articles and research pieces in this category are currently being curated in the CMS.'}
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
          {filteredPosts.map((post) => {
            const postHref = `/${locale}/blog/${post.slug}`;
            const readingTime = post.readingTimeMinutes || 4;

            return (
              <article
                key={post.id}
                data-testid={`blog-card-${post.slug}`}
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
                  href={postHref}
                  style={{
                    display: 'block',
                    aspectRatio: '16/10',
                    backgroundColor: 'var(--bg-muted)',
                    position: 'relative',
                    overflow: 'hidden',
                    textDecoration: 'none',
                  }}
                >
                  {post.coverImageUrl ? (
                    <img
                      src={post.coverImageUrl}
                      alt={post.coverImageAlt}
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
                      <span>{post.coverImageAlt}</span>
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
                    {post.category === 'branding' && (isArabic ? 'هوية بصرية' : 'Branding')}
                    {post.category === 'marketing' && (isArabic ? 'تسويق رقمي' : 'Marketing')}
                    {post.category === 'merchandise' && (isArabic ? 'هدايا وطباعة' : 'Merchandise')}
                    {post.category === 'media' && (isArabic ? 'إنتاج مرئي' : 'Media')}
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
                  {/* Meta: Reading time & Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.65rem',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      {isArabic ? `⏱️ ${readingTime} دقائق قراءة` : `⏱️ ${readingTime} min read`}
                    </span>
                    {post.publishedAt && (
                      <>
                        <span style={{ color: 'var(--border-strong)' }}>•</span>
                        <span>{post.publishedAt}</span>
                      </>
                    )}
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
                      href={postHref}
                      style={{
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      {post.title}
                    </Link>
                  </h3>

                  {/* Excerpt */}
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
                    {post.excerpt}
                  </p>

                  {/* Author & Read Link */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '1rem',
                      marginTop: 'auto',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {post.author}
                    </span>
                    <Link
                      href={postHref}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: 'var(--brand-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      <span>{isArabic ? 'قراءة المقال' : 'Read Article'}</span>
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

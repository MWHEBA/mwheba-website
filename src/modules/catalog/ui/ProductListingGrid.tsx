import React from 'react';
import Link from 'next/link';
import { Badge } from '@/shared/ui/primitives';
import type { Locale } from '@/shared/lib/i18n';
import { CATALOG_SEARCH_MAX_LENGTH, catalogHref } from '../services/catalogFilters';
import type { PublicCatalogTerm, PublishedCatalog } from '../services/publishedCatalog';

interface ProductListingGridProps {
  locale: Locale;
  catalog: PublishedCatalog;
}

interface TaxonomyFilterProps {
  label: string;
  allLabel: string;
  terms: PublicCatalogTerm[];
  selected?: string;
  getHref: (slug?: string) => string;
}

function TaxonomyFilter({ label, allLabel, terms, selected, getHref }: TaxonomyFilterProps) {
  if (terms.length === 0) return null;

  return (
    <nav aria-label={label}>
      <p style={{ fontWeight: 700, marginBlock: '0 0.5rem' }}>{label}</p>
      <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', margin: 0, padding: 0 }}>
        {[{ id: 0, slug: undefined, title: allLabel }, ...terms].map(({ id, slug, title }) => (
          <li key={id}>
            <Link
              href={getHref(slug)}
              prefetch={false}
              aria-current={selected === slug ? 'true' : undefined}
              className={`${selected === slug ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            >
              {title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ProductListingGrid({ locale, catalog }: ProductListingGridProps) {
  const isArabic = locale === 'ar';
  const { products, categories, tags, filters, invalid, totalDocs, totalPages, page } = catalog;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const currency = new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' });
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="container" style={{ paddingBlock: '3.5rem 6rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', marginBlock: '0 1rem' }}>
          {isArabic ? 'هدايا الشركات والحلول المخصصة' : 'Corporate Merchandise & B2B Solutions'}
        </h1>
      </header>

      <section
        aria-label={isArabic ? 'تصفية المنتجات' : 'Filter products'}
        style={{
          display: 'grid',
          gap: '1rem',
          marginBottom: '2.5rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)',
        }}
      >
        <TaxonomyFilter
          label={isArabic ? 'الفئات' : 'Categories'}
          allLabel={isArabic ? 'كل الفئات' : 'All categories'}
          terms={categories}
          selected={filters.category}
          getHref={(category) => catalogHref(locale, { ...filters, category, page: 1 })}
        />
        <TaxonomyFilter
          label={isArabic ? 'الوسوم' : 'Tags'}
          allLabel={isArabic ? 'كل الوسوم' : 'All tags'}
          terms={tags}
          selected={filters.tag}
          getHref={(tag) => catalogHref(locale, { ...filters, tag, page: 1 })}
        />
        <form action={catalogHref(locale)} method="get" role="search">
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
          <label htmlFor="catalog-search" style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>
            {isArabic ? 'بحث في المنتجات' : 'Search products'}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              key={filters.q}
              id="catalog-search"
              className="form-input"
              type="search"
              name="q"
              defaultValue={filters.q}
              maxLength={CATALOG_SEARCH_MAX_LENGTH}
              required
              style={{ width: 'min(100%, 22rem)' }}
            />
            <button type="submit" className="btn-primary btn-md">{isArabic ? 'بحث' : 'Search'}</button>
            {filters.q && (
              <Link href={catalogHref(locale, { ...filters, q: undefined, page: 1 })} className="btn-secondary btn-md">
                {isArabic ? 'مسح البحث' : 'Clear search'}
              </Link>
            )}
          </div>
        </form>
      </section>

      {products.length > 0 ? (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBlock: '0 1rem' }}>
            {isArabic ? `عدد النتائج: ${number.format(totalDocs)}` : `Results: ${number.format(totalDocs)}`}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))', gap: '1.5rem' }}>
            {products.map((product) => {
              const isPhysical = product.productType === 'physical';
              const category = typeof product.category === 'number' ? categoryById.get(product.category) : undefined;
              const image = product.media[0];
              return (
                <article
                  key={product.id}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-subtle)',
                  }}
                >
                  <div>
                    {image && (
                      <div style={{ aspectRatio: '4 / 3', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '1rem' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt={image.alt || product.title}
                          width={image.width ?? undefined}
                          height={image.height ?? undefined}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                      {category && <Badge variant="neutral">{category.title}</Badge>}
                      {!isPhysical && <Badge variant="success">{isArabic ? 'خدمة مؤسسية' : 'Service'}</Badge>}
                      {isPhysical && product.minOrderQuantity > 1 && (
                        <Badge variant="warning">
                          {isArabic ? `الحد الأدنى: ${number.format(product.minOrderQuantity)} قطعة` : `MOQ: ${number.format(product.minOrderQuantity)} units`}
                        </Badge>
                      )}
                    </div>
                    <h2 style={{ fontSize: '1.125rem', color: 'var(--brand-primary-dark)', marginBlock: '0 0.5rem' }}>
                      {product.title}
                    </h2>
                    {product.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                        {product.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    {product.price !== null && (
                      <div>
                        {product.enableVariants && <span>{isArabic ? 'يبدأ من' : 'From'} </span>}
                        <strong><bdi>{currency.format(product.price)}</bdi></strong>
                        {isPhysical && !product.enableVariants && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {isArabic ? 'سعر القطعة' : 'Unit price'}
                          </div>
                        )}
                      </div>
                    )}
                    <Link href={`/${locale}/store/${encodeURIComponent(product.slug)}`} className="btn-primary btn-sm">
                      {isArabic ? 'عرض التفاصيل' : 'View details'}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <section aria-label={isArabic ? 'نتائج المنتجات' : 'Product results'}>
          <h2>
            {invalid
              ? (isArabic ? 'أحد عوامل التصفية غير صالح أو غير متاح' : 'A filter is invalid or unavailable')
              : (isArabic ? 'لا توجد منتجات مطابقة' : 'No matching products')}
          </h2>
          {(invalid || filters.category || filters.tag || filters.q || page > 1) && (
            <Link href={catalogHref(locale)} className="btn-secondary btn-md">
              {isArabic ? 'عرض كل المنتجات' : 'View all products'}
            </Link>
          )}
        </section>
      )}
      {totalPages > 1 && page <= totalPages && (
        <nav aria-label={isArabic ? 'صفحات المنتجات' : 'Product pages'} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '2rem' }}>
          {page > 1 && (
            <Link href={catalogHref(locale, { ...filters, page: page - 1 })} rel="prev" className="btn-secondary btn-md">
              {isArabic ? 'السابقة' : 'Previous'}
            </Link>
          )}
          <span>
            {isArabic ? `صفحة ${number.format(page)} من ${number.format(totalPages)}` : `Page ${number.format(page)} of ${number.format(totalPages)}`}
          </span>
          {page < totalPages && (
            <Link href={catalogHref(locale, { ...filters, page: page + 1 })} rel="next" className="btn-secondary btn-md">
              {isArabic ? 'التالية' : 'Next'}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

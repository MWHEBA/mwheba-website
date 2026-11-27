import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import { CATALOG_FILTER_KEYS, type CatalogSearchParams } from '@/modules/catalog/services/catalogFilters';
import { readPublishedCatalog } from '@/modules/catalog/services/publishedCatalog';
import { ProductListingGrid } from '@/modules/catalog/ui/ProductListingGrid';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { buildBilingualMetadata } from '@/shared/lib/seo';

interface StorePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
}

export async function generateMetadata({
  params,
  searchParams,
}: StorePageProps): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const metadata = buildBilingualMetadata({
    locale,
    path: '/store',
    title: isArabic
      ? 'متجر هدايا الشركات والمطبوعات المؤسسية'
      : 'Corporate Giveaways & B2B Merchandise',
    description: isArabic
      ? 'تصفح كتالوج هدايا ومطبوعات الشركات والخدمات المؤسسية من وكالة موهبة.'
      : 'Browse MWHEBA’s catalog of corporate giveaways, stationery, and business services.',
  });
  if (CATALOG_FILTER_KEYS.some((key) => query[key] !== undefined)) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
}

async function StoreResults({ locale, query }: { locale: Locale; query: CatalogSearchParams }) {
  const payload = await getPayloadClient();
  const catalog = await readPublishedCatalog(payload, locale, query);
  return <ProductListingGrid locale={locale} catalog={catalog} />;
}

export default async function StorePage({ params, searchParams }: StorePageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isValidLocale(locale)) notFound();

  const loading = (
    <p className="container" style={{ paddingBlock: '3.5rem 6rem' }} role="status">
      {locale === 'ar' ? 'جارٍ تحميل المتجر…' : 'Loading the store…'}
    </p>
  );
  const filterKey = JSON.stringify(CATALOG_FILTER_KEYS.map((key) => query[key]));
  return (
    <Suspense key={filterKey} fallback={loading}>
      <StoreResults locale={locale} query={query} />
    </Suspense>
  );
}

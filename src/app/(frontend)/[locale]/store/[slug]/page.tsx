import React, { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import { readPublishedProduct } from '@/modules/catalog/services/publishedCatalog';
import { ProductDetailView } from '@/modules/catalog/ui/ProductDetailView';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { buildBilingualMetadata } from '@/shared/lib/seo';
import { generateBreadcrumbSchema, generateProductSchema } from '@/shared/lib/schemaGenerator';
import { safeJsonLdReplacer } from '@/shared/lib/safeJsonLd';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const getProduct = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayloadClient();
  return readPublishedProduct(payload, locale, slug);
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();

  const product = await getProduct(locale, slug);
  if (!product) notFound();

  return buildBilingualMetadata({
    locale,
    path: `/store/${encodeURIComponent(product.slug)}`,
    title: product.title,
    description: product.description || product.title,
    imageUrl: product.media[0]?.url,
    imageAlt: product.media[0]?.alt,
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();

  const product = await getProduct(locale, slug);
  if (!product) notFound();

  const isArabic = locale === 'ar';
  const encodedSlug = encodeURIComponent(product.slug);
  const breadcrumbs = generateBreadcrumbSchema([
    { name: isArabic ? 'الرئيسية' : 'Home', url: `/${locale}` },
    { name: isArabic ? 'المتجر' : 'Store', url: `/${locale}/store` },
    { name: product.title, url: `/${locale}/store/${encodedSlug}` },
  ]);
  const productSchema = !product.enableVariants && product.price !== null && product.sku
    ? generateProductSchema({
        name: product.title,
        description: product.description || undefined,
        slug: encodedSlug,
        priceEgp: product.price,
        imageUrl: product.media[0]?.url,
        sku: product.sku,
      }, locale)
    : null;

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          id="product-jsonld"
          dangerouslySetInnerHTML={{ __html: safeJsonLdReplacer(productSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        id="product-breadcrumbs-jsonld"
        dangerouslySetInnerHTML={{ __html: safeJsonLdReplacer(breadcrumbs) }}
      />
      <ProductDetailView key={product.id} product={product} locale={locale} />
    </>
  );
}

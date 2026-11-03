import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sampleProducts } from '@/modules/catalog/data/sampleProducts';
import { ProductDetailView } from '@/modules/catalog/ui/ProductDetailView';
import { locales } from '@/shared/lib/i18n';

export function generateStaticParams() {
  const products = Object.values(sampleProducts);
  const params: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    for (const product of products) {
      params.push({ locale, slug: product.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const isArabic = locale === 'ar';
  const product = Object.values(sampleProducts).find((p) => p.slug === slug);

  if (!product) {
    return {
      title: isArabic ? 'المنتج غير موجود | وكالة موهبة' : 'Product Not Found | MWHEBA Agency',
    };
  }

  return {
    title: `${product.title} | ${isArabic ? 'وكالة موهبة' : 'MWHEBA Agency'}`,
    description: isArabic ? product.descriptionAr : product.descriptionEn,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = Object.values(sampleProducts).find((p) => p.slug === slug);

  if (!product) {
    notFound();
  }

  return <ProductDetailView product={product} locale={locale} />;
}

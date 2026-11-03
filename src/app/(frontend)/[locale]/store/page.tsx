import type { Metadata } from 'next';
import { ProductListingGrid } from '@/modules/catalog/ui/ProductListingGrid';
import { locales } from '@/shared/lib/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  return {
    title: isArabic
      ? 'متجر هدايا الشركات والمطبوعات المؤسسية | وكالة موهبة'
      : 'Corporate Giveaways & B2B Merchandise | MWHEBA Agency',
    description: isArabic
      ? 'كتالوج هدايا ومطبوعات الشركات المخصصة مع حوكمة الحد الأدنى للطلب (10 قطع) وحساب مباشر لرسوم حفر وطباعة الشعار.'
      : 'B2B catalog of custom corporate giveaways and stationery with server-enforced MOQ governance and transparent printing fees.',
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ProductListingGrid locale={locale} />;
}

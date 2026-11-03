import type { Metadata } from 'next';
import { CheckoutView } from '@/modules/cart-checkout/ui/CheckoutView';
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
      ? 'إتمام أمر الشراء المؤسسي (B2B) | وكالة موهبة'
      : 'Corporate Order Checkout | MWHEBA Agency',
    description: isArabic
      ? 'إتمام طلبات الشراء المؤسسية مع اعتماد الفواتير الرسمية وخيارات الشحن أو الاستلام من مقر الوكالة والدفع عبر Paymob أو التحويل البنكي.'
      : 'Corporate purchase order checkout with official VAT invoicing, courier shipping or headquarters pickup, and Paymob or bank transfer.',
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CheckoutView locale={locale} />;
}

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { CheckoutView } from '@/modules/cart-checkout/ui/CheckoutView';
import { accountProfile, getCustomerAccount, listCustomerAddresses } from '@/modules/identity/services/customerAccount';
import { isValidLocale, locales } from '@/shared/lib/i18n';

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
      ? 'إتمام طلب الشراء المؤسسي ومراجعة خيارات الاستلام والدفع المتاحة لطلبك.'
      : 'Complete your corporate order and review the delivery and payment options available for your purchase.',
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const account = await getCustomerAccount(await headers());
  if (!account) return <CheckoutView locale={locale} />;

  const { user, payload } = account;
  const addresses = await listCustomerAddresses(payload, user);
  return (
    <CheckoutView
      locale={locale}
      initialSession={{
        profile: accountProfile(user),
        addresses: addresses.map(({ id, title, state, city, addressLine1, addressLine2, country }) => ({
          id, title, state, city, addressLine1, addressLine2, country,
        })),
      }}
    />
  );
}

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Cairo } from 'next/font/google';
import '@/styles/globals.css';
import { Header } from '@/shared/ui/layout/Header';
import { Footer } from '@/shared/ui/layout/Footer';
import { locales, isValidLocale } from '@/shared/lib/i18n';
import { CartProvider } from '@/modules/cart-checkout/context/CartContext';
import { CartDrawer } from '@/modules/cart-checkout/ui/CartDrawer';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
  weight: ['300', '400', '500', '600', '700'],
});

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
      ? 'وكالة موهبة | تصميم الهوية، تطوير المنصات وهدايا الشركات'
      : 'MWHEBA Agency | Branding, Digital Platforms & Merchandise',
    description: isArabic
      ? 'وكالة رائدة في مصر لخدمات الهوية التجارية، تطوير المواقع والتطبيقات، وتوريد وتصنيع هدايا الشركات والمطبوعات الدعائية.'
      : 'Leading agency delivering branding, web engineering, digital marketing, and premium corporate merchandise in Egypt.',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  };
}

export default async function FrontendLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={cairo.variable}>
      <body className="site-layout">
        <CartProvider>
          <Header locale={locale} />
          <main className="site-main">{children}</main>
          <Footer locale={locale} />
          <CartDrawer locale={locale} />
        </CartProvider>
      </body>
    </html>
  );
}

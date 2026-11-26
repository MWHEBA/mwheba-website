import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'حسابي' : 'My account',
    robots: { index: false, follow: false },
    referrer: 'same-origin',
  };
}

export default function CustomerAccountLayout({ children }: { children: ReactNode }) {
  return children;
}

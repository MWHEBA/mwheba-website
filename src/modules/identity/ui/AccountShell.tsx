import type { ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Button } from '@/shared/ui/primitives';
import type { Locale } from '@/shared/lib/i18n';
import styles from './account.module.css';

type AccountSection = 'home' | 'orders' | 'profile' | 'addresses';

export interface AccountPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export function AccountShell({
  locale,
  title,
  section,
  narrow = false,
  children,
}: {
  locale: Locale;
  title: string;
  section?: AccountSection;
  narrow?: boolean;
  children: ReactNode;
}) {
  const ar = locale === 'ar';
  const base = `/${locale}/account`;
  const links = [
    { key: 'home', href: base, label: ar ? 'نظرة عامة' : 'Overview' },
    { key: 'orders', href: `${base}/orders`, label: ar ? 'طلباتي' : 'Orders' },
    { key: 'profile', href: `${base}/profile`, label: ar ? 'بيانات الحساب' : 'Profile' },
    { key: 'addresses', href: `${base}/addresses`, label: ar ? 'العناوين' : 'Addresses' },
  ];

  return (
    <div className={`container ${styles.shell}${narrow ? ` ${styles.narrow}` : ''}`}>
      <header className={styles.heading}>
        <h1>{title}</h1>
      </header>
      {section && (
        <nav className={styles.nav} aria-label={ar ? 'أقسام حسابي' : 'Account sections'}>
          {links.map(({ key, href, label }) => (
            <Link key={key} href={href} aria-current={section === key ? 'page' : undefined}>
              {label}
            </Link>
          ))}
          <form action="/api/account/logout" method="post">
            <input type="hidden" name="locale" value={locale} />
            <Button size="sm" variant="outline" type="submit">{ar ? 'تسجيل الخروج' : 'Sign out'}</Button>
          </form>
        </nav>
      )}
      {children}
    </div>
  );
}

export function AccountSaveFeedback({ locale, status }: { locale: Locale; status: unknown }) {
  const ar = locale === 'ar';
  if (status === 'saved') {
    return <Alert variant="success">{ar ? 'تم حفظ التغييرات.' : 'Changes saved.'}</Alert>;
  }
  if (status === 'invalid') {
    return (
      <Alert variant="error">
        {ar ? 'تعذّر حفظ التغييرات. راجع البيانات وحاول مرة أخرى.' : 'Changes could not be saved. Check the details and try again.'}
      </Alert>
    );
  }
  return null;
}

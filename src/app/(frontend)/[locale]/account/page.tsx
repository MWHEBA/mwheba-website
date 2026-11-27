import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountLoginHref } from '@/modules/identity/logic/accountPaths';
import { getCustomerAccount } from '@/modules/identity/services/customerAccount';
import { AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import styles from '@/modules/identity/ui/account.module.css';
import { isValidLocale } from '@/shared/lib/i18n';

export default async function CustomerAccountPage({ params }: Pick<AccountPageProps, 'params'>) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const account = await getCustomerAccount(await headers());
  if (!account) redirect(accountLoginHref(locale));
  const ar = locale === 'ar';

  return (
    <AccountShell locale={locale} section="home" title={ar ? 'حسابي' : 'My account'}>
      <section className={`${styles.panel} ${styles.stack}`}>
        <h2>{account.user.name || (ar ? 'أهلًا بك' : 'Welcome')}</h2>
        <bdi dir="ltr">{account.user.email}</bdi>
        <div className={styles.actions}>
          <Link className="btn-primary btn-md" href={`/${locale}/account/orders`}>{ar ? 'متابعة طلباتي' : 'View my orders'}</Link>
          <Link href={`/${locale}/store`}>{ar ? 'متابعة التسوّق' : 'Continue shopping'}</Link>
        </div>
      </section>
    </AccountShell>
  );
}

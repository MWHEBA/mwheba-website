import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { safeAccountReturnTo } from '@/modules/identity/logic/accountPaths';
import { getCustomerAccount } from '@/modules/identity/services/customerAccount';
import { AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import { CustomerSignInForm } from '@/modules/identity/ui/CustomerSignInForm';
import styles from '@/modules/identity/ui/account.module.css';
import { isValidLocale } from '@/shared/lib/i18n';
import { Alert } from '@/shared/ui/primitives';

export default async function CustomerLoginPage({ params, searchParams }: AccountPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const { status, returnTo } = await searchParams;
  const destination = safeAccountReturnTo(locale, returnTo);
  if (await getCustomerAccount(await headers())) redirect(destination);
  const ar = locale === 'ar';

  return (
    <AccountShell locale={locale} narrow title={ar ? 'تسجيل الدخول' : 'Sign in'}>
      <div className={`${styles.panel} ${styles.stack}`}>
        {status === 'reset' && <Alert variant="success">{ar ? 'تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.' : 'Password updated. Sign in with your new password.'}</Alert>}
        {status === 'invalid' && <Alert variant="error">{ar ? 'تعذّر تسجيل الدخول. تحقّق من بياناتك وحاول مجددًا.' : 'Sign-in failed. Check your details and try again.'}</Alert>}
        <CustomerSignInForm locale={locale} returnTo={destination} />
      </div>
      <p className={styles.muted}>
        {ar ? 'يمكنك إنشاء حساب عند تأكيد أول طلب لك. ' : 'You can create an account when you place your first order. '}
        <Link href={`/${locale}/store`}>{ar ? 'تصفّح المتجر' : 'Browse the store'}</Link>
      </p>
    </AccountShell>
  );
}

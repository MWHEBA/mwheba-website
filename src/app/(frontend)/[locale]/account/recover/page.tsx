import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accountLoginHref, safeAccountReturnTo } from '@/modules/identity/logic/accountPaths';
import { AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import styles from '@/modules/identity/ui/account.module.css';
import { isValidLocale } from '@/shared/lib/i18n';
import { Alert, Button, Input } from '@/shared/ui/primitives';

export default async function RecoverPasswordPage({ params, searchParams }: AccountPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const { status, returnTo } = await searchParams;
  const destination = safeAccountReturnTo(locale, returnTo);
  const ar = locale === 'ar';

  return (
    <AccountShell locale={locale} narrow title={ar ? 'استعادة كلمة المرور' : 'Recover your password'}>
      <div className={`${styles.panel} ${styles.stack}`}>
        {status === 'sent' ? (
          <Alert variant="success">
            {ar ? 'إذا كان البريد الإلكتروني مرتبطًا بحساب، فستصلك رسالة تحتوي على رابط لإعادة تعيين كلمة المرور.' : 'If the email address is linked to an account, you’ll receive a password reset link.'}
          </Alert>
        ) : (
          <form action="/api/account/forgot-password" method="post" className={styles.stack}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={destination} />
            <Input name="email" label={ar ? 'البريد الإلكتروني' : 'Email address'} type="email" autoComplete="username" maxLength={254} dir="ltr" required />
            <div><Button type="submit">{ar ? 'إرسال رابط الاستعادة' : 'Send reset link'}</Button></div>
          </form>
        )}
        <Link href={accountLoginHref(locale, destination)}>{ar ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link>
      </div>
    </AccountShell>
  );
}

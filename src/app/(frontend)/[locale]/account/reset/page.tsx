import { notFound } from 'next/navigation';
import { safeAccountReturnTo } from '@/modules/identity/logic/accountPaths';
import { AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import { ResetPasswordForm } from '@/modules/identity/ui/ResetPasswordForm';
import { isValidLocale } from '@/shared/lib/i18n';

export default async function ResetPasswordPage({ params, searchParams }: AccountPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const { returnTo } = await searchParams;
  const ar = locale === 'ar';

  return (
    <AccountShell locale={locale} narrow title={ar ? 'إعادة تعيين كلمة المرور' : 'Reset your password'}>
      <ResetPasswordForm locale={locale} initialReturnTo={safeAccountReturnTo(locale, returnTo)} />
    </AccountShell>
  );
}

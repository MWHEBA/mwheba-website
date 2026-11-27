import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountLoginHref } from '@/modules/identity/logic/accountPaths';
import { getCustomerAccount } from '@/modules/identity/services/customerAccount';
import { AccountSaveFeedback, AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import styles from '@/modules/identity/ui/account.module.css';
import { isValidLocale } from '@/shared/lib/i18n';
import { Button, Input } from '@/shared/ui/primitives';

export default async function CustomerProfilePage({ params, searchParams }: AccountPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const account = await getCustomerAccount(await headers());
  if (!account) redirect(accountLoginHref(locale, `/${locale}/account/profile`));
  const { status } = await searchParams;
  const { user } = account;
  const ar = locale === 'ar';

  return (
    <AccountShell locale={locale} section="profile" title={ar ? 'بيانات الحساب' : 'Profile'}>
      <form action="/api/account/profile" method="post" className={`${styles.panel} ${styles.stack}`}>
        <input type="hidden" name="locale" value={locale} />
        <AccountSaveFeedback locale={locale} status={status} />
        <div className={styles.fields}>
          <Input label={ar ? 'البريد الإلكتروني' : 'Email address'} type="email" value={user.email} dir="ltr" readOnly />
          <Input name="name" label={ar ? 'الاسم' : 'Name'} autoComplete="name" defaultValue={user.name ?? ''} maxLength={100} />
          <Input name="companyName" label={ar ? 'اسم الشركة' : 'Company name'} autoComplete="organization" defaultValue={user.companyName ?? ''} maxLength={200} />
          <Input name="taxId" label={ar ? 'الرقم الضريبي' : 'Tax ID'} defaultValue={user.taxId ?? ''} maxLength={60} />
        </div>
        <div><Button type="submit">{ar ? 'حفظ البيانات' : 'Save profile'}</Button></div>
      </form>
    </AccountShell>
  );
}

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountLoginHref } from '@/modules/identity/logic/accountPaths';
import { getCustomerAccount, listCustomerAddresses } from '@/modules/identity/services/customerAccount';
import { AccountSaveFeedback, AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import { CustomerAddressForm } from '@/modules/identity/ui/CustomerAddressForm';
import styles from '@/modules/identity/ui/account.module.css';
import { isValidLocale } from '@/shared/lib/i18n';
import { Badge, Button } from '@/shared/ui/primitives';

export default async function CustomerAddressesPage({ params, searchParams }: AccountPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const account = await getCustomerAccount(await headers());
  if (!account) redirect(accountLoginHref(locale, `/${locale}/account/addresses`));
  const { status } = await searchParams;
  const addresses = await listCustomerAddresses(account.payload, account.user);
  const defaultAddress = account.user.defaultAddress;
  const defaultAddressId = typeof defaultAddress === 'object' ? defaultAddress?.id : defaultAddress;
  const ar = locale === 'ar';

  return (
    <AccountShell locale={locale} section="addresses" title={ar ? 'عناويني' : 'Saved addresses'}>
      <div className={styles.stack}>
        <AccountSaveFeedback locale={locale} status={status} />
        {addresses.length === 0 && <p className={styles.muted}>{ar ? 'لا توجد عناوين محفوظة.' : 'You have no saved addresses.'}</p>}
        {addresses.length > 0 && (
          <ul className={styles.list}>
            {addresses.map((address) => {
              const label = address.title || address.addressLine1 || (ar ? 'عنوان التوصيل' : 'Shipping address');
              const isDefault = defaultAddressId === address.id;
              return (
                <li key={address.id} className={`${styles.panel} ${styles.stack}`}>
                  <div className={styles.row}>
                    <h2><bdi>{label}</bdi></h2>
                    {isDefault && <Badge variant="info">{ar ? 'افتراضي' : 'Default'}</Badge>}
                  </div>
                  <address className={styles.address}>
                    {[address.addressLine1, address.addressLine2, address.city, address.state].filter(Boolean).join(ar ? '، ' : ', ')}
                  </address>
                  <details className={styles.edit}>
                    <summary>{ar ? 'تعديل العنوان' : 'Edit address'}</summary>
                    <CustomerAddressForm locale={locale} address={address} />
                  </details>
                  <form action="/api/account/addresses" method="post" className={styles.actions}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={address.id} />
                    {!isDefault && (
                      <Button name="action" value="default" type="submit" size="sm" variant="outline"
                        aria-label={ar ? `تعيين ${label} عنوانًا افتراضيًا` : `Make ${label} the default address`}>
                        {ar ? 'تعيين كافتراضي' : 'Make default'}
                      </Button>
                    )}
                    <Button name="action" value="delete" type="submit" size="sm" variant="ghost"
                      aria-label={ar ? `حذف ${label}` : `Delete ${label}`}>
                      {ar ? 'حذف' : 'Delete'}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <section className={`${styles.panel} ${styles.stack}`}>
          <h2>{ar ? 'إضافة عنوان' : 'Add an address'}</h2>
          <CustomerAddressForm locale={locale} />
        </section>
      </div>
    </AccountShell>
  );
}

import type { Address } from '@/payload-types';
import type { Locale } from '@/shared/lib/i18n';
import { Button, Input } from '@/shared/ui/primitives';
import styles from './account.module.css';

export function CustomerAddressForm({ locale, address }: { locale: Locale; address?: Address }) {
  const ar = locale === 'ar';
  return (
    <form action="/api/account/addresses" method="post" className={styles.stack}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" value={address ? 'update' : 'create'} />
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className={styles.fields}>
        <Input name="title" label={ar ? 'اسم العنوان' : 'Address label'} defaultValue={address?.title ?? ''} maxLength={100} />
        <Input name="firstName" label={ar ? 'الاسم الأول' : 'First name'} defaultValue={address?.firstName ?? ''} autoComplete="given-name" maxLength={100} />
        <Input name="lastName" label={ar ? 'اسم العائلة' : 'Last name'} defaultValue={address?.lastName ?? ''} autoComplete="family-name" maxLength={100} />
        <Input name="company" label={ar ? 'الشركة' : 'Company'} defaultValue={address?.company ?? ''} autoComplete="organization" maxLength={200} />
        <Input name="phone" type="tel" label={ar ? 'رقم الهاتف' : 'Phone number'} defaultValue={address?.phone ?? ''} autoComplete="tel" dir="ltr" maxLength={40} />
        <Input name="state" label={ar ? 'المحافظة' : 'Governorate'} defaultValue={address?.state ?? ''} autoComplete="address-level1" maxLength={100} required />
        <Input name="city" label={ar ? 'المدينة أو الحي' : 'City or district'} defaultValue={address?.city ?? ''} autoComplete="address-level2" maxLength={100} required />
        <Input name="addressLine1" label={ar ? 'اسم الشارع ورقم المبنى' : 'Street and building number'} defaultValue={address?.addressLine1 ?? ''} autoComplete="address-line1" maxLength={300} required />
        <Input name="addressLine2" label={ar ? 'الدور أو الشقة' : 'Floor or apartment'} defaultValue={address?.addressLine2 ?? ''} autoComplete="address-line2" maxLength={300} />
      </div>
      <div><Button type="submit">{ar ? 'حفظ العنوان' : 'Save address'}</Button></div>
    </form>
  );
}

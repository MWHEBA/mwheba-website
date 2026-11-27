'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Alert, Button, Input } from '@/shared/ui/primitives';
import type { Locale } from '@/shared/lib/i18n';
import type { Address } from '@/payload-types';
import styles from './account.module.css';

export interface CustomerCheckoutSession {
  profile: {
    name?: string | null;
    email: string;
    companyName?: string | null;
    taxId?: string | null;
    defaultAddressId?: number | null;
  };
  addresses: Pick<Address, 'id' | 'title' | 'state' | 'city' | 'addressLine1' | 'addressLine2' | 'country'>[];
}

export function CustomerSignInForm({ locale, returnTo, defaultEmail, onSignedIn }: {
  locale: Locale;
  returnTo?: string;
  defaultEmail?: string;
  onSignedIn?: (session: CustomerCheckoutSession) => Promise<void>;
}) {
  const ar = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const recoverHref = `/${locale}/account/recover${returnTo ? `?${new URLSearchParams({ returnTo })}` : ''}`;

  async function submitInline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSignedIn || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const result: Partial<CustomerCheckoutSession> & { success?: boolean } = await response.json();
      if (!response.ok || !result.success || !result.profile || !Array.isArray(result.addresses)) {
        setError(true);
        return;
      }
      form.reset();
      await onSignedIn({ profile: result.profile, addresses: result.addresses });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action="/api/account/login" method="post" className={styles.stack} onSubmit={onSignedIn ? submitInline : undefined}>
      <input type="hidden" name="locale" value={locale} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {error && <Alert variant="error">{ar ? 'تعذّر تسجيل الدخول. تحقّق من بياناتك وحاول مجددًا.' : 'Sign-in failed. Check your details and try again.'}</Alert>}
      <Input name="email" label={ar ? 'البريد الإلكتروني' : 'Email address'} type="email" autoComplete="username" defaultValue={defaultEmail} maxLength={254} dir="ltr" required />
      <Input name="password" label={ar ? 'كلمة المرور' : 'Password'} type="password" autoComplete="current-password" maxLength={128} dir="ltr" required />
      <div className={styles.actions}>
        <Button type="submit" loading={busy} loadingText={ar ? 'جارٍ تسجيل الدخول…' : 'Signing in…'}>
          {ar ? 'تسجيل الدخول' : 'Sign in'}
        </Button>
        <Link href={recoverHref} prefetch={false}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}</Link>
      </div>
    </form>
  );
}

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { accountLoginHref, safeAccountReturnTo } from '@/modules/identity/logic/accountPaths';
import type { Locale } from '@/shared/lib/i18n';
import { Alert, Button, Input } from '@/shared/ui/primitives';
import styles from './account.module.css';

export function ResetPasswordForm({ locale, initialReturnTo }: { locale: Locale; initialReturnTo: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState(initialReturnTo);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ar = locale === 'ar';

  useEffect(() => {
    const { hash, pathname, search } = window.location;
    if (hash) {
      const params = new URLSearchParams(hash.slice(1));
      const value = params.get('token');
      if (value && /^[a-f0-9]{40}$/.test(value)) setToken(value);
      if (params.has('returnTo')) setReturnTo(safeAccountReturnTo(locale, params.get('returnTo')));
      window.history.replaceState(window.history.state, '', pathname + search);
    }
    setReady(true);
  }, [locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ locale, returnTo, token, password: data.get('password') }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        setError(true);
        return;
      }
      const signIn = new URL(accountLoginHref(locale, returnTo), window.location.origin);
      signIn.searchParams.set('status', 'reset');
      window.location.replace(signIn.pathname + signIn.search);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.panel} ${styles.stack}`}>
      {!ready && <p role="status">{ar ? 'جارٍ تحميل رابط الاستعادة…' : 'Loading your reset link…'}</p>}
      {ready && (error || !token) && (
        <Alert variant="error">
          {ar ? 'تعذّر تغيير كلمة المرور. اطلب رابطًا جديدًا إذا انتهت صلاحية الرابط أو سبق استخدامه.' : 'The password could not be changed. Request a new link if this one expired or has already been used.'}
        </Alert>
      )}
      <noscript>{ar ? 'فعّل JavaScript لفتح رابط استعادة كلمة المرور.' : 'Enable JavaScript to use your reset link.'}</noscript>
      {token && (
        <form method="post" onSubmit={submit} className={styles.stack}>
          <Input name="password" label={ar ? 'كلمة المرور الجديدة' : 'New password'} type="password" autoComplete="new-password" minLength={8} maxLength={128} dir="ltr" required
            helperText={ar ? 'استخدم ٨ أحرف على الأقل.' : 'Use at least 8 characters.'} />
          <div><Button loading={busy} type="submit">{ar ? 'حفظ كلمة المرور' : 'Save new password'}</Button></div>
        </form>
      )}
      <div className={styles.actions}>
        <Link href={`/${locale}/account/recover?${new URLSearchParams({ returnTo })}`} prefetch={false}>{ar ? 'طلب رابط جديد' : 'Request a new link'}</Link>
        <Link href={accountLoginHref(locale, returnTo)} prefetch={false}>{ar ? 'تسجيل الدخول' : 'Sign in'}</Link>
      </div>
    </div>
  );
}

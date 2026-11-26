import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import type { EmailAdapter, Payload } from 'payload';
import { accountLocale, safeAccountReturnTo } from '../logic/accountPaths';

function isLoopback(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
}

export function customerSiteOrigin(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SERVER_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined;
    if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url.hostname))) return url.origin;
  } catch {
    return undefined;
  }
}

export function secureAccountCookie() {
  if (process.env.NODE_ENV !== 'production') return false;
  return !customerSiteOrigin()?.startsWith('http:');
}

export function sameAccountOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite !== 'cross-site' && (!origin || origin === new URL(request.url).origin || origin === customerSiteOrigin());
}

const unconfiguredMail: EmailAdapter = () => ({
  name: 'unconfigured',
  defaultFromName: 'Store',
  defaultFromAddress: 'no-reply@example.invalid',
  sendEmail: async () => { throw new Error('Transactional email transport is not configured.'); },
});

export function customerEmailAdapter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM_ADDRESS?.trim();
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535 || Boolean(user) !== Boolean(pass)) {
    return unconfiguredMail;
  }
  const secure = port === 465;
  return nodemailerAdapter({
    defaultFromAddress: from,
    defaultFromName: process.env.SMTP_FROM_NAME?.trim() || 'Store',
    skipVerify: true,
    transportOptions: {
      host, port, secure,
      requireTLS: !secure && !isLoopback(host),
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    },
  });
}

export function hasTransactionalEmail(payload: Payload) {
  return payload.email.name !== 'unconfigured' && payload.email.name !== 'console';
}

export function customerPasswordResetEmail(context: Record<string, unknown>, token: string) {
  const origin = customerSiteOrigin();
  if (!origin) throw new Error('Customer recovery requires a configured public site origin.');
  const locale = accountLocale(context.customerLocale);
  const destination = new URL(`/${locale}/account/reset`, origin);
  const fields = new URLSearchParams({ token, returnTo: safeAccountReturnTo(locale, context.customerReturnTo) });
  destination.hash = fields.toString();
  const href = destination.href.replaceAll('&', '&amp;');
  return locale === 'ar'
    ? `<p lang="ar" dir="rtl">طلبت إعادة تعيين كلمة المرور لحسابك.</p><a href="${href}">إعادة تعيين كلمة المرور</a>`
    : `<p>You requested a password reset for your account.</p><a href="${href}">Reset your password</a>`;
}

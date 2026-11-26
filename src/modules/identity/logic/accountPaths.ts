import { defaultLocale, isValidLocale, type Locale } from '@/shared/lib/i18n';

export function accountLocale(value: unknown): Locale {
  return typeof value === 'string' && isValidLocale(value) ? value : defaultLocale;
}

export function safeAccountReturnTo(locale: string, value: unknown): string {
  const prefix = `/${accountLocale(locale)}`;
  const fallback = `${prefix}/account`;
  if (typeof value !== 'string' || value.length > 300) return fallback;
  const path = value.startsWith(prefix) ? value.slice(prefix.length) : '';
  if (path === '/checkout' || path === '/account' || path === '/account/profile' || path === '/account/addresses') return value;
  if (/^\/account\/orders(?:\/\d+(?:\/brief(?:\?job=\d+)?)?|\?page=\d+)?$/.test(path)) return value;
  return fallback;
}

export function accountLoginHref(locale: string, returnTo?: unknown): string {
  const normalized = accountLocale(locale);
  return `/${normalized}/account/login?${new URLSearchParams({ returnTo: safeAccountReturnTo(normalized, returnTo) })}`;
}

export function normalizeCustomerEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validCustomerEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

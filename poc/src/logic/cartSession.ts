import { createHmac, timingSafeEqual } from 'node:crypto';

function key(): string {
  const value = process.env.PAYLOAD_SECRET;
  if (!value || value.length < 32) throw new Error('PAYLOAD_SECRET must contain at least 32 characters.');
  return value;
}

export function signCartId(id: number | string): string {
  const value = String(id);
  const signature = createHmac('sha256', key()).update(value).digest('base64url');
  return `${value}.${signature}`;
}

export function readCartId(cookie: string | undefined): number | null {
  if (!cookie) return null;
  const [value, signature, extra] = cookie.split('.');
  if (!value || !signature || extra || !/^\d+$/.test(value)) return null;
  const expected = createHmac('sha256', key()).update(value).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

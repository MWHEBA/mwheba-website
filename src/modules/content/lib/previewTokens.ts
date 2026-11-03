import crypto from 'crypto';

interface GenerateTokenOptions {
  slug: string;
  locale: string;
  /** Expiration in seconds, defaults to 900 (15 minutes) */
  ttlSeconds?: number;
}

interface VerifyTokenOptions {
  expectedSlug: string;
  expectedLocale: string;
}

export type PreviewTokenErrorCode =
  | 'MISSING_TOKEN'
  | 'MALFORMED_TOKEN'
  | 'INVALID_SIGNATURE'
  | 'MALFORMED_PAYLOAD'
  | 'TOKEN_EXPIRED'
  | 'PAGE_MISMATCH'
  | 'LOCALE_MISMATCH';

export interface TokenVerificationResult {
  valid: boolean;
  error?: PreviewTokenErrorCode;
  payload?: {
    slug: string;
    locale: string;
    exp: number;
  };
}

function getSigningKey(): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PAYLOAD_SECRET environment variable is strictly required for preview token signing.');
    }
    // Safe development fallback only when outside production
    return 'mwheba-dev-foundation-secret-key-32chars-min';
  }
  return secret;
}

/**
 * Generates an HMAC-SHA256 signed, time-limited, page-specific preview token.
 * Does NOT expose PAYLOAD_SECRET in the URL or payload.
 */
export function generatePreviewToken({
  slug,
  locale,
  ttlSeconds = 900,
}: GenerateTokenOptions): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadData = { slug, locale, exp };
  const serialized = Buffer.from(JSON.stringify(payloadData)).toString('base64url');

  const key = getSigningKey();
  const signature = crypto
    .createHmac('sha256', key)
    .update(serialized)
    .digest('base64url');

  return `${serialized}.${signature}`;
}

/**
 * Verifies a preview token against HMAC signature, expiration, and page/locale scope.
 */
export function verifyPreviewToken(
  token: string | null | undefined,
  { expectedSlug, expectedLocale }: VerifyTokenOptions
): TokenVerificationResult {
  if (!token) {
    return { valid: false, error: 'MISSING_TOKEN' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'MALFORMED_TOKEN' };
  }

  const [serialized, signature] = parts;

  // 1. Verify HMAC signature using timingSafeEqual
  const key = getSigningKey();
  const expectedSignature = crypto
    .createHmac('sha256', key)
    .update(serialized)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  // 2. Parse and validate JSON payload
  let payload: { slug: string; locale: string; exp: number };
  try {
    const raw = Buffer.from(serialized, 'base64url').toString('utf8');
    payload = JSON.parse(raw);
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD' };
  }

  // 3. Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  // 4. Verify exact page binding (prevent token reuse on different pages)
  if (payload.slug !== expectedSlug) {
    return { valid: false, error: 'PAGE_MISMATCH' };
  }

  // 5. Verify exact locale binding
  if (payload.locale !== expectedLocale) {
    return { valid: false, error: 'LOCALE_MISMATCH' };
  }

  return { valid: true, payload };
}

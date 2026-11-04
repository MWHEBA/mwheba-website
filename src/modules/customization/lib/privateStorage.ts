import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { privateUploadDir } from '../collections/Media';

const DEFAULT_TTL_SECONDS = 900; // 15 minutes per Ticket B2B-03

function getSigningSecret(): string {
  const key =
    process.env.MEDIA_SIGNING_SECRET ||
    process.env.PAYLOAD_SECRET ||
    'mwheba-dev-foundation-secret-key-32chars-min';
  return key;
}

/**
 * Generates an HMAC-SHA256 signed temporary token for downloading private artwork.
 * Default expiration is 15 minutes (900 seconds).
 */
export function createArtworkDownloadToken(
  assetId: string | number,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  now = Date.now()
): { token: string; expiresIn: number } {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ id: String(assetId), exp })).toString('base64url');
  const signature = createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
  return {
    token: `${payload}.${signature}`,
    expiresIn: ttlSeconds,
  };
}

/**
 * Validates the HMAC signature and timestamp of an artwork download token.
 */
export function verifyArtworkDownloadToken(
  token: string,
  assetId: string | number,
  now = Date.now()
): boolean {
  if (!token || typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;

  const expected = createHmac('sha256', getSigningSecret()).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return (
      decoded.id === String(assetId) &&
      Number.isSafeInteger(decoded.exp) &&
      decoded.exp > Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}

/**
 * Persists an uploaded artwork buffer to the private filesystem under artwork/[uuid]/[filename].
 */
export async function saveArtworkFile(
  buffer: Buffer,
  safeFilename: string
): Promise<{ storageKey: string; absolutePath: string }> {
  const uuid = randomUUID();
  const relDir = path.join('artwork', uuid);
  const targetDir = path.join(privateUploadDir, relDir);

  await mkdir(targetDir, { recursive: true });

  const absolutePath = path.join(targetDir, safeFilename);
  await writeFile(absolutePath, buffer);

  // Return a forward-slash normalized relative storage key
  const storageKey = `artwork/${uuid}/${safeFilename}`;

  return { storageKey, absolutePath };
}

/**
 * Resolves the absolute filesystem path for a storageKey with traversal protection.
 */
export function resolveArtworkPath(storageKey: string): string {
  if (!storageKey || typeof storageKey !== 'string') {
    throw new Error('Invalid storage key.');
  }

  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = path.resolve(privateUploadDir, normalized);

  // Path Traversal Guard: Ensure the resolved path resides strictly inside privateUploadDir
  if (!absolute.startsWith(privateUploadDir)) {
    throw new Error('Path traversal rejected: Attempted access outside private storage directory.');
  }

  return absolute;
}

import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, writeFile, readFile, stat, unlink } from 'node:fs/promises';
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
 * Resolves the absolute filesystem path for a storageKey with path.relative boundary check and symlink resolution.
 */
export function resolveArtworkPath(storageKey: string): string {
  if (!storageKey || typeof storageKey !== 'string') {
    throw new Error('Invalid storage key.');
  }

  // Reject absolute paths and drive prefixes
  if (
    path.isAbsolute(storageKey) ||
    storageKey.startsWith('/') ||
    storageKey.startsWith('\\') ||
    /^[a-zA-Z]:/.test(storageKey)
  ) {
    throw new Error('Path traversal rejected: Absolute paths are forbidden.');
  }

  const base = path.resolve(privateUploadDir);
  const target = path.resolve(base, storageKey);
  const rel = path.relative(base, target);

  // Path Traversal Guard: Ensure the relative path does not escape base directory
  if (rel.startsWith('..') || rel === '..' || path.isAbsolute(rel)) {
    throw new Error('Path traversal rejected: Attempted access outside private storage directory.');
  }

  // Symlink Resolution Guard: If file/directory exists, verify realpath does not escape private directory
  if (existsSync(target)) {
    const realBase = existsSync(base) ? realpathSync(base) : base;
    const realTarget = realpathSync(target);
    const relReal = path.relative(realBase, realTarget);

    if (relReal.startsWith('..') || relReal === '..' || path.isAbsolute(relReal)) {
      throw new Error('Path traversal rejected: Symlink escapes private storage directory.');
    }
    return realTarget;
  }

  return target;
}

/**
 * Safely removes a file from the private artwork store.
 */
export async function cleanupUploadedArtwork(storageKey: string): Promise<void> {
  try {
    const filePath = resolveArtworkPath(storageKey);
    await unlink(filePath).catch(() => {});
  } catch {
    // Ignore resolution errors if file cannot be found or safely resolved
  }
}

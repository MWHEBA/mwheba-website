import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { privateUploadDir } from '../collections/Media';

const ttlSeconds = 60;

function signingKey(): string {
  const key = process.env.MEDIA_SIGNING_SECRET || process.env.PAYLOAD_SECRET;
  if (!key || key.length < 32) {
    throw new Error('MEDIA_SIGNING_SECRET or PAYLOAD_SECRET must contain at least 32 characters.');
  }
  return key;
}

export function createPrivateMediaToken(id: string | number, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id: String(id), exp: Math.floor(now / 1000) + ttlSeconds }))
    .toString('base64url');
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPrivateMediaToken(token: string, id: string | number, now = Date.now()): boolean {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = createHmac('sha256', signingKey()).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.id === String(id) && Number.isSafeInteger(decoded.exp) && decoded.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export async function signPrivateMedia(req: any): Promise<Response> {
  const id = req.routeParams?.id;
  if (!id || !req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let doc: any;
  try {
    doc = await req.payload.findByID({ collection: 'media', id, req, overrideAccess: false });
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (!doc || doc.mediaType === 'public') return Response.json({ error: 'Not found' }, { status: 404 });
  const token = createPrivateMediaToken(id);
  return Response.json({ url: `/api/private-media/${id}/download?token=${token}`, expiresIn: ttlSeconds });
}

export async function downloadPrivateMedia(req: any): Promise<Response> {
  const id = req.routeParams?.id;
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!id || !verifyPrivateMediaToken(token, id)) {
    return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
  }
  let doc: any;
  try {
    doc = await req.payload.findByID({ collection: 'media', id, req, overrideAccess: true });
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (!doc || !doc.filename || doc.mediaType === 'public') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const filename = path.basename(doc.filename);
  if (filename !== doc.filename) return Response.json({ error: 'Invalid file' }, { status: 400 });
  try {
    const content = await readFile(path.join(privateUploadDir, filename));
    return new Response(content, {
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename.replace(/["\\]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
}

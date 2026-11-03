import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import next from 'next';
import { getPayload, type Payload } from 'payload';
import configPromise from '../src/payload.config';
import { createPrivateMediaToken } from '../src/endpoints/privateMedia';

describe('POC-03: Private Media Live HTTP Verification Suite', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;
  let payload: Payload;
  let testUser: any;
  let privateMediaDoc: any;

  const samplePngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRucAAAAASUVORK5CYII=',
    'base64'
  );

  beforeAll(async () => {
    process.env.PRIVATE_MEDIA_SIGNING_KEY = 'poc-signing-secret-for-private-media-123456';
    payload = await getPayload({ config: configPromise });

    // 1. Create a customer user
    const stamp = Date.now();
    testUser = await payload.create({
      collection: 'users',
      data: {
        email: `http-media-tester-${stamp}@mwheba-client.eg`,
        password: 'Password123!',
        roles: ['customer'],
      },
    });

    // 2. Upload a private artwork media document
    privateMediaDoc = await payload.create({
      collection: 'media',
      user: testUser,
      overrideAccess: false,
      data: {
        mediaType: 'artwork',
        alt: 'Confidential Client Vector Logo',
        uploader: testUser.id,
      },
      file: {
        data: samplePngBytes,
        name: `confidential-logo-${stamp}.png`,
        mimetype: 'image/png',
        size: samplePngBytes.length,
      },
    });

    // 3. Start Next.js HTTP server on an ephemeral OS port
    const app = (next as any)({
      dev: false,
      dir: path.resolve(__dirname, '..'),
    });
    await app.prepare();
    const handle = app.getRequestHandler();

    server = http.createServer((req, res) => handle(req, res));
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 45000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('HTTP-01: Direct static file access to private media is blocked with HTTP 403 Forbidden', async () => {
    const rawFileUrl = `${baseUrl}/api/media/file/${privateMediaDoc.filename}`;
    const res = await fetch(rawFileUrl, { method: 'GET' });
    
    // Direct static file access to private files is blocked with 403 Forbidden by Payload access control
    expect(res.status).toBe(403);
  });

  it('HTTP-02: Direct download endpoint without token returns 403 Forbidden', async () => {
    const unsignedUrl = `${baseUrl}/api/private-media/${privateMediaDoc.id}/download`;
    const res = await fetch(unsignedUrl, { method: 'GET' });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/Invalid or expired link/i);
  });

  it('HTTP-03: Download with tampered token returns 403 Forbidden', async () => {
    const tamperedUrl = `${baseUrl}/api/private-media/${privateMediaDoc.id}/download?token=malicious-tampered-token`;
    const res = await fetch(tamperedUrl, { method: 'GET' });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/Invalid or expired link/i);
  });

  it('HTTP-04: Download with expired token returns 403 Forbidden', async () => {
    // Generate token that expired 10 seconds ago
    const pastTime = Date.now() - 70000;
    const expiredToken = createPrivateMediaToken(privateMediaDoc.id, pastTime);
    const expiredUrl = `${baseUrl}/api/private-media/${privateMediaDoc.id}/download?token=${expiredToken}`;
    
    const res = await fetch(expiredUrl, { method: 'GET' });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/Invalid or expired link/i);
  });

  it('HTTP-05: Download with valid signed URL succeeds with HTTP 200, no-store cache header, and exact bytes', async () => {
    const validToken = createPrivateMediaToken(privateMediaDoc.id);
    const signedUrl = `${baseUrl}/api/private-media/${privateMediaDoc.id}/download?token=${validToken}`;
    
    const res = await fetch(signedUrl, { method: 'GET' });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('content-disposition')).toContain('attachment; filename=');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');

    const receivedBytes = Buffer.from(await res.arrayBuffer());
    expect(receivedBytes).toEqual(samplePngBytes);
  });
});

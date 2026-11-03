import { beforeAll, describe, expect, it } from 'vitest';
import { getPayload, type Payload } from 'payload';
import configPromise from '../src/payload.config';
import {
  createPrivateMediaToken,
  downloadPrivateMedia,
  signPrivateMedia,
  verifyPrivateMediaToken,
} from '../src/endpoints/privateMedia';

describe('Private local media', () => {
  const fileBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRucAAAAASUVORK5CYII=',
    'base64',
  );
  let payload: Payload;
  let owner: any;
  let other: any;
  let media: any;

  beforeAll(async () => {
    process.env.PRIVATE_MEDIA_SIGNING_KEY = 'poc-signing-secret-for-private-media-123456';
    payload = await getPayload({ config: configPromise });
    const stamp = Date.now();
    owner = await payload.create({
      collection: 'users',
      data: { email: `media-owner-${stamp}@client.eg`, password: 'Password123!', roles: ['customer'] },
    });
    other = await payload.create({
      collection: 'users',
      data: { email: `media-other-${stamp}@client.eg`, password: 'Password123!', roles: ['customer'] },
    });
    media = await payload.create({
      collection: 'media', user: owner, overrideAccess: false,
      data: { mediaType: 'artwork', alt: 'Private POC logo', uploader: other.id },
      file: { data: fileBytes, name: `private-logo-${stamp}.png`, mimetype: 'image/png', size: fileBytes.length },
    });
  }, 30000);

  it('stores an uploaded private file, enforces owner access, and issues an expiring signed download', async () => {
    expect(media.filename).toMatch(/\.png$/);
    const saved = await payload.findByID({ collection: 'media', id: media.id, user: owner, overrideAccess: false });
    const uploader = typeof saved.uploader === 'object' ? saved.uploader?.id : saved.uploader;
    expect(uploader).toBe(owner.id);

    const otherResult = await payload.find({
      collection: 'media', where: { id: { equals: media.id } }, user: other, overrideAccess: false,
    });
    expect(otherResult.docs).toHaveLength(0);

    const denied = await signPrivateMedia({ payload, user: other, routeParams: { id: media.id } });
    expect(denied.status).toBe(404);
    const allowed = await signPrivateMedia({ payload, user: owner, routeParams: { id: media.id } });
    expect(allowed.status).toBe(200);
    const { url } = await allowed.json() as { url: string };
    const token = new URL(url, 'http://localhost').searchParams.get('token')!;

    const unsigned = await downloadPrivateMedia({
      payload, routeParams: { id: media.id }, url: `http://localhost/api/private-media/${media.id}/download`,
    });
    expect(unsigned.status).toBe(403);

    const downloaded = await downloadPrivateMedia({
      payload, routeParams: { id: media.id }, url: new URL(url, 'http://localhost').toString(),
    });
    expect(downloaded.status).toBe(200);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(fileBytes);
    expect(downloaded.headers.get('cache-control')).toContain('no-store');
    expect(verifyPrivateMediaToken(token, media.id, Date.now() + 61000)).toBe(false);
    expect(verifyPrivateMediaToken(createPrivateMediaToken(media.id), other.id)).toBe(false);
  }, 30000);
});

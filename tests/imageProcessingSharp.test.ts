import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

describe('Image Upload & Sharp Processing Verification', () => {
  let payload: any;
  let testAdminUser: any;
  let createdMediaId: number | null = null;
  let createdFilePath: string | null = null;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // Seed or find an admin user for authentication context
    const existingAdmin = await payload.find({
      collection: 'users',
      where: { email: { equals: 'sharp-test-admin@mwheba.com' } },
    });

    if (existingAdmin.docs.length > 0) {
      testAdminUser = existingAdmin.docs[0];
    } else {
      testAdminUser = await payload.create({
        collection: 'users',
        data: {
          email: 'sharp-test-admin@mwheba.com',
          password: 'TestPassword123!Secure',
          name: 'Sharp Test Admin',
          roles: ['super_admin'],
        },
        context: { isSystemSeed: true },
      });
    }
  });

  afterAll(async () => {
    if (createdMediaId) {
      try {
        await payload.delete({
          collection: 'media',
          id: createdMediaId,
          overrideAccess: true,
        });
      } catch (err) {
        // ignore cleanup error
      }
    }

    if (createdFilePath && fs.existsSync(createdFilePath)) {
      try {
        fs.unlinkSync(createdFilePath);
      } catch (err) {
        // ignore cleanup error
      }
    }
  });

  it('generates an image buffer with sharp, uploads to Payload media, and verifies dimensions extraction', async () => {
    // 1. Generate an authentic 400x300 PNG buffer with sharp
    const testImageWidth = 400;
    const testImageHeight = 300;
    const rawImageBuffer = await sharp({
      create: {
        width: testImageWidth,
        height: testImageHeight,
        channels: 4,
        background: { r: 15, g: 30, b: 60, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    expect(rawImageBuffer.length).toBeGreaterThan(0);

    // 2. Upload to Payload Media collection with authentic file metadata
    const uploadFilename = `test_sharp_image_${Date.now()}.png`;
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        alt: 'اختبار معالجة الصور عبر Sharp وPayload',
        mediaType: 'public',
      },
      file: {
        data: rawImageBuffer,
        mimetype: 'image/png',
        name: uploadFilename,
        size: rawImageBuffer.length,
      },
      user: testAdminUser,
    });

    expect(mediaDoc).toBeDefined();
    expect(mediaDoc.id).toBeDefined();
    createdMediaId = mediaDoc.id;

    // 3. Verify that Payload and sharp correctly extracted metadata and dimensions
    expect(mediaDoc.mimeType).toBe('image/png');
    expect(Number(mediaDoc.width)).toBe(testImageWidth);
    expect(Number(mediaDoc.height)).toBe(testImageHeight);
    expect(Number(mediaDoc.filesize)).toBe(rawImageBuffer.length);
    expect(mediaDoc.filename).toContain('test_sharp_image_');

    // 4. Verify file persistence on disk
    const uploadDir = path.resolve(process.cwd(), 'private-uploads');
    createdFilePath = path.join(uploadDir, mediaDoc.filename);
    expect(fs.existsSync(createdFilePath)).toBe(true);

    // 5. Read back from disk with sharp and execute multi-format transformation
    const diskImage = sharp(createdFilePath);
    const metadata = await diskImage.metadata();
    expect(metadata.width).toBe(testImageWidth);
    expect(metadata.height).toBe(testImageHeight);
    expect(metadata.format).toBe('png');

    // Transform: resize to 200x150, convert to WebP, inspect output
    const transformedBuffer = await sharp(createdFilePath)
      .resize(200, 150)
      .webp({ quality: 85 })
      .toBuffer();

    const transformedMeta = await sharp(transformedBuffer).metadata();
    expect(transformedMeta.width).toBe(200);
    expect(transformedMeta.height).toBe(150);
    expect(transformedMeta.format).toBe('webp');
  });
});

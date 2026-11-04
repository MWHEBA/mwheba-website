import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import type { Payload } from 'payload';
import path from 'node:path';
import fs from 'node:fs';
import {
  importMedia,
  detectAndVerifyImageBuffer,
  purgeDummyMediaRecords,
} from '../src/scripts/migration/importMedia';
import {
  allCatalogedMedia,
  legacyClientLogos,
  legacyAgencyBranding,
} from '../src/scripts/migration/data/legacyMedia';
import { privateUploadDir } from '../src/modules/customization/collections/Media';

describe('MIG-02: Authentic Media Migration & Filesystem Pipeline', () => {
  let payload: Payload;
  const createdMediaIds: (string | number)[] = [];

  beforeAll(async () => {
    payload = await getPayload({ config });
  });

  afterAll(async () => {
    for (const id of createdMediaIds) {
      try {
        await payload.delete({
          collection: 'media',
          id,
          overrideAccess: true,
        });
      } catch {
        // ignore
      }
    }
  });

  describe('1. Asset Verification & Magic Byte Detection', () => {
    it('rejects dummy/small buffers (< 500 bytes)', () => {
      const dummy1x1Png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=',
        'base64',
      );
      expect(() => detectAndVerifyImageBuffer(dummy1x1Png)).toThrow(
        /Must be authentic asset >= 500 bytes/,
      );
    });

    it('rejects buffers with non-image magic bytes', () => {
      const fakeText = Buffer.alloc(1000, 'A');
      expect(() => detectAndVerifyImageBuffer(fakeText)).toThrow(/magic bytes do not match/);
    });

    it('detects authentic PNG format from real disk assets', () => {
      const realPngPath = path.resolve(process.cwd(), 'public/brand/logo-wide.png');
      const buf = fs.readFileSync(realPngPath);
      expect(buf.length).toBeGreaterThan(1000);
      const mime = detectAndVerifyImageBuffer(buf);
      expect(mime).toBe('image/png');
    });

    it('detects authentic WebP format from real disk assets', () => {
      const realWebpPath = path.resolve(process.cwd(), 'public/brand/logo-wide.webp');
      const buf = fs.readFileSync(realWebpPath);
      expect(buf.length).toBeGreaterThan(1000);
      const mime = detectAndVerifyImageBuffer(buf);
      expect(mime).toBe('image/webp');
    });
  });

  describe('2. Media Ingestion with Provenance & Pending Source Tracking', () => {
    it('purges any legacy dummy records (< 500 bytes) from previous test runs', async () => {
      const purged = await purgeDummyMediaRecords(payload);
      expect(purged).toBeGreaterThanOrEqual(0);
    });

    it('ingests only authentic disk files, retaining missing assets as pending_source_file without fake records', async () => {
      const report = await importMedia(payload);

      // Verify overall counts
      expect(report.totalCataloged).toBe(27);
      expect(report.authenticFilesMigrated).toBeGreaterThan(0);
      expect(report.pendingSourceFiles).toBeGreaterThan(0);
      expect(report.authenticFilesMigrated + report.pendingSourceFiles).toBe(27);

      // The 22 client logos (Oxford, Bico Misr, TrueDent, etc.) have no local source file on disk
      // and MUST be held in pendingItems
      expect(report.pendingItems.length).toBe(22);
      const pendingFilenames = report.pendingItems.map((p) => p.catalogFilename);
      expect(pendingFilenames).toContain('oxford.png');
      expect(pendingFilenames).toContain('bico-misr.png');
      expect(pendingFilenames).toContain('truedent.png');

      // CRITICAL SECURITY / AUDIT RULE:
      // Assert that NO documents were created in Payload for any pending client logos
      const clientDocsInDb = await payload.find({
        collection: 'media',
        where: {
          filename: {
            in: legacyClientLogos.map((c) => c.catalogFilename),
          },
        },
        limit: 100,
        overrideAccess: true,
      });

      expect(clientDocsInDb.docs.length).toBe(0);

      // Verify migrated authentic agency branding items
      expect(report.migratedItems.length).toBe(report.authenticFilesMigrated);
      for (const item of report.migratedItems) {
        expect(item.size).toBeGreaterThan(500);
        expect(item.fingerprint.length).toBe(64); // SHA-256 hash length
        expect(item.mimeType).toBe('image/png');

        // Confirm record in database
        const dbDoc = await payload.find({
          collection: 'media',
          where: {
            filename: { equals: item.catalogFilename },
          },
          limit: 1,
          overrideAccess: true,
        });

        expect(dbDoc.docs.length).toBe(1);
        const doc = dbDoc.docs[0];
        createdMediaIds.push(doc.id);

        expect(doc.mediaType).toBe('public');
        expect(doc.filesize).toBe(item.size);
        expect(doc.alt).toBeDefined();

        // Confirm physical file exists on disk
        const filePath = path.join(privateUploadDir, doc.filename as string);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it('demonstrates 100% idempotency: re-running importMedia updates in-place without duplicating', async () => {
      const secondReport = await importMedia(payload);

      expect(secondReport.totalCataloged).toBe(27);
      expect(secondReport.authenticFilesMigrated).toBeGreaterThan(0);
      expect(secondReport.pendingSourceFiles).toBe(22);

      const totalDocs = await payload.find({
        collection: 'media',
        where: {
          filename: {
            in: allCatalogedMedia.map((m) => m.catalogFilename),
          },
        },
        limit: 100,
        overrideAccess: true,
      });

      // Total docs in DB must equal authenticFilesMigrated, NOT duplicated
      expect(totalDocs.docs.length).toBe(secondReport.authenticFilesMigrated);
    });

    it('allows unauthenticated visitors to read authentic public media assets', async () => {
      const publicQuery = await payload.find({
        collection: 'media',
        where: {
          mediaType: { equals: 'public' },
        },
        overrideAccess: false,
        user: undefined,
        limit: 10,
      });

      expect(publicQuery.docs.length).toBeGreaterThan(0);
      for (const doc of publicQuery.docs) {
        expect(doc.mediaType).toBe('public');
      }
    });
  });
});

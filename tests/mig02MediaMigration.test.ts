import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import type { Payload } from 'payload';
import path from 'node:path';
import fs from 'node:fs';
import { importMedia } from '../src/scripts/migration/importMedia';
import {
  allCatalogedMedia,
  legacyClientLogos,
  legacyAgencyBranding,
} from '../src/scripts/migration/data/legacyMedia';
import { privateUploadDir } from '../src/modules/customization/collections/Media';

describe('MIG-02: Media Asset Migration & Filesystem Pipeline', () => {
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
        // ignore cleanup error
      }
    }
  });

  it('correctly cataloged 22 client logos and 5 agency branding assets', () => {
    expect(legacyClientLogos.length).toBe(22);
    expect(legacyAgencyBranding.length).toBe(5);
    expect(allCatalogedMedia.length).toBe(27);

    // Verify key audited clients from AUD-03
    const slugs = allCatalogedMedia.map((m) => m.filename);
    expect(slugs).toContain('oxford.png');
    expect(slugs).toContain('bico-misr.png');
    expect(slugs).toContain('truedent.png');
    expect(slugs).toContain('Logo_MWHEBA-Wide-scaled.png');
    expect(slugs).toContain('MWHEBA-Logo.jpg');
  });

  it('imports all 27 cataloged image assets into media collection with public accessibility', async () => {
    const summary = await importMedia(payload);

    expect(summary.total).toBe(27);
    expect(summary.created + summary.updated).toBe(27);

    // Query all created records
    const allMedia = await payload.find({
      collection: 'media',
      where: {
        filename: {
          in: allCatalogedMedia.map((m) => m.filename),
        },
      },
      limit: 100,
      overrideAccess: true,
    });

    expect(allMedia.docs.length).toBe(27);

    for (const doc of allMedia.docs) {
      createdMediaIds.push(doc.id);

      // Verify mediaType is public
      expect(doc.mediaType).toBe('public');

      // Verify alt text is populated
      expect(doc.alt).toBeDefined();
      expect((doc.alt as string).length).toBeGreaterThan(0);

      // Verify physical file was written to disk in upload directory
      const filePath = path.join(privateUploadDir, doc.filename as string);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('demonstrates 100% idempotency: running importMedia again updates in-place without creating duplicates', async () => {
    const secondSummary = await importMedia(payload);

    expect(secondSummary.created).toBe(0);
    expect(secondSummary.updated).toBe(27);
    expect(secondSummary.total).toBe(27);

    const checkTotal = await payload.find({
      collection: 'media',
      where: {
        filename: {
          in: allCatalogedMedia.map((m) => m.filename),
        },
      },
      limit: 100,
      overrideAccess: true,
    });

    // Count must remain exactly 27, not 54
    expect(checkTotal.docs.length).toBe(27);
  });

  it('allows unauthenticated visitors to read public media assets', async () => {
    const publicQuery = await payload.find({
      collection: 'media',
      where: {
        filename: { equals: 'oxford.png' },
      },
      overrideAccess: false, // Simulate unauthenticated public request
      user: undefined,
    });

    expect(publicQuery.docs.length).toBe(1);
    expect(publicQuery.docs[0].mediaType).toBe('public');
    expect(publicQuery.docs[0].alt).toContain('أوكسفورد');
  });
});

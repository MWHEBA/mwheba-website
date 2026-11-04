import type { Payload } from 'payload';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { allCatalogedMedia, type LegacyMediaAsset } from './data/legacyMedia';
import { logger } from '../../shared/lib/logger';
import { privateUploadDir } from '../../modules/customization/collections/Media';

export interface MigratedAssetDetail {
  id: string;
  catalogFilename: string;
  size: number;
  fingerprint: string;
  mimeType: string;
  resolvedFrom: string;
}

export interface PendingAssetDetail {
  id: string;
  catalogFilename: string;
  category: string;
  status: 'pending_source_file';
  reason: string;
  legacySourceNote: string;
}

export interface MediaMigrationReport {
  totalCataloged: number;
  authenticFilesMigrated: number;
  pendingSourceFiles: number;
  migratedItems: MigratedAssetDetail[];
  pendingItems: PendingAssetDetail[];
}

/**
 * Validates image buffer magic bytes against expected MIME formats.
 */
export function detectAndVerifyImageBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length < 500) {
    throw new Error(`Buffer rejected: invalid or dummy file size (${buffer?.length ?? 0} bytes). Must be authentic asset >= 500 bytes.`);
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // SVG: starts with <svg or <?xml
  const textHead = buffer.subarray(0, 200).toString('utf8').trim().toLowerCase();
  if (textHead.includes('<svg') || textHead.includes('<?xml')) {
    return 'image/svg+xml';
  }

  throw new Error(`Buffer rejected: magic bytes do not match authentic image format.`);
}

/**
 * Purges any previously generated dummy placeholder records (filesize < 500 bytes).
 */
export async function purgeDummyMediaRecords(payload: Payload): Promise<number> {
  const dummyDocs = await payload.find({
    collection: 'media',
    where: {
      filesize: { less_than: 500 },
    },
    limit: 500,
    overrideAccess: true,
  });

  let purged = 0;
  for (const doc of dummyDocs.docs) {
    try {
      await payload.delete({
        collection: 'media',
        id: doc.id,
        overrideAccess: true,
      });
      purged++;
    } catch {
      // ignore
    }
  }

  if (purged > 0) {
    logger.info(`Purged ${purged} dummy/placeholder media records from database.`);
  }
  return purged;
}

/**
 * Ingests only verified authentic media source files into Payload.
 * Assets without physical source files remain in 'pending_source_file' status without placeholder creation.
 */
export async function importMedia(
  payload: Payload,
  assets: LegacyMediaAsset[] = allCatalogedMedia,
  baseDir: string = process.cwd(),
): Promise<MediaMigrationReport> {
  logger.info(`Starting strict media migration: ${assets.length} cataloged assets...`);

  // Purge any dummy records first
  await purgeDummyMediaRecords(payload);

  if (!fs.existsSync(privateUploadDir)) {
    fs.mkdirSync(privateUploadDir, { recursive: true });
  }

  const migratedItems: MigratedAssetDetail[] = [];
  const pendingItems: PendingAssetDetail[] = [];

  for (const asset of assets) {
    let resolvedSourcePath: string | null = null;

    // Search for genuine source file on disk
    for (const candidate of asset.candidateSourcePaths) {
      const fullPath = path.resolve(baseDir, candidate);
      if (fs.existsSync(fullPath)) {
        resolvedSourcePath = fullPath;
        break;
      }
    }

    if (!resolvedSourcePath) {
      // STRICT RULE: No physical file found -> do NOT create dummy placeholder.
      // Retain asset in "pending_source_file" status.
      pendingItems.push({
        id: asset.id,
        catalogFilename: asset.catalogFilename,
        category: asset.category,
        status: 'pending_source_file',
        reason: 'Physical source asset not found on disk. Awaiting creative team delivery.',
        legacySourceNote: asset.legacySourceNote,
      });
      logger.info(`Asset [${asset.catalogFilename}] held in pending_source_file (no local source file).`);
      continue;
    }

    // Authentic file exists -> Read and verify
    const fileBuffer = fs.readFileSync(resolvedSourcePath);
    const detectedMime = detectAndVerifyImageBuffer(fileBuffer);
    const fingerprint = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existing = await payload.find({
      collection: 'media',
      where: {
        filename: { equals: asset.catalogFilename },
      },
      limit: 1,
      overrideAccess: true,
    });

    if (existing.docs.length > 0) {
      const doc = existing.docs[0];
      await payload.update({
        collection: 'media',
        id: doc.id,
        data: {
          alt: asset.altAr,
          mediaType: 'public',
        },
        overrideAccess: true,
      });
      logger.info(`Updated authentic media asset: ${asset.catalogFilename} (SHA256: ${fingerprint.slice(0, 12)})`);
    } else {
      await payload.create({
        collection: 'media',
        data: {
          alt: asset.altAr,
          mediaType: 'public',
        },
        file: {
          data: fileBuffer,
          name: asset.catalogFilename,
          mimetype: detectedMime,
          size: fileBuffer.length,
        },
        overrideAccess: true,
      });
      logger.info(`Ingested authentic media asset: ${asset.catalogFilename} (${fileBuffer.length} bytes, SHA256: ${fingerprint.slice(0, 12)})`);
    }

    migratedItems.push({
      id: asset.id,
      catalogFilename: asset.catalogFilename,
      size: fileBuffer.length,
      fingerprint,
      mimeType: detectedMime,
      resolvedFrom: resolvedSourcePath,
    });
  }

  logger.info(
    `Strict media migration finished: ${migratedItems.length} authentic files migrated, ${pendingItems.length} assets pending source.`,
  );

  return {
    totalCataloged: assets.length,
    authenticFilesMigrated: migratedItems.length,
    pendingSourceFiles: pendingItems.length,
    migratedItems,
    pendingItems,
  };
}

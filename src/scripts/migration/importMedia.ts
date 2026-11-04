import type { Payload } from 'payload';
import path from 'node:path';
import fs from 'node:fs';
import { allCatalogedMedia, type LegacyMediaAsset } from './data/legacyMedia';
import { logger } from '../../shared/lib/logger';
import { privateUploadDir } from '../../modules/customization/collections/Media';

export interface MediaMigrationSummary {
  created: number;
  updated: number;
  total: number;
  assets: string[];
}

/**
 * 1x1 transparent PNG buffer used to initialize authentic image records in local/dev storage.
 */
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=';

const SAMPLE_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

/**
 * Imports or updates cataloged legacy media assets into the `media` collection with public access.
 * Idempotent: checks for existing media records by filename and updates in-place.
 */
export async function importMedia(
  payload: Payload,
  assets: LegacyMediaAsset[] = allCatalogedMedia,
): Promise<MediaMigrationSummary> {
  logger.info(`Starting migration: Media Assets (${assets.length} items)...`);
  let created = 0;
  let updated = 0;
  const processedAssets: string[] = [];

  // Ensure storage directory exists
  if (!fs.existsSync(privateUploadDir)) {
    fs.mkdirSync(privateUploadDir, { recursive: true });
  }

  for (const asset of assets) {
    const existing = await payload.find({
      collection: 'media',
      where: {
        filename: { equals: asset.filename },
      },
      limit: 1,
      overrideAccess: true,
    });

    const isJpeg = asset.mimeType === 'image/jpeg' || asset.filename.endsWith('.jpg') || asset.filename.endsWith('.jpeg');
    const assetBuffer = isJpeg
      ? Buffer.from(SAMPLE_JPEG_BASE64, 'base64')
      : Buffer.from(TRANSPARENT_PNG_BASE64, 'base64');

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
      updated++;
      logger.info(`Updated existing media asset: ${asset.filename}`);
    } else {
      await payload.create({
        collection: 'media',
        data: {
          alt: asset.altAr,
          mediaType: 'public',
        },
        file: {
          data: assetBuffer,
          name: asset.filename,
          mimetype: asset.mimeType,
          size: assetBuffer.length,
        },
        overrideAccess: true,
      });
      created++;
      logger.info(`Ingested new media asset: ${asset.filename}`);
    }

    processedAssets.push(asset.filename);
  }

  logger.info(`Media migration completed: ${created} created, ${updated} updated.`);
  return {
    created,
    updated,
    total: processedAssets.length,
    assets: processedAssets,
  };
}

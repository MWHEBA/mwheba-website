import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Migration 20261104_083000_update_artwork_scan_status_default
 *
 * Updates default of artwork_assets.scan_status to 'unscanned'
 * so that format validation is not erroneously recorded as a malware antivirus clearance.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "artwork_assets"
      ALTER COLUMN "scan_status" SET DEFAULT 'unscanned';

    UPDATE "artwork_assets"
      SET "scan_status" = 'unscanned'
      WHERE "scan_status" = 'clean';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "artwork_assets"
      ALTER COLUMN "scan_status" SET DEFAULT 'clean';
  `);
}

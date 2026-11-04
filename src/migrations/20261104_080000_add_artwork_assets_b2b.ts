import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Migration 20261104_080000_add_artwork_assets_b2b
 *
 * Implements Ticket B2B-03: Line-Level Artwork Asset Management.
 * 1. Adds owner_session (for guest cart session tracking)
 * 2. Adds cart_id foreign relation to carts table
 * 3. Adds line_item_id for line-level customization binding
 * 4. Adds lifecycle status ('pending_order', 'committed_order', 'archived')
 * 5. Adds sha256 checksum and scan_status for malware prevention
 * 6. Adds indices on cart_id and owner_session
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "artwork_assets"
      ADD COLUMN IF NOT EXISTS "owner_session" varchar(128),
      ADD COLUMN IF NOT EXISTS "cart_id" integer REFERENCES "carts"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "line_item_id" varchar(128),
      ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'pending_order',
      ADD COLUMN IF NOT EXISTS "sha256" varchar(64),
      ADD COLUMN IF NOT EXISTS "scan_status" varchar(32) DEFAULT 'clean';

    CREATE INDEX IF NOT EXISTS "idx_artwork_assets_cart" ON "artwork_assets"("cart_id");
    CREATE INDEX IF NOT EXISTS "idx_artwork_assets_owner_session" ON "artwork_assets"("owner_session");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "idx_artwork_assets_owner_session";
    DROP INDEX IF EXISTS "idx_artwork_assets_cart";

    ALTER TABLE "artwork_assets"
      DROP COLUMN IF EXISTS "scan_status",
      DROP COLUMN IF EXISTS "sha256",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "line_item_id",
      DROP COLUMN IF EXISTS "cart_id",
      DROP COLUMN IF EXISTS "owner_session";
  `);
}

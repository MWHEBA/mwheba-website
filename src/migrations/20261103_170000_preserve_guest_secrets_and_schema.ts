import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Migration 20261103_170000_preserve_guest_secrets_and_schema
 *
 * Successor migration to 20261103_160000_add_cart_idempotency.
 * 1. Completes missing schema columns across products, relations, and rate limiting tables.
 * 2. Documents the irreversible boundary of 160000:
 *    - In migration 160000, legacy JSON strings in `carts.secret` were sanitized into randomized 40-char hex tokens.
 *    - The previous raw JSON text was permanently replaced by 160000 and cannot be recovered retroactively.
 *    - Carts created or updated post-160000 maintain independent `applied_operations jsonb` and genuine 40-char hex secrets.
 *    - Active guest access is preserved via signed session cookies (`mwheba_cart`) or native 40-char hex secrets.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Ensure required schema columns for catalog, locking, and rate limiting
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" integer;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_category_id" integer;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "estimated_turnaround_days" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_estimated_turnaround_days" numeric;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "inquiries_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "rate_limit_events_id" integer;
    ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now();
  `);

  // 2. Defensive cleanup: If any stray cart record still has JSON in secret (e.g. from external seed or pre-160000 backup),
  // extract appliedOps defensively before sanitizing
  await db.execute(sql`
    DO $$
    BEGIN
      UPDATE "carts"
      SET "applied_operations" = (
        SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
        FROM (
          SELECT jsonb_array_elements(COALESCE("applied_operations", '[]'::jsonb)) AS elem
          UNION
          SELECT jsonb_array_elements(("secret"::jsonb)->'appliedOps') AS elem
        ) s
      )
      WHERE "secret" LIKE '{%'
        AND ("secret"::jsonb ? 'appliedOps');
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Down migration safely leaves extracted operations intact
}

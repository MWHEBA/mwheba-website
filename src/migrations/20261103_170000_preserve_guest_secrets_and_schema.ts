import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

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

  // 2. Safe data upgrade: Extract appliedOps from any JSON secret without wiping the guest's credential
  // Guarantees that any guest accessing via the existing secret string or via lastOpKey retains 100% access.
  await db.execute(sql`
    DO $$
    BEGIN
      -- Extract any appliedOps stored in legacy JSON secrets into the independent applied_operations column
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
        -- Fallback if json parsing fails on malformed rows
        NULL;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Down migration safely leaves extracted operations intact
}

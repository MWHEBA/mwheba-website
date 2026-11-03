import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Add dedicated independent applied_operations column to carts and ensure missing relations
  await db.execute(sql`
    ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "applied_operations" jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" integer;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_category_id" integer;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "estimated_turnaround_days" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_estimated_turnaround_days" numeric;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "inquiries_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "rate_limit_events_id" integer;
    ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now();
  `);

  // 2. Sanitize and restore any existing secret values that were polluted with JSON strings
  // Preserves genuine hex secrets untouched, while resetting any corrupted JSON string back to a valid 40-character hex secret
  await db.execute(sql`
    UPDATE "carts"
    SET "secret" = substr(md5(random()::text || id::text) || md5(id::text || clock_timestamp()::text), 1, 40)
    WHERE "secret" LIKE '{%' OR "secret" LIKE '%appliedOps%';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "carts" DROP COLUMN IF EXISTS "applied_operations";
  `);
}

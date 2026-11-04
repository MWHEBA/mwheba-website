import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_tax_review_status" AS ENUM('pending_accountant_review', 'tax_exempt', 'tax_applied');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_amount" numeric DEFAULT 0;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_review_status" "enum_orders_tax_review_status" DEFAULT 'pending_accountant_review';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "grand_total_piastres" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reconciliation_reference" varchar;
  `);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "reconciliation_reference";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "grand_total_piastres";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "tax_review_status";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "tax_amount";
    DROP TYPE IF EXISTS "public"."enum_orders_tax_review_status";
  `);
}

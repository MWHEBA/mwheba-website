import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_commerce_settings_bank_details_status" AS ENUM('pending_configuration', 'active');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "bank_details_status" "enum_commerce_settings_bank_details_status" DEFAULT 'pending_configuration' NOT NULL;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "bank_name" varchar;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "account_name" varchar;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "account_number" varchar;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "iban" varchar;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "swift_code" varchar;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "instapay_handle" varchar;
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "bank_instructions" varchar;
  `);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "bank_instructions";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "instapay_handle";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "swift_code";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "iban";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "account_number";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "account_name";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "bank_name";
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "bank_details_status";
    DROP TYPE IF EXISTS "public"."enum_commerce_settings_bank_details_status";
  `);
}

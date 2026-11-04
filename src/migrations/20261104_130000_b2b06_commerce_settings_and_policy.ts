import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_commerce_settings_tariff_status" AS ENUM('provisional', 'owner_approved');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_commerce_settings_production_policy" AS ENUM('require_payment_clearance', 'allow_immediate_production');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_commerce_settings_email_dispatch_mode" AS ENUM('deferred_review', 'live_smtp');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "commerce_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "tariff_status" "enum_commerce_settings_tariff_status" DEFAULT 'provisional' NOT NULL,
      "cairo_and_giza_fee" numeric DEFAULT 80 NOT NULL,
      "alexandria_fee" numeric DEFAULT 90 NOT NULL,
      "other_governorates_fee" numeric DEFAULT 120 NOT NULL,
      "office_pickup_fee" numeric DEFAULT 0 NOT NULL,
      "standard_fallback_fee" numeric DEFAULT 150 NOT NULL,
      "production_policy" "enum_commerce_settings_production_policy" DEFAULT 'require_payment_clearance' NOT NULL,
      "email_dispatch_mode" "enum_commerce_settings_email_dispatch_mode" DEFAULT 'deferred_review' NOT NULL,
      "smtp_host" varchar,
      "smtp_port" numeric,
      "smtp_user" varchar,
      "from_email" varchar,
      "change_log" jsonb DEFAULT '[]'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );

    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "applied_tariff" jsonb;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "applied_production_policy" varchar DEFAULT 'require_payment_clearance';
  `);
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "applied_production_policy";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "applied_tariff";
    DROP TABLE IF EXISTS "commerce_settings";
    DROP TYPE IF EXISTS "public"."enum_commerce_settings_email_dispatch_mode";
    DROP TYPE IF EXISTS "public"."enum_commerce_settings_production_policy";
    DROP TYPE IF EXISTS "public"."enum_commerce_settings_tariff_status";
  `);
}

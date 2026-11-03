import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_inquiries_service_interest" AS ENUM('branding', 'marketing', 'merchandise', 'media', 'general');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
    CREATE TYPE "public"."enum_inquiries_estimated_budget" AS ENUM('under_50k', '50k_150k', '150k_500k', 'above_500k', 'undisclosed');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
    CREATE TYPE "public"."enum_inquiries_status" AS ENUM('new', 'in_progress', 'contacted', 'closed', 'spam');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
    CREATE TYPE "public"."enum_inquiries_email_delivery_status" AS ENUM('pending', 'sent', 'failed', 'requires_manual_followup', 'skipped_review_mode');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;

   CREATE TABLE IF NOT EXISTS "inquiries" (
    "id" serial PRIMARY KEY NOT NULL,
    "full_name" varchar NOT NULL,
    "email" varchar NOT NULL,
    "phone" varchar NOT NULL,
    "company_name" varchar,
    "service_interest" "enum_inquiries_service_interest" DEFAULT 'general' NOT NULL,
    "estimated_budget" "enum_inquiries_estimated_budget",
    "project_details" varchar NOT NULL,
    "status" "enum_inquiries_status" DEFAULT 'new',
    "ip_address" varchar,
    "email_delivery_status" "enum_inquiries_email_delivery_status" DEFAULT 'pending',
    "email_delivery_error" varchar,
    "email_delivery_attempts" numeric DEFAULT 0,
    "email_delivered_at" timestamp(3) with time zone,
    "email_recipient" varchar,
    "notes" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE TABLE IF NOT EXISTS "inquiry_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "recipient_email" varchar DEFAULT 'sales@mwheba.com' NOT NULL,
    "email_subject_template" varchar DEFAULT '[MWHEBA Lead] استفسار مشروع جديد من {{fullName}} ({{companyName}})' NOT NULL,
    "email_body_template" varchar NOT NULL,
    "enable_real_dispatch" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
   );

   CREATE TABLE IF NOT EXISTS "rate_limit_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE INDEX IF NOT EXISTS "rate_limit_events_key_created_idx" ON "rate_limit_events" USING btree ("key", "created_at");
   CREATE INDEX IF NOT EXISTS "inquiries_created_at_idx" ON "inquiries" USING btree ("created_at");
   CREATE INDEX IF NOT EXISTS "inquiries_ip_created_idx" ON "inquiries" USING btree ("ip_address", "created_at");
   CREATE INDEX IF NOT EXISTS "inquiries_status_idx" ON "inquiries" USING btree ("status");
   CREATE INDEX IF NOT EXISTS "inquiries_email_delivery_status_idx" ON "inquiries" USING btree ("email_delivery_status");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "rate_limit_events" CASCADE;
   DROP TABLE IF EXISTS "inquiry_settings" CASCADE;
   DROP TABLE IF EXISTS "inquiries" CASCADE;
   DROP TYPE IF EXISTS "public"."enum_inquiries_email_delivery_status";
   DROP TYPE IF EXISTS "public"."enum_inquiries_status";
   DROP TYPE IF EXISTS "public"."enum_inquiries_estimated_budget";
   DROP TYPE IF EXISTS "public"."enum_inquiries_service_interest";
  `);
}

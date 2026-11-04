import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * B2B-05: fulfillment_jobs (per-line physical/service tracks) and service_briefs (creative intake).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_fulfillment_jobs_track" AS ENUM('physical', 'service');
    CREATE TYPE "public"."enum_fulfillment_jobs_status" AS ENUM('pending_artwork_approval', 'queued', 'in_printing', 'quality_check', 'ready_for_pickup', 'shipped', 'delivered', 'pending_brief', 'brief_submitted', 'in_progress', 'review', 'completed');
    CREATE TYPE "public"."enum_service_briefs_notification_status" AS ENUM('pending', 'sent', 'failed');

    CREATE TABLE "fulfillment_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_id" integer NOT NULL,
      "line_index" numeric NOT NULL,
      "track" "enum_fulfillment_jobs_track" NOT NULL,
      "status" "enum_fulfillment_jobs_status" NOT NULL,
      "customized" boolean DEFAULT false,
      "artwork_asset_id" varchar,
      "product_title" varchar,
      "quantity" numeric,
      "printing_notes" varchar,
      "status_history" jsonb DEFAULT '[]'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "service_briefs" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_id" integer NOT NULL,
      "job_id" integer NOT NULL,
      "customer_id" integer NOT NULL,
      "answers" jsonb NOT NULL,
      "attachment_asset_ids" jsonb DEFAULT '[]'::jsonb,
      "submitted_at" timestamp(3) with time zone NOT NULL,
      "notification_status" "enum_service_briefs_notification_status" DEFAULT 'pending',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fulfillment_jobs_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_briefs_id" integer;

    ALTER TABLE "fulfillment_jobs" ADD CONSTRAINT "fulfillment_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "service_briefs" ADD CONSTRAINT "service_briefs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "service_briefs" ADD CONSTRAINT "service_briefs_job_id_fulfillment_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."fulfillment_jobs"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "service_briefs" ADD CONSTRAINT "service_briefs_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fulfillment_jobs_fk" FOREIGN KEY ("fulfillment_jobs_id") REFERENCES "public"."fulfillment_jobs"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_briefs_fk" FOREIGN KEY ("service_briefs_id") REFERENCES "public"."service_briefs"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "fulfillment_jobs_order_idx" ON "fulfillment_jobs" USING btree ("order_id");
    CREATE INDEX "fulfillment_jobs_status_idx" ON "fulfillment_jobs" USING btree ("status");
    CREATE INDEX "fulfillment_jobs_updated_at_idx" ON "fulfillment_jobs" USING btree ("updated_at");
    CREATE INDEX "fulfillment_jobs_created_at_idx" ON "fulfillment_jobs" USING btree ("created_at");
    CREATE INDEX "service_briefs_order_idx" ON "service_briefs" USING btree ("order_id");
    CREATE INDEX "service_briefs_job_idx" ON "service_briefs" USING btree ("job_id");
    CREATE INDEX "service_briefs_customer_idx" ON "service_briefs" USING btree ("customer_id");
    CREATE INDEX "service_briefs_updated_at_idx" ON "service_briefs" USING btree ("updated_at");
    CREATE INDEX "service_briefs_created_at_idx" ON "service_briefs" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_fulfillment_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("fulfillment_jobs_id");
    CREATE INDEX "payload_locked_documents_rels_service_briefs_id_idx" ON "payload_locked_documents_rels" USING btree ("service_briefs_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_service_briefs_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fulfillment_jobs_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_service_briefs_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_fulfillment_jobs_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "service_briefs_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fulfillment_jobs_id";
    DROP TABLE IF EXISTS "service_briefs" CASCADE;
    DROP TABLE IF EXISTS "fulfillment_jobs" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_service_briefs_notification_status";
    DROP TYPE IF EXISTS "public"."enum_fulfillment_jobs_status";
    DROP TYPE IF EXISTS "public"."enum_fulfillment_jobs_track";
  `);
}

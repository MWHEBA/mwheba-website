import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_portfolio_projects_service_category" AS ENUM('branding', 'digital_marketing', 'corporate_gifts', 'media_production');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   DO $$ BEGIN
    CREATE TYPE "public"."enum_portfolio_projects_status" AS ENUM('draft', 'published');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   DO $$ BEGIN
    CREATE TYPE "public"."enum__portfolio_projects_v_version_service_category" AS ENUM('branding', 'digital_marketing', 'corporate_gifts', 'media_production');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   DO $$ BEGIN
    CREATE TYPE "public"."enum__portfolio_projects_v_version_status" AS ENUM('draft', 'published');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   DO $$ BEGIN
    CREATE TYPE "public"."enum__portfolio_projects_v_published_locale" AS ENUM('ar', 'en');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
  CREATE TABLE IF NOT EXISTS "portfolio_projects_deliverables" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "portfolio_projects_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"metric" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "portfolio_projects_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_url" varchar,
  	"alt" varchar,
  	"caption" varchar
  );
  
  CREATE TABLE "portfolio_projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"service_category" "enum_portfolio_projects_service_category" DEFAULT 'branding',
  	"project_date" varchar,
  	"featured" boolean DEFAULT false,
  	"cover_image_id" integer,
  	"cover_image_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_portfolio_projects_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "portfolio_projects_locales" (
  	"title" varchar,
  	"client_name" varchar,
  	"industry" varchar,
  	"summary" varchar,
  	"cover_image_alt" varchar,
  	"narrative" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_portfolio_projects_v_version_deliverables" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_portfolio_projects_v_version_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"metric" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_portfolio_projects_v_version_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_url" varchar,
  	"alt" varchar,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_portfolio_projects_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_service_category" "enum__portfolio_projects_v_version_service_category" DEFAULT 'branding',
  	"version_project_date" varchar,
  	"version_featured" boolean DEFAULT false,
  	"version_cover_image_id" integer,
  	"version_cover_image_url" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__portfolio_projects_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__portfolio_projects_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_portfolio_projects_v_locales" (
  	"version_title" varchar,
  	"version_client_name" varchar,
  	"version_industry" varchar,
  	"version_summary" varchar,
  	"version_cover_image_alt" varchar,
  	"version_narrative" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "portfolio_projects_id" integer;
  ALTER TABLE "portfolio_projects_deliverables" ADD CONSTRAINT "portfolio_projects_deliverables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "portfolio_projects_results" ADD CONSTRAINT "portfolio_projects_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "portfolio_projects_gallery" ADD CONSTRAINT "portfolio_projects_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portfolio_projects_gallery" ADD CONSTRAINT "portfolio_projects_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portfolio_projects_locales" ADD CONSTRAINT "portfolio_projects_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v_version_deliverables" ADD CONSTRAINT "_portfolio_projects_v_version_deliverables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portfolio_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v_version_results" ADD CONSTRAINT "_portfolio_projects_v_version_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portfolio_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v_version_gallery" ADD CONSTRAINT "_portfolio_projects_v_version_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v_version_gallery" ADD CONSTRAINT "_portfolio_projects_v_version_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portfolio_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v" ADD CONSTRAINT "_portfolio_projects_v_parent_id_portfolio_projects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v" ADD CONSTRAINT "_portfolio_projects_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portfolio_projects_v_locales" ADD CONSTRAINT "_portfolio_projects_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portfolio_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "portfolio_projects_deliverables_order_idx" ON "portfolio_projects_deliverables" USING btree ("_order");
  CREATE INDEX "portfolio_projects_deliverables_parent_id_idx" ON "portfolio_projects_deliverables" USING btree ("_parent_id");
  CREATE INDEX "portfolio_projects_deliverables_locale_idx" ON "portfolio_projects_deliverables" USING btree ("_locale");
  CREATE INDEX "portfolio_projects_results_order_idx" ON "portfolio_projects_results" USING btree ("_order");
  CREATE INDEX "portfolio_projects_results_parent_id_idx" ON "portfolio_projects_results" USING btree ("_parent_id");
  CREATE INDEX "portfolio_projects_results_locale_idx" ON "portfolio_projects_results" USING btree ("_locale");
  CREATE INDEX "portfolio_projects_gallery_order_idx" ON "portfolio_projects_gallery" USING btree ("_order");
  CREATE INDEX "portfolio_projects_gallery_parent_id_idx" ON "portfolio_projects_gallery" USING btree ("_parent_id");
  CREATE INDEX "portfolio_projects_gallery_locale_idx" ON "portfolio_projects_gallery" USING btree ("_locale");
  CREATE INDEX "portfolio_projects_gallery_image_idx" ON "portfolio_projects_gallery" USING btree ("image_id");
  CREATE UNIQUE INDEX "portfolio_projects_slug_idx" ON "portfolio_projects" USING btree ("slug");
  CREATE INDEX "portfolio_projects_cover_image_idx" ON "portfolio_projects" USING btree ("cover_image_id");
  CREATE INDEX "portfolio_projects_updated_at_idx" ON "portfolio_projects" USING btree ("updated_at");
  CREATE INDEX "portfolio_projects_created_at_idx" ON "portfolio_projects" USING btree ("created_at");
  CREATE INDEX "portfolio_projects__status_idx" ON "portfolio_projects" USING btree ("_status");
  CREATE UNIQUE INDEX "portfolio_projects_locales_locale_parent_id_unique" ON "portfolio_projects_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "portfolio_projects_locales_parent_id_idx" ON "portfolio_projects_locales" USING btree ("_parent_id");
  CREATE INDEX "_portfolio_projects_v_version_deliverables_order_idx" ON "_portfolio_projects_v_version_deliverables" USING btree ("_order");
  CREATE INDEX "_portfolio_projects_v_version_deliverables_parent_id_idx" ON "_portfolio_projects_v_version_deliverables" USING btree ("_parent_id");
  CREATE INDEX "_portfolio_projects_v_version_deliverables_locale_idx" ON "_portfolio_projects_v_version_deliverables" USING btree ("_locale");
  CREATE INDEX "_portfolio_projects_v_version_results_order_idx" ON "_portfolio_projects_v_version_results" USING btree ("_order");
  CREATE INDEX "_portfolio_projects_v_version_results_parent_id_idx" ON "_portfolio_projects_v_version_results" USING btree ("_parent_id");
  CREATE INDEX "_portfolio_projects_v_version_results_locale_idx" ON "_portfolio_projects_v_version_results" USING btree ("_locale");
  CREATE INDEX "_portfolio_projects_v_version_gallery_order_idx" ON "_portfolio_projects_v_version_gallery" USING btree ("_order");
  CREATE INDEX "_portfolio_projects_v_version_gallery_parent_id_idx" ON "_portfolio_projects_v_version_gallery" USING btree ("_parent_id");
  CREATE INDEX "_portfolio_projects_v_version_gallery_locale_idx" ON "_portfolio_projects_v_version_gallery" USING btree ("_locale");
  CREATE INDEX "_portfolio_projects_v_version_gallery_image_idx" ON "_portfolio_projects_v_version_gallery" USING btree ("image_id");
  CREATE INDEX "_portfolio_projects_v_parent_idx" ON "_portfolio_projects_v" USING btree ("parent_id");
  CREATE INDEX "_portfolio_projects_v_version_version_slug_idx" ON "_portfolio_projects_v" USING btree ("version_slug");
  CREATE INDEX "_portfolio_projects_v_version_version_cover_image_idx" ON "_portfolio_projects_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_portfolio_projects_v_version_version_updated_at_idx" ON "_portfolio_projects_v" USING btree ("version_updated_at");
  CREATE INDEX "_portfolio_projects_v_version_version_created_at_idx" ON "_portfolio_projects_v" USING btree ("version_created_at");
  CREATE INDEX "_portfolio_projects_v_version_version__status_idx" ON "_portfolio_projects_v" USING btree ("version__status");
  CREATE INDEX "_portfolio_projects_v_created_at_idx" ON "_portfolio_projects_v" USING btree ("created_at");
  CREATE INDEX "_portfolio_projects_v_updated_at_idx" ON "_portfolio_projects_v" USING btree ("updated_at");
  CREATE INDEX "_portfolio_projects_v_snapshot_idx" ON "_portfolio_projects_v" USING btree ("snapshot");
  CREATE INDEX "_portfolio_projects_v_published_locale_idx" ON "_portfolio_projects_v" USING btree ("published_locale");
  CREATE INDEX "_portfolio_projects_v_latest_idx" ON "_portfolio_projects_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_portfolio_projects_v_locales_locale_parent_id_unique" ON "_portfolio_projects_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_portfolio_projects_v_locales_parent_id_idx" ON "_portfolio_projects_v_locales" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portfolio_projects_fk" FOREIGN KEY ("portfolio_projects_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_portfolio_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("portfolio_projects_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "portfolio_projects_deliverables" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "portfolio_projects_results" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "portfolio_projects_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "portfolio_projects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "portfolio_projects_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portfolio_projects_v_version_deliverables" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portfolio_projects_v_version_results" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portfolio_projects_v_version_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portfolio_projects_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portfolio_projects_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "portfolio_projects_deliverables" CASCADE;
  DROP TABLE "portfolio_projects_results" CASCADE;
  DROP TABLE "portfolio_projects_gallery" CASCADE;
  DROP TABLE "portfolio_projects" CASCADE;
  DROP TABLE "portfolio_projects_locales" CASCADE;
  DROP TABLE "_portfolio_projects_v_version_deliverables" CASCADE;
  DROP TABLE "_portfolio_projects_v_version_results" CASCADE;
  DROP TABLE "_portfolio_projects_v_version_gallery" CASCADE;
  DROP TABLE "_portfolio_projects_v" CASCADE;
  DROP TABLE "_portfolio_projects_v_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_portfolio_projects_fk";
  
  DROP INDEX "payload_locked_documents_rels_portfolio_projects_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "portfolio_projects_id";
  DROP TYPE "public"."enum_portfolio_projects_service_category";
  DROP TYPE "public"."enum_portfolio_projects_status";
  DROP TYPE "public"."enum__portfolio_projects_v_version_service_category";
  DROP TYPE "public"."enum__portfolio_projects_v_version_status";
  DROP TYPE "public"."enum__portfolio_projects_v_published_locale";`)
}

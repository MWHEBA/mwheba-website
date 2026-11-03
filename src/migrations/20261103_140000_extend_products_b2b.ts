import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_product_type" AS ENUM('physical', 'fixed_service');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__products_v_version_product_type" AS ENUM('physical', 'fixed_service');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_type" "public"."enum_products_product_type" DEFAULT 'physical';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_artwork_upload" boolean DEFAULT true;

    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_description" text;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_product_type" "public"."enum__products_v_version_product_type" DEFAULT 'physical';
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_allow_artwork_upload" boolean DEFAULT true;

    ALTER TABLE "products_rels" ADD COLUMN IF NOT EXISTS "categories_id" integer;
    ALTER TABLE "_products_v_rels" ADD COLUMN IF NOT EXISTS "categories_id" integer;

    CREATE TABLE IF NOT EXISTS "products_service_deliverables" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "deliverable" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "products_service_deliverables_order_idx" ON "products_service_deliverables" ("_order");
    CREATE INDEX IF NOT EXISTS "products_service_deliverables_parent_id_idx" ON "products_service_deliverables" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "products_service_deliverables" ADD CONSTRAINT "products_service_deliverables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "_products_v_version_service_deliverables" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "deliverable" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "_products_v_version_service_deliverables_order_idx" ON "_products_v_version_service_deliverables" ("_order");
    CREATE INDEX IF NOT EXISTS "_products_v_version_service_deliverables_parent_id_idx" ON "_products_v_version_service_deliverables" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "_products_v_version_service_deliverables" ADD CONSTRAINT "_products_v_version_service_deliverables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "products_brief_questions" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "question" varchar NOT NULL,
      "required" boolean DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS "products_brief_questions_order_idx" ON "products_brief_questions" ("_order");
    CREATE INDEX IF NOT EXISTS "products_brief_questions_parent_id_idx" ON "products_brief_questions" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "products_brief_questions" ADD CONSTRAINT "products_brief_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "_products_v_version_brief_questions" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "question" varchar NOT NULL,
      "required" boolean DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS "_products_v_version_brief_questions_order_idx" ON "_products_v_version_brief_questions" ("_order");
    CREATE INDEX IF NOT EXISTS "_products_v_version_brief_questions_parent_id_idx" ON "_products_v_version_brief_questions" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "_products_v_version_brief_questions" ADD CONSTRAINT "_products_v_version_brief_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_products_v_version_brief_questions" CASCADE;
    DROP TABLE IF EXISTS "products_brief_questions" CASCADE;
    DROP TABLE IF EXISTS "_products_v_version_service_deliverables" CASCADE;
    DROP TABLE IF EXISTS "products_service_deliverables" CASCADE;

    ALTER TABLE "_products_v_rels" DROP COLUMN IF EXISTS "categories_id";
    ALTER TABLE "products_rels" DROP COLUMN IF EXISTS "categories_id";

    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_allow_artwork_upload";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_product_type";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_description";

    ALTER TABLE "products" DROP COLUMN IF EXISTS "allow_artwork_upload";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "product_type";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "description";

    DROP TYPE IF EXISTS "public"."enum__products_v_version_product_type";
    DROP TYPE IF EXISTS "public"."enum_products_product_type";
  `);
}

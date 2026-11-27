import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" ADD COLUMN "is_active" boolean DEFAULT true;
    -- Preserve existing assignments while enforcing integrity for future writes.
    ALTER TABLE "products" ADD CONSTRAINT "products_category_taxonomy_fk"
      FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict NOT VALID;
    ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_category_taxonomy_fk"
      FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict NOT VALID;

    CREATE TABLE "product_tags" (
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX "product_tags_slug_idx" ON "product_tags" USING btree ("slug");
    CREATE INDEX "product_tags_updated_at_idx" ON "product_tags" USING btree ("updated_at");
    CREATE INDEX "product_tags_created_at_idx" ON "product_tags" USING btree ("created_at");

    CREATE TABLE "product_tags_locales" (
      "title" varchar NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
    ALTER TABLE "product_tags_locales" ADD CONSTRAINT "product_tags_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade;
    CREATE UNIQUE INDEX "product_tags_locales_locale_parent_id_unique"
      ON "product_tags_locales" USING btree ("_locale", "_parent_id");
    CREATE INDEX "product_tags_locales_parent_id_idx" ON "product_tags_locales" USING btree ("_parent_id");

    ALTER TABLE "products_rels" ADD COLUMN "product_tags_id" integer;
    ALTER TABLE "_products_v_rels" ADD COLUMN "product_tags_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_tags_id" integer;
    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_product_tags_fk"
      FOREIGN KEY ("product_tags_id") REFERENCES "public"."product_tags"("id") ON DELETE restrict;
    ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_product_tags_fk"
      FOREIGN KEY ("product_tags_id") REFERENCES "public"."product_tags"("id") ON DELETE restrict;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_tags_fk"
      FOREIGN KEY ("product_tags_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade;
    CREATE INDEX "products_rels_product_tags_id_idx" ON "products_rels" USING btree ("product_tags_id");
    CREATE INDEX "_products_v_rels_product_tags_id_idx" ON "_products_v_rels" USING btree ("product_tags_id");
    CREATE INDEX "payload_locked_documents_rels_product_tags_id_idx"
      ON "payload_locked_documents_rels" USING btree ("product_tags_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "product_tags_id";
    ALTER TABLE "_products_v_rels" DROP COLUMN "product_tags_id";
    ALTER TABLE "products_rels" DROP COLUMN "product_tags_id";
    DROP TABLE "product_tags_locales";
    DROP TABLE "product_tags";
    ALTER TABLE "_products_v" DROP CONSTRAINT "_products_v_category_taxonomy_fk";
    ALTER TABLE "products" DROP CONSTRAINT "products_category_taxonomy_fk";
    ALTER TABLE "categories" DROP COLUMN "is_active";
  `);
}

import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN "sku" varchar;
    ALTER TABLE "variants" ADD COLUMN "sku" varchar;
    ALTER TABLE "_products_v" ADD COLUMN "version_sku" varchar;
    ALTER TABLE "_variants_v" ADD COLUMN "version_sku" varchar;

    CREATE TABLE "products_locales" (
      "storefront_title" varchar,
      "storefront_description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
    ALTER TABLE "products_locales" ADD CONSTRAINT "products_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade;
    CREATE UNIQUE INDEX "products_locales_locale_parent_id_unique"
      ON "products_locales" ("_locale", "_parent_id");
    CREATE INDEX "products_locales_parent_id_idx" ON "products_locales" ("_parent_id");

    CREATE TABLE "_products_v_locales" (
      "version_storefront_title" varchar,
      "version_storefront_description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
    ALTER TABLE "_products_v_locales" ADD CONSTRAINT "_products_v_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade;
    CREATE UNIQUE INDEX "_products_v_locales_locale_parent_id_unique"
      ON "_products_v_locales" ("_locale", "_parent_id");
    CREATE INDEX "_products_v_locales_parent_id_idx" ON "_products_v_locales" ("_parent_id");

    ALTER TABLE "products_rels" ADD COLUMN "media_id" integer;
    ALTER TABLE "_products_v_rels" ADD COLUMN "media_id" integer;
    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_media_fk"
      FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade;
    ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_media_fk"
      FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade;
    CREATE INDEX "products_rels_media_id_idx" ON "products_rels" ("media_id");
    CREATE INDEX "_products_v_rels_media_id_idx" ON "_products_v_rels" ("media_id");

    -- SKU columns are new. Existing merchants and order snapshots require no backfill.
    CREATE TABLE "catalog_sku_claims" (
      "sku" varchar(128) PRIMARY KEY,
      "collection" text NOT NULL,
      "record_id" integer NOT NULL
    );

    CREATE FUNCTION "catalog_trim_sku"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      -- Match String.prototype.trim() for writes outside Payload.
      NEW.sku := nullif(btrim(NEW.sku, U&'\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF'), '');
      RETURN NEW;
    END;
    $$;

    CREATE FUNCTION "catalog_claim_sku"() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      previous_key text;
      next_key text;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        previous_key := lower(OLD.sku);
      END IF;
      IF TG_OP <> 'DELETE' THEN
        next_key := lower(NEW.sku);
      END IF;
      IF TG_OP = 'UPDATE' AND previous_key IS NOT DISTINCT FROM next_key AND OLD.id = NEW.id THEN
        RETURN NULL;
      END IF;

      IF previous_key IS NOT NULL THEN
        DELETE FROM "public"."catalog_sku_claims"
          WHERE "sku" = previous_key AND "collection" = TG_TABLE_NAME AND "record_id" = OLD.id;
      END IF;
      IF next_key IS NOT NULL THEN
        INSERT INTO "public"."catalog_sku_claims" ("sku", "collection", "record_id")
          VALUES (next_key, TG_TABLE_NAME, NEW.id);
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE TRIGGER "products_trim_sku" BEFORE INSERT OR UPDATE OF "sku" ON "products"
      FOR EACH ROW EXECUTE FUNCTION "catalog_trim_sku"();
    CREATE TRIGGER "variants_trim_sku" BEFORE INSERT OR UPDATE OF "sku" ON "variants"
      FOR EACH ROW EXECUTE FUNCTION "catalog_trim_sku"();
    -- A single unique key serializes competing claims across both tables.
    CREATE TRIGGER "products_claim_sku" AFTER INSERT OR UPDATE OF "sku", "id" OR DELETE ON "products"
      FOR EACH ROW EXECUTE FUNCTION "catalog_claim_sku"();
    CREATE TRIGGER "variants_claim_sku" AFTER INSERT OR UPDATE OF "sku", "id" OR DELETE ON "variants"
      FOR EACH ROW EXECUTE FUNCTION "catalog_claim_sku"();
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER "products_claim_sku" ON "products";
    DROP TRIGGER "variants_claim_sku" ON "variants";
    DROP TRIGGER "products_trim_sku" ON "products";
    DROP TRIGGER "variants_trim_sku" ON "variants";
    DROP FUNCTION "catalog_claim_sku"();
    DROP FUNCTION "catalog_trim_sku"();
    DROP TABLE "catalog_sku_claims";

    DELETE FROM "products_rels" WHERE "media_id" IS NOT NULL;
    DELETE FROM "_products_v_rels" WHERE "media_id" IS NOT NULL;
    ALTER TABLE "products_rels" DROP COLUMN "media_id";
    ALTER TABLE "_products_v_rels" DROP COLUMN "media_id";
    DROP TABLE "_products_v_locales";
    DROP TABLE "products_locales";

    ALTER TABLE "_variants_v" DROP COLUMN "version_sku";
    ALTER TABLE "_products_v" DROP COLUMN "version_sku";
    ALTER TABLE "variants" DROP COLUMN "sku";
    ALTER TABLE "products" DROP COLUMN "sku";
  `);
}

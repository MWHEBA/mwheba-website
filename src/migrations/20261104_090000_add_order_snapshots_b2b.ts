import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 10001;

    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_method" varchar DEFAULT 'shipping';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_notes" text;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "company_name" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "contact_person" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "phone" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_id" varchar;

    CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" ("order_number");

    ALTER TABLE "orders_items" ADD COLUMN IF NOT EXISTS "product_title" varchar;
    ALTER TABLE "orders_items" ADD COLUMN IF NOT EXISTS "variant_title" varchar;
    ALTER TABLE "orders_items" ADD COLUMN IF NOT EXISTS "sku" varchar;
  `);
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "orders_order_number_idx";

    ALTER TABLE "orders" DROP COLUMN IF EXISTS "order_number";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_method";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillment_notes";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "company_name";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "contact_person";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "phone";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "tax_id";

    ALTER TABLE "orders_items" DROP COLUMN IF EXISTS "product_title";
    ALTER TABLE "orders_items" DROP COLUMN IF EXISTS "variant_title";
    ALTER TABLE "orders_items" DROP COLUMN IF EXISTS "sku";

    DROP SEQUENCE IF EXISTS "order_number_seq";
  `);
}

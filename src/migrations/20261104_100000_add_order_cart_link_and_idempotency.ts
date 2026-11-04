import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cart_id" integer;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar;

    DO $$ BEGIN
      ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "orders_cart_id_idx" ON "orders" ("cart_id");
    CREATE INDEX IF NOT EXISTS "orders_idempotency_key_idx" ON "orders" ("idempotency_key");
  `);
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "orders_idempotency_key_idx";
    DROP INDEX IF EXISTS "orders_cart_id_idx";
    ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_cart_id_carts_id_fk";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotency_key";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "cart_id";
  `);
}

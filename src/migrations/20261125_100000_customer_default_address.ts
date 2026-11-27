import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_addresses_country" ADD VALUE IF NOT EXISTS 'EG';
    ALTER TABLE "users" ADD COLUMN "default_address_id" integer;
    ALTER TABLE "users" ADD CONSTRAINT "users_default_address_id_addresses_id_fk"
      FOREIGN KEY ("default_address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;
    CREATE INDEX "users_default_address_idx" ON "users" ("default_address_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Keep the additive country value so rolling back the feature preserves Egyptian addresses.
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN "default_address_id";`);
}

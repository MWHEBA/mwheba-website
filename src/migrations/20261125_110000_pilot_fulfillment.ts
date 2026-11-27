import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "commerce_settings" ADD COLUMN IF NOT EXISTS "pilot_fulfillment" jsonb;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "commerce_settings" DROP COLUMN IF EXISTS "pilot_fulfillment";
  `);
}

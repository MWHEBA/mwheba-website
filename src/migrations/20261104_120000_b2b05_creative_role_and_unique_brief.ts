import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * B2B-05 follow-up:
 * - creative_director role (service intake team, separate from production `operations`)
 * - one brief per service job, enforced by a UNIQUE index so concurrent submissions cannot both win
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_users_roles" ADD VALUE IF NOT EXISTS 'creative_director';
  `);
  await db.execute(sql`
    DROP INDEX IF EXISTS "service_briefs_job_idx";
    CREATE UNIQUE INDEX "service_briefs_job_idx" ON "service_briefs" USING btree ("job_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot drop a single enum value; 'creative_director' is intentionally left in the type.
  await db.execute(sql`
    DROP INDEX IF EXISTS "service_briefs_job_idx";
    CREATE INDEX "service_briefs_job_idx" ON "service_briefs" USING btree ("job_id");
  `);
}

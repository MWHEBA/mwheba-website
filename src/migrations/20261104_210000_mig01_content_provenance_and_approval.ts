import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Enums for pages
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_source_origin" AS ENUM('legacy_site_audit_verified', 'new_draft_page');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_approval_status" AS ENUM('verified_from_v1', 'pending_owner_review');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_version_source_origin" AS ENUM('legacy_site_audit_verified', 'new_draft_page');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_version_approval_status" AS ENUM('verified_from_v1', 'pending_owner_review');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    -- Columns for pages
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "source_origin" "enum_pages_source_origin" DEFAULT 'legacy_site_audit_verified';
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "source_reference" varchar;
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "approval_status" "enum_pages_approval_status" DEFAULT 'verified_from_v1';

    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "version_source_origin" "enum__pages_v_version_source_origin" DEFAULT 'legacy_site_audit_verified';
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "version_source_reference" varchar;
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "version_approval_status" "enum__pages_v_version_approval_status" DEFAULT 'verified_from_v1';

    -- Enums for blog_posts
    DO $$ BEGIN
      CREATE TYPE "public"."enum_blog_posts_source_origin" AS ENUM('editorial_review_draft', 'legacy_migrated');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_blog_posts_approval_status" AS ENUM('pending_editorial_review', 'approved_for_publishing');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__blog_posts_v_version_source_origin" AS ENUM('editorial_review_draft', 'legacy_migrated');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__blog_posts_v_version_approval_status" AS ENUM('pending_editorial_review', 'approved_for_publishing');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    -- Columns for blog_posts
    ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "source_origin" "enum_blog_posts_source_origin" DEFAULT 'editorial_review_draft';
    ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "source_reference" varchar;
    ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "approval_status" "enum_blog_posts_approval_status" DEFAULT 'pending_editorial_review';

    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "version_source_origin" "enum__blog_posts_v_version_source_origin" DEFAULT 'editorial_review_draft';
    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "version_source_reference" varchar;
    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "version_approval_status" "enum__blog_posts_v_version_approval_status" DEFAULT 'pending_editorial_review';

    -- Enums for portfolio_projects
    DO $$ BEGIN
      CREATE TYPE "public"."enum_portfolio_projects_source_origin" AS ENUM('case_study_draft_pending_owner_data', 'verified_case_study');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_portfolio_projects_approval_status" AS ENUM('pending_case_study_data', 'approved_for_publishing');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__portfolio_projects_v_version_source_origin" AS ENUM('case_study_draft_pending_owner_data', 'verified_case_study');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__portfolio_projects_v_version_approval_status" AS ENUM('pending_case_study_data', 'approved_for_publishing');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    -- Columns for portfolio_projects
    ALTER TABLE "portfolio_projects" ADD COLUMN IF NOT EXISTS "source_origin" "enum_portfolio_projects_source_origin" DEFAULT 'case_study_draft_pending_owner_data';
    ALTER TABLE "portfolio_projects" ADD COLUMN IF NOT EXISTS "source_reference" varchar;
    ALTER TABLE "portfolio_projects" ADD COLUMN IF NOT EXISTS "approval_status" "enum_portfolio_projects_approval_status" DEFAULT 'pending_case_study_data';

    ALTER TABLE "_portfolio_projects_v" ADD COLUMN IF NOT EXISTS "version_source_origin" "enum__portfolio_projects_v_version_source_origin" DEFAULT 'case_study_draft_pending_owner_data';
    ALTER TABLE "_portfolio_projects_v" ADD COLUMN IF NOT EXISTS "version_source_reference" varchar;
    ALTER TABLE "_portfolio_projects_v" ADD COLUMN IF NOT EXISTS "version_approval_status" "enum__portfolio_projects_v_version_approval_status" DEFAULT 'pending_case_study_data';
  `);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "_portfolio_projects_v" DROP COLUMN IF EXISTS "version_approval_status";
    ALTER TABLE "_portfolio_projects_v" DROP COLUMN IF EXISTS "version_source_reference";
    ALTER TABLE "_portfolio_projects_v" DROP COLUMN IF EXISTS "version_source_origin";

    ALTER TABLE "portfolio_projects" DROP COLUMN IF EXISTS "approval_status";
    ALTER TABLE "portfolio_projects" DROP COLUMN IF EXISTS "source_reference";
    ALTER TABLE "portfolio_projects" DROP COLUMN IF EXISTS "source_origin";

    DROP TYPE IF EXISTS "public"."enum__portfolio_projects_v_version_approval_status";
    DROP TYPE IF EXISTS "public"."enum__portfolio_projects_v_version_source_origin";
    DROP TYPE IF EXISTS "public"."enum_portfolio_projects_approval_status";
    DROP TYPE IF EXISTS "public"."enum_portfolio_projects_source_origin";

    ALTER TABLE "_blog_posts_v" DROP COLUMN IF EXISTS "version_approval_status";
    ALTER TABLE "_blog_posts_v" DROP COLUMN IF EXISTS "version_source_reference";
    ALTER TABLE "_blog_posts_v" DROP COLUMN IF EXISTS "version_source_origin";

    ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "approval_status";
    ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "source_reference";
    ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "source_origin";

    DROP TYPE IF EXISTS "public"."enum__blog_posts_v_version_approval_status";
    DROP TYPE IF EXISTS "public"."enum__blog_posts_v_version_source_origin";
    DROP TYPE IF EXISTS "public"."enum_blog_posts_approval_status";
    DROP TYPE IF EXISTS "public"."enum_blog_posts_source_origin";

    ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_approval_status";
    ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_source_reference";
    ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_source_origin";

    ALTER TABLE "pages" DROP COLUMN IF EXISTS "approval_status";
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "source_reference";
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "source_origin";

    DROP TYPE IF EXISTS "public"."enum__pages_v_version_approval_status";
    DROP TYPE IF EXISTS "public"."enum__pages_v_version_source_origin";
    DROP TYPE IF EXISTS "public"."enum_pages_approval_status";
    DROP TYPE IF EXISTS "public"."enum_pages_source_origin";
  `);
}

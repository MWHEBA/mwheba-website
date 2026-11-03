# MWHEBA 2.0 | Phase 2: Foundation & Infrastructure Plan

**Phase:** Phase 2  
**Status:** مكتملة ومعتمدة من المالك (COMPLETED & APPROVED BY OWNER)  
**Mode:** IMPLEMENTED & APPROVED  
**Goal:** Initialize the production-grade application codebase, developer tooling, database migrations, CI/CD automation, environment templates, logging/observability, and RBAC baseline following successful completion and owner approval of the Phase 1 POC, extending the candidate ecommerce stack.

---

## 1. Overview & Context

Once the candidate architecture is validated in Phase 1, Phase 2 builds the permanent foundation of MWHEBA 2.0. This establishes strict TypeScript standards, automated linting/formatting, local PostgreSQL workflows, cPanel deployment checks, security policies, and health monitoring, while extending native plugin collections without unnecessary duplication.

- **Dependencies:** Approval of Phase 1 POC (`plans/02-commerce-feasibility-poc.md`).
- **Scope:**
  - Initialize clean Next.js 15+ App Router application with embedded Payload CMS v3 and configured `@payloadcms/plugin-ecommerce`.
  - Setup local Node.js and PostgreSQL development without containers, and verify the cPanel Node.js/PostgreSQL environment.
  - Configure TypeScript strict mode, ESLint, Prettier, and Git pre-commit hooks (Husky / lint-staged).
  - Setup database connection pooling, migration engine (`@payloadcms/db-postgres`), and automated rollback scripts.
  - Define core Role-Based Access Control (RBAC) collections and policies (Super Admin, Marketer, Catalog Manager, Order Operations, Finance).
  - Implement structured JSON logging (Pino), request tracing, and `/api/health` check endpoints.
  - Establish automated GitHub Actions CI workflow (lint, type-check, unit tests, secret scanning).
- **Out of Scope:**
  - Frontend visual UI design system (Phase 3).
  - Corporate page layouts or blog blocks (Phase 4).
  - Inventory tracking / stock management collections (omitted per D-018).
  - PDF invoicing generator or electronic tax integrations (omitted per D-016).

---

## 2. Work Breakdown & Concrete Tasks

### Ticket FND-01: Next.js & Payload CMS Monolith Scaffold
- **ID & Title:** FND-01: Application Scaffolding & Native Plugin Configuration
- **Business Outcome:** Stable, reproducible, type-safe application codebase capable of hosting both the public corporate/commerce frontend and the administrative dashboard.
- **Dependencies:** Phase 1 POC Approval.
- **Scope:**
  - Initialize Next.js project with App Router, TypeScript, and Tailwind CSS.
  - Integrate Payload CMS v3 embedded under `src/app/(payload)/admin`.
  - Integrate `@payloadcms/plugin-ecommerce` within `payload.config.ts`, extending native collections.
  - Establish clear directory structure reflecting domain boundaries:
    - `src/modules/content/` (pages, blocks, blog, portfolio)
    - `src/modules/catalog/` (products, variants, categories)
    - `src/modules/cart-checkout/` (cart lifecycle, MOQ validation, delivery selection)
    - `src/modules/customization/` (line-item artwork, printing notes)
    - `src/modules/orders/` (order lifecycle, line-item snapshots)
    - `src/modules/payments/` (Paymob adapter, bank transfer review)
    - `src/modules/identity/` (users, RBAC, seamless checkout auth)
    - `src/shared/ui/`
    - `src/shared/lib/`
  - Pin package dependencies in `package-lock.json`.
- **Out of Scope:** Component styling or marketing copy.
- **Implementation Approach:** Native Payload CMS v3 architecture extending official plugins.
- **Files/Modules Impacted:** `package.json`, `tsconfig.json`, `next.config.mjs`, `src/payload.config.ts`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - `npm run build` succeeds without type errors.
  - Admin panel is reachable at `/admin`.
  - Zero deprecated or unpinned dependencies.
- **Test Cases:** Run `npm run build` in a clean environment; assert 0 exit code.
- **Security/SEO Implications:** Base security headers configured in `next.config.mjs`.
- **Foundation Maintenance Note (FND-FIX-01 - PostgreSQL Adapter Hardening):** During strict TypeScript quality gate checks, an uninstalled dependency import (`@payloadcms/db-sqlite`) and ternary database selector in `src/payload.config.ts` (originally cloned from POC experimentation) triggered error `TS2307`. Resolved as a Foundation-level fix by removing the SQLite adapter import and binding directly to `postgresAdapter({ pool: { connectionString: dbUri } })`, reinforcing architectural adherence to PostgreSQL only.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Reset repository to initial commit.
- **Owner Approval Required:** No.

---

### Ticket FND-02: cPanel Runtime & Private Storage
- **ID & Title:** FND-02: Node.js, PostgreSQL, and Private Filesystem Configuration
- **Business Outcome:** The local application and cPanel deployment use compatible runtimes and durable private upload storage.
- **Dependencies:** FND-01.
- **Scope:**
  - Verify cPanel Node.js runtime (24.13.0 or 22.22.0) executes the pinned Payload 3.91.0 release (which declares `>=20.18.1`). Verify live PostgreSQL connectivity on cPanel, persistent Passenger process lifecycle, and restart controls. Do not attempt host-level Node 24.22 package upgrade. Docker is excluded.
  - Create `.env.example` documenting DB connection, Payload secret, private upload path, signing key, and dormant Paymob settings.
  - Configure Payload local file storage in an absolute persistent directory outside `public_html`, with restricted permissions and short-lived authorized download links.
  - Document backup and restore for both PostgreSQL and uploaded files.
- **Out of Scope:** Multi-node Kubernetes clustering.
- **Implementation Approach:** Native Node.js and PostgreSQL locally; cPanel application manager and private filesystem in production.
- **Files/Modules Impacted:** `.env.example`, `.gitignore`, `src/lib/storage.ts`, cPanel deployment runbook.
- **Database Changes:** PostgreSQL database `mwheba_dev` created.
- **Acceptance Criteria:**
  - The supported Node.js process connects to PostgreSQL and restarts cleanly on cPanel.
  - Uploading a media file stores bytes outside the web document root without database bloat or direct public access.
  - Zero sensitive credentials committed to Git.
- **Test Cases:** Connect to PostgreSQL, upload a test file, reject unauthenticated access, verify a signed download, and restore a backup copy.
- **Security/SEO Implications:** PostgreSQL stores records; media and artwork reside in private filesystem storage.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Revert application configuration and restore the prior database and upload directory backups.
- **Owner Approval Required:** No.

---

### Ticket FND-03: Database Migrations & Seed Harness
- **ID & Title:** FND-03: Migration Engine & Seed Scripts
- **Business Outcome:** Schema changes are fully versioned, reversible, repeatable across environments, and testable with mock agency data.
- **Dependencies:** FND-02.
- **Scope:**
  - Configure Payload database adapter (`@payloadcms/db-postgres`) with migration support.
  - Implement npm scripts: `npm run migrate:create`, `npm run migrate:up`, `npm run migrate:down`.
  - Create initial baseline migration script extending ecommerce collections.
  - Implement idempotently runnable seed script (`npm run db:seed`) providing base roles, super-admin, demo categories, sample thermal mug with variants, separate printing fee, and sample service package.
- **Out of Scope:** Production data import (deferred to Phase 7).
- **Implementation Approach:** Declarative migration files stored under `src/migrations/`.
- **Files/Modules Impacted:** `src/migrations/`, `src/scripts/seed.ts`, `package.json`.
- **Database Changes:** Core schema tables and `payload_migrations` tracking table.
- **Acceptance Criteria:**
  - `npm run migrate:up` executes cleanly on empty database.
  - `npm run migrate:down` reverts schema changes safely.
  - `npm run db:seed` provisions test admin and sample products without duplication on repeated runs.
- **Test Cases:** Run `migrate:up` -> `migrate:down` -> `migrate:up` in CI test job.
- **Security/SEO Implications:** App connects with restricted application user, not postgres superuser.
- **Estimate & Risk:** 1.5 days. Medium risk.
- **Rollback:** Execute down migration.
- **Owner Approval Required:** No.

---

### Ticket FND-04: Role-Based Access Control (RBAC) & Seamless Auth Baseline
- **ID & Title:** FND-04: RBAC Hierarchy & Server-Side Security Policies
- **Business Outcome:** Enforce strict organizational boundaries: marketers cannot alter payment records, warehouse operators cannot delete orders, and customer accounts are provisioned securely without temporary passwords.
- **Dependencies:** FND-03.
- **Scope:**
  - Model `Users` collection extending plugin users:
    - Roles: `super_admin`, `marketer`, `catalog_manager`, `operations`, `finance`, `customer`.
  - Seamless Auth Strategy:
    - Customer checkout registration allows customer to provide a password directly during checkout or uses passwordless auth sessions.
    - **Prohibited:** Generating insecure temporary passwords sent via unencrypted email.
  - Implement reusable access control helper functions (`isAdmin`, `isFinance`, `isSelfOrAdmin`, `hasRole`).
  - Secure artwork uploads so only owner and operations/finance/admin can access them.
- **Out of Scope:** Single Sign-On (SSO) / SAML integrations.
- **Implementation Approach:** Payload collection-level access rules evaluated server-side on every REST/GraphQL/Server Action call.
- **Files/Modules Impacted:** `src/modules/identity/collections/Users.ts`, `src/modules/identity/access/`, `src/modules/customization/collections/ArtworkAssets.ts`.
- **Database Changes:** Roles enum on `users` table.
- **Acceptance Criteria:**
  - Marketer attempting to mutate a payment record is rejected with 403 Forbidden.
  - Customer trying to access another customer's uploaded logo is blocked.
  - Customer account created at checkout is secure and requires no temporary password reset.
- **Test Cases:** Automated RBAC test matrix asserting 200 vs 403 for each role across all collections.
- **Security/SEO Implications:** Defense against privilege escalation and PII leakage.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert access policies to default.
- **Owner Approval Required:** Yes.

---

### Ticket FND-05: Logging, Tracing, Health Checks & CI/CD Pipeline
- **ID & Title:** FND-05: Observability, Health Endpoints & CI Pipeline
- **Business Outcome:** Immediate visibility into application health, database connectivity, and automated quality enforcement before code merges.
- **Dependencies:** FND-01 through FND-04.
- **Scope:**
  - Configure structured JSON logging with request ID correlation.
  - Implement `/api/health` endpoint reporting database ping, storage accessibility, and memory stats (without exposing secrets).
  - Setup GitHub Actions workflow `.github/workflows/ci.yml`:
    - Step 1: Linting (`eslint`) and formatting check (`prettier`).
    - Step 2: TypeScript strict check (`tsc --noEmit`).
    - Step 3: Run unit and integration tests against ephemeral PostgreSQL service.
    - Step 4: Secret scanner (Gitleaks / Trufflehog) preventing credential leaks.
- **Out of Scope:** Paid APM setups.
- **Implementation Approach:** Lightweight open-source tooling running in GitHub Actions.
- **Files/Modules Impacted:** `src/app/api/health/route.ts`, `src/shared/lib/logger.ts`, `.github/workflows/ci.yml`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Pull request triggers CI; any TypeScript error or failing test blocks merge.
  - Committing API keys or secrets triggers CI failure.
  - `/api/health` returns HTTP 200 with `{ status: "ok" }` when healthy and HTTP 503 if DB is down.
- **Test Cases:** Intentionally trigger health check with DB disconnected; assert 503 response.
- **Security/SEO Implications:** Enforces zero secrets in version control via automated secret-scanning pre-commit hooks and CI checks; facilitates uptime monitoring.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Disable CI job or revert endpoint.
- **Owner Approval Required:** No.

---

## 3. Risks & Mitigation
- **Risk:** Schema conflict between custom collections and plugin-owned collections.  
  *Mitigation:* Utilize official plugin extension hooks and custom fields documented in `@payloadcms/plugin-ecommerce`.
- **Risk:** Database connection pool saturation.  
  *Mitigation:* Configure PgBouncer / PostgreSQL connection pool limits in adapter options.

---

## 4. Phase Exit, Operational Gates & Owner Approval

1. **Compilation & Quality Checks:** Clean Next.js 15 + Payload 3.91.0 build (`Exit code: 0`), strict TypeScript check (`0 errors`), and Vitest test suite (18/18 tests passed 100%): **VERIFIED**.
2. **Database Migrations & Seed Harness:** PostgreSQL migrations up/down reversibility verified; idempotent seeds provisioned admin, staff roles, categories, products, and services: **VERIFIED**.
3. **RBAC & Security Baseline:** Multi-role access control and privilege escalation prevention verified: **VERIFIED**.
4. **Structured Logging & Health Check:** `/api/health` live and operational (`status: "healthy"`): **VERIFIED**.
5. **Clean Dependency Installation:** `npm ci` from root `package-lock.json` cleanly installed 453 packages without `--legacy-peer-deps` (`Exit code: 0`): **VERIFIED**.
6. **Remote GitHub Actions Execution:** The workflow file `.github/workflows/ci.yml` is prepared, but execution on GitHub is currently **UNVERIFIED (غير متحقق)** pending remote repository creation and push.
7. **cPanel Live Deployment & Passenger Runtime:** Recorded as an **OPEN OPERATIONAL GATE (بوابة تشغيلية مفتوحة)** to be tested and validated on the live server before final production launch.
8. **Owner Approval Gate:** **مكتملة ومعتمدة من المالك (COMPLETED & APPROVED BY OWNER on 2026-11-03)**. Ready to proceed to Phase 3 Design System.

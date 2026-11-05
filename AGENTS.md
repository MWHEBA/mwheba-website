# MWHEBA 2.0 | Agent Operating Instructions

This file is the primary instruction file for Google Antigravity and any coding agent operating in this repository.

## Read order (mandatory)
1. `PROJECT_SPEC.md`
2. `ARCHITECTURE.md`
3. `DATA_MODEL.md`
4. `IMPLEMENTATION_ROADMAP.md`
5. `QUALITY_GATES.md`
6. `DECISIONS.md`

## Current mode: PLAN ONLY
Do not write application code, install dependencies, initialize frameworks, modify infrastructure, or run migrations until the project owner explicitly approves an implementation plan.

## First assignment
1. Inspect the repository without modifying files.
2. Identify existing code, configuration, environment constraints, and potential conflicts.
3. Read all six documents listed above.
4. Produce an executable breakdown as Markdown under `plans/`:
   - `plans/00-master-plan.md`
   - `plans/01-discovery-and-audit.md`
   - `plans/02-commerce-feasibility-poc.md`
   - `plans/03-foundation.md`
   - `plans/04-design-system.md`
   - `plans/05-cms-and-corporate-site.md`
   - `plans/06-commerce-and-b2b.md`
   - `plans/07-payments-and-billing.md`
   - `plans/08-migration-and-seo.md`
   - `plans/09-security-testing-launch.md`
5. For each plan include: goal, dependencies, scope, out-of-scope, concrete tasks, files/modules likely affected, data changes, acceptance criteria, tests, risks, effort estimate, rollback, and owner approval gates.
6. Present the master plan and unresolved decisions for approval. Do not implement yet.

## Agent rules
- Never invent framework capabilities, API methods, payment fees, legal requirements, or integration support. Verify against the installed package version and official docs.
- Payload Ecommerce is a candidate, not a proven fit. Its feasibility POC is a blocking gate.
- Do not silently add Medusa, another CMS, subscriptions, CRM, ERP, or a separate commerce database.
- Maintain one customer-facing website, one primary Payload admin, and one primary PostgreSQL application database unless an approved decision changes this.
- Treat all payments and pricing as server-authoritative. Never trust client totals.
- Never store payment card data. Use provider-hosted/secure payment flows.
- Keep upload assets in object storage, not the relational database.
- No direct changes to production, existing live site, or live databases.
- Never overwrite or delete user data without explicit authorization and backup.
- Keep credentials out of git, documentation, and generated output.
- Use TypeScript strict mode; clear domain boundaries; reusable components; migrations and tests.
- Preserve existing SEO URLs where feasible; plan redirects and bilingual migration.
- Build in small, reviewable slices; one approved phase at a time.
- Log assumptions separately from confirmed facts; raise blockers rather than guessing.
- Avoid one giant generation prompt. Plan first, then implement by approved tickets.

## Required response format after planning
1. Repository assessment
2. Recommended execution order
3. POC pass/fail criteria
4. Proposed `plans/` files
5. Open questions requiring owner decision
6. Explicit statement: `Awaiting approval to implement`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

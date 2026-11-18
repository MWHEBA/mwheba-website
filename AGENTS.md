# MWHEBA 2.0 | Agent Operating Instructions

This file is the primary instruction file for Google Antigravity and any coding agent operating in this repository.

## Read order (mandatory)
1. `docs/PROJECT_STATUS.md`
2. `docs/specs/PROJECT_SPEC.md`
3. `docs/specs/ARCHITECTURE.md`
4. `docs/specs/DATA_MODEL.md`
5. `plans/MASTER_PLAN.md`
6. `docs/specs/QUALITY_GATES.md`
7. `docs/specs/DECISIONS.md`

## Current mode: IMPLEMENTATION & MAINTENANCE
Phases 0–8, Phase 10 (Live Site Parity), and the Corporate Studio UI Redesign are implemented and verified locally.
Active work covers frontend/UI refinements, design-system polish, maintenance, and preparing owner-gated pre-launch items. Always build in small, reviewable slices and verify with `npx tsc --noEmit` and `npm test`.

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

## Visual and UI Design Rules
- Subtle gradients are permitted in backgrounds (e.g. radial/linear lighting blooms, studio depth, atmospheric section backdrops matching approved mockups).
- Colors must be declared in `:root` CSS variables (never hardcode arbitrary hex/rgb directly across components).
- Do not change project fonts (preserve `Cairo` / system typography).
- Keep design calm, minimal, elegant, and corporate studio-grade.
- Avoid unnecessary animations or loud effects; keep transitions subtle.
- Never open or run the browser unless explicitly requested by the user.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

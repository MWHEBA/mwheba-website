# MWHEBA 2.0 | Advertising & Media Agency Platform

A modern, high-performance web platform uniting MWHEBA Agency's corporate presence, bilingual marketing, and fixed-price B2B digital service packages with an e-commerce catalog for physical corporate merchandise.

## Technical Stack
- **Framework:** Next.js `16.4.5` (App Router + Turbopack)
- **CMS & Backend:** Payload CMS `3.91.0` (embedded under `/admin`)
- **Database:** PostgreSQL 16+
- **Styling:** Calm minimal corporate studio design system via `:root` CSS variables, subtle background atmospheric gradients, `Cairo` typography, and full RTL/LTR bilingual support
- **Runtime Target:** Node.js 24.13.0+ LTS / Phusion Passenger on CloudLinux

## Project Documentation Structure
- **Execution & Status:** [`plans/MASTER_PLAN.md`](plans/MASTER_PLAN.md) & [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)
- **Operations & Runbooks:** [`docs/ops/OPERATIONS_MANUAL.md`](docs/ops/OPERATIONS_MANUAL.md)
- **Security Audit:** [`docs/ops/production-dependencies-audit.md`](docs/ops/production-dependencies-audit.md)
- **Client Admin Guide:** [`docs/handover/admin-guide.md`](docs/handover/admin-guide.md)
- **Specifications & ADRs:** Located in [`docs/specs/`](docs/specs/) (`PROJECT_SPEC.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `QUALITY_GATES.md`, `DECISIONS.md`)
- **Active Data Assets:** [`docs/audit/05-redirect-map.csv`](docs/audit/05-redirect-map.csv) (301 redirect matrix)

## Verification
- `npm test`: Runs the automated unit & integration test suite (38 test files / 490 tests)
- `npm run test:postbuild`: Runs post-build bilingual layout verification (`tests/bilingualLayout.postbuild.test.ts`)
- `npx tsc --noEmit`: Strict TypeScript compilation check
- `npm run build`: Production build with Turbopack

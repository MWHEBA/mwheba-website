# MWHEBA 2.0 | Master Project Status, Architecture & Handover Ledger

> **Document Status:** Authoritative Master Reference  
> **Last Updated:** 2026-11-05  
> **Current Engine:** Next.js `16.4.5` (App Router + Turbopack) / Payload CMS `3.91.0` / PostgreSQL 13/16+  
> **Verified Local Runtime:** Node.js `v22.16.0` on Windows 10 x64  
> **Test Suite Health:** 30 Test Files / 439 Tests Passed (`100% Green`)  
> **Type Safety:** Strict TypeScript (`npx tsc --noEmit` exited `0`)  
> **Production Build:** 39 Static & Dynamic Routes Generated Cleanly (`npm run build`)  

---

## 1. Executive Summary

MWHEBA 2.0 is a complete, modern overhaul of `https://mwheba.com/`. It unites MWHEBA Agency's corporate presence, bilingual portfolio, blog, and lead capture with a robust B2B commerce platform handling physical corporate merchandise (with mixed-variant MOQ 10, line-item artwork uploads, and separate printing fees) alongside fixed-price digital services.

All local application development, business logic, security hardening, content migration, and test automation spanning **Phases 0 through 8 are 100% complete and verified locally**.

---

## 2. Phase-by-Phase Completion Status

```
[Phase 0: Discovery & Audit]            ──► 100% COMPLETE & VERIFIED
[Phase 1: Commerce Feasibility POC]     ──► 100% COMPLETE & APPROVED (Track 1A Adopted)
[Phase 2: Foundation & Infrastructure]  ──► 100% COMPLETE & VERIFIED
[Phase 3: Design System & UX]           ──► 100% COMPLETE & APPROVED
[Phase 4: CMS & Corporate Website]      ──► 100% COMPLETE & VERIFIED
[Phase 5: Commerce & B2B Engine]        ──► 100% COMPLETE & VERIFIED
[Phase 6: Payments & Billing]           ──► 100% COMPLETE & VERIFIED
[Phase 7: Content & SEO Migration]      ──► 100% COMPLETE & VERIFIED
[Phase 8: Security, Testing & Hardening]──► 100% COMPLETE LOCALLY
```

### Detailed Phase Breakdown:

| Phase | Description | Key Deliverables & Evidence | Local Status |
|---|---|---|---|
| **Phase 0: Discovery & Audit** | Empirical audit of legacy WordPress site (`https://mwheba.com/`). | 54 URLs cataloged, 4-tier redirect matrix (`docs/audit/05-redirect-map.csv`), legacy asset provenance. | **COMPLETED** |
| **Phase 1: Commerce Feasibility POC** | Evaluation of candidate stacks against strict B2B requirements. | Track 1B (`@payloadcms/plugin-ecommerce`) rejected; Track 1A (Custom Collections on PostgreSQL) approved. 12 blocking scenarios verified. | **COMPLETED & APPROVED** |
| **Phase 2: Foundation & Infrastructure** | Monolith architecture, database migrations, RBAC seeds, structured logging. | Clean Next.js + Payload 3.91 scaffold, PostgreSQL integration, RBAC enforcement (`tests/rbac.test.ts`). | **COMPLETED** |
| **Phase 3: Design System & UX** | Minimal, corporate, calm RTL/LTR design system. | Flat colors via `:root` CSS variables, zero gradients, fixed fonts, balanced whitespace, full Arabic/English bilingual styling (`tests/components.test.tsx`). | **COMPLETED & APPROVED** |
| **Phase 4: CMS & Corporate Website** | Dynamic page builder, portfolio, blog, lead capture. | Payload collections (`pages`, `posts`, `portfolio-projects`, `inquiries`), spam honeypot, rate limiting, transactional emails (`tests/cms*.test.tsx`). | **COMPLETED** |
| **Phase 5: Commerce & B2B Engine** | Physical catalog, variant MOQ 10 aggregation, per-line artwork, service intake. | Collections (`products`, `orders`, `carts`, `fulfillment-jobs`, `customization`), order snapshots, private upload HMAC signed URLs (`tests/b2b*.test.ts`). | **COMPLETED** |
| **Phase 6: Payments & Billing** | Cash on Delivery (COD) settlement, courier remittance, manual bank transfer. | Decoupled fulfillment & collection lifecycle, idempotent remittance reconciliation, bank deposit review, mathematical audit ledger (`tests/pay*.test.ts`). Paymob deferred to Phase 2. | **COMPLETED** |
| **Phase 7: Content & SEO Migration** | Bilingual migration pipeline, 301 redirects, structured data. | 5 authentic assets + 22 pending source classified, 54 legacy URLs tested with 66 redirect assertions, JSON-LD Schema generator free of placeholder assumptions (`tests/mig*.test.ts`). | **COMPLETED** |
| **Phase 8: Security & Testing** | Next 16 engine upgrade, sharp direct dependency, E2E acceptance, DR drill. | Next.js upgraded to `16.4.5` (0 Next CVEs), `sharp@0.35.5`, 439 passing tests, local backup and restore verified (`tests/rel*.test.ts`). | **COMPLETED LOCALLY** |

---

## 3. Workspace Documentation Inventory (Post-Cleanup)

Following the comprehensive cleanup cycle, all obsolete, intermediate, and duplicate files were pruned. The remaining documentation represents the authoritative living records:

### 3.1 Architectural Contracts & Specifications
- [`PROJECT_SPEC.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/PROJECT_SPEC.md): Core functional specification and business requirements.
- [`ARCHITECTURE.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/ARCHITECTURE.md): System architecture, monolith boundaries, and security model.
- [`DATA_MODEL.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/DATA_MODEL.md): Relational schemas, collections, fields, and access policies.
- [`QUALITY_GATES.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/QUALITY_GATES.md): Enforced verification rules and acceptance thresholds.
- [`DECISIONS.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/DECISIONS.md): Architectural decision records (ADRs).
- [`IMPLEMENTATION_ROADMAP.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/IMPLEMENTATION_ROADMAP.md): High-level milestone roadmap.

### 3.2 Operational Runbooks (`docs/ops/`)
- [`docs/ops/production-dependencies-audit.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/production-dependencies-audit.md): Complete supply-chain audit, Next 16 verification, sharp 0.35.5, and triage of remaining transitive notices.
- [`docs/ops/disaster-recovery.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/disaster-recovery.md): Local backup & restore runbook, drill execution logs, and realistic RPO/RTO expectations.
- [`docs/ops/rbac-matrix-and-runbook.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/rbac-matrix-and-runbook.md): User roles, permission matrices, and security procedures.
- [`docs/ops/transactional-email-templates.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/transactional-email-templates.md): Specifications for all 5 customer and staff transactional email notifications.
- [`docs/ops/cutover-and-reconciliation.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/cutover-and-reconciliation.md): Production cutover sequence and financial ledger reconciliation.
- [`docs/ops/rollback-runbook.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/rollback-runbook.md): Reversion procedures in case of staging or production deployment failures.

### 3.3 Historical Syntheses & Active Data Assets
- [`docs/poc/feasibility-report.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/poc/feasibility-report.md): Consolidated Master Report for the Phase 1 Commerce POC.
- [`docs/audit/LEGACY_AUDIT_SUMMARY.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/audit/LEGACY_AUDIT_SUMMARY.md): Consolidated Executive Summary of the legacy WordPress audit.
- [`docs/audit/05-redirect-map.csv`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/audit/05-redirect-map.csv): **Active Runtime Data Asset** consumed by `compileRedirectMap.ts` and tested by `mig03RedirectMatrix.test.ts`.
- [`docs/audit/02-url-inventory.csv`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/audit/02-url-inventory.csv): Discovered legacy URL catalog.
- [`docs/audit/03-content-and-media-audit.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/audit/03-content-and-media-audit.md): Citations for authentic copy and media assets.
- [`docs/handover/admin-guide.md`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/handover/admin-guide.md): Client administration and content management guide.

---

## 4. Remaining Local Backlog (Non-Blocking Maintenance)

These two code-level optimizations can be executed cleanly at any time or deferred to post-launch maintenance without impacting stability:

1. **Next.js 16 Middleware Convention Refactor:**
   - *Current State:* Turbopack warns that `src/middleware.ts` convention is deprecated in favor of `src/proxy.ts`. Backward compatibility is fully functional.
   - *Action:* Run the official Next.js codemod (`npx @next/codemod@canary middleware-to-proxy .`) and verify routing.
2. **Dynamic Filesystem Tracing Optimization in `Media.ts`:**
   - *Current State:* `path.resolve(configuredDir)` in `src/modules/customization/collections/Media.ts` triggers a Turbopack trace warning.
   - *Action:* Scope the upload path statically to `path.join(process.cwd(), 'private-uploads')` or annotate with `/* turbopackIgnore: true */`.

---

## 5. Pre-Launch Hosting & Server Operational Gates (Awaiting Owner Action)

The following gates require external access, server credentials, or commercial decisions that are strictly within the owner's domain:

1. **Contabo VM Snapshot (Owner Gate):**
   - The project owner will take an infrastructure snapshot of the Contabo VM prior to opening the server maintenance window.
2. **Server OS & Node.js Upgrade Window (Owner Gate):**
   - Maintenance window to update CloudLinux / cPanel packages and ensure Node.js 24.13.0+ LTS is active for Passenger.
3. **Phusion Passenger Staging Deployment (Staging Gate):**
   - Deploy build artifact to staging sub-environment on CloudLinux.
   - Validate live PostgreSQL socket connection and file permissions for `private-uploads/` outside `public_html`.
4. **Visual UX & Browser Verification (Owner Gate):**
   - Manual visual verification of store, cart, checkout, admin, and RTL/LTR layouts by the project owner in a live browser (strictly adhering to the agent zero-browser rule).
5. **Production SMTP Configuration (Operational Gate):**
   - Provide real SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) and test live delivery of lead and order notification emails.
6. **Accountant Review for VAT & Billing (Commercial Gate):**
   - Certified accountant sign-off on the applicable tax rate and treatment for B2B physical printing versus digital services.
7. **Official Bank Transfer IBAN Details (Commercial Gate):**
   - Supply official company bank name, account holder, and IBAN for the manual bank transfer payment instruction screen.

# MWHEBA 2.0 | Commerce Feasibility POC Report (POC-TSK-07)

**Document Reference:** `docs/poc/feasibility-report.md`  
**Date:** 2026-11-03  
**Status:** COMPLETED & PASSED  
**Stack Evaluated:** Next.js 15 (App Router) + Payload CMS 3.91.0 + `@payloadcms/plugin-ecommerce` + PostgreSQL 13/16+  
**Target Host Compatibility:** Node.js `>=20.18.1` (tested against host runtimes 22.22.0 / 24.13.0)  

---

## 1. Executive Summary & Final Stack Recommendation

The Phase 1 Commerce Feasibility POC has been successfully conducted and fully evaluated across all 12 mandatory blocking scenarios and operational procedures.

### Recommendation: **APPROVE PAYLOAD ECOMMERCE STACK**
- `@payloadcms/plugin-ecommerce` within Payload CMS v3 successfully fulfills MWHEBA Agency's B2B commerce requirements when properly extended.
- Single unified monolith (1 Next.js application, 1 Payload admin, 1 PostgreSQL database) is confirmed viable without needing external headless commerce engines (such as Medusa) or separate commerce databases.
- The 12 mandatory blocking gates have achieved a **100% Pass Rate** across 89 automated tests, type checks, clean lockfile installation (`npm ci`), clean production build (`npm run build`), and owner manual walkthrough.

---

## 2. Mandatory Blocking Scenarios: Results Matrix

| ID | Mandatory Scenario | Test Verification | Walkthrough / Evidence | Status |
|---|---|---|---|---|
| **POC-01** | Mixed-Variant MOQ (10 units per Product ID) | `moq.test.ts` (Tests 1–4) | Verified aggregation of variants for same Product ID | **PASSED** |
| **POC-02** | Native `carts` Collection Persistence & Shortage Notice | `cartPersistence.test.ts`, `/cart` UI | Data persistence & server MOQ gate PASSED (89/89 tests); visual UI notice verified and approved by owner on `/cart` | **PASSED & APPROVED** |
| **POC-02B** | Cross-Product MOQ Isolation | `moq.test.ts` (Tests 5–8) | Cross-product pooling strictly rejected with HTTP 422 | **PASSED** |
| **POC-03** | Per-Line Artwork & Private Upload Security | `privateMedia.test.ts`, `privateMediaHttp.test.ts` | Direct HTTP access blocked (HTTP 403); signed URLs valid (HTTP 200) | **PASSED** |
| **POC-04** | Fixed-Price Service Package (Brief intake, no shipping) | `services.test.ts` (Tests 1–3) | Line item marked `service_intake`, zero shipping charge | **PASSED** |
| **POC-05** | Mixed Cart Checkout (Goods + Services) | `checkout.test.ts` (Tests 1–4) | Server freezes prices and handles mixed line items | **PASSED** |
| **POC-06** | Decoupled Cash on Delivery (COD) Lifecycle | `codLifecycle.test.ts` (Tests 1–6) | Delivery transitions never mark order `paid` automatically | **PASSED** |
| **POC-07** | Idempotent COD Settlement & Courier Remittance | `codSettlement.test.ts` (Tests 1–8) | Duplicate collections blocked; courier remittance tracked separately | **PASSED** |
| **POC-08** | Delivery Refusal & Pre-Production Proof Approval Gate | `deliveryRefusal.test.ts`, `proofApproval.test.ts` | Refusal cancels without false refund; production blocked until proof approved | **PASSED** |
| **POC-08B**| Online Payment Gateway (Paymob) | Decision `D-008` | Dormant adapter in place; formally deferred to Phase 2 per plan | **DEFERRED (Approved)** |
| **POC-09** | Manual Bank Transfer Flow | `bankTransfer.test.ts` (Tests 1–4) | Slip uploaded, order created in `pending_verification` | **PASSED** |
| **POC-10** | Finance Verification & Race Serialization | `bankTransfer.test.ts` (Tests 5–9) | RBAC enforced (HTTP 403 for non-finance); concurrent races serialized | **PASSED** |
| **POC-12** | Unified `/admin` Usability Walkthrough | Owner Manual Walkthrough | Owner reviewed `/admin` and confirmed satisfaction with backend controls | **PASSED & APPROVED** |

### Non-Blocking Scenario:
- **POC-11 (Refunds & Cancellations):** Standard operating procedure documented in `docs/poc/manual-refunds-and-cancellations.md`. Administrative adjustment logs verified.

---

## 3. POC-02 Visual Cart Walkthrough Protocol & Sign-Off

- **Cart URL:** `http://localhost:3000/cart`
- **Owner Verification Date:** 2026-11-03
- **Owner Walkthrough Status:** **PASSED & APPROVED**
- **Observed Behavior:**
  1. Empty cart correctly indicates empty state with disabled checkout.
  2. Adding 5 units of `POC Cart Mug` (MOQ 10) dynamically renders: `5 more units required to reach the minimum.` and keeps checkout button disabled.
  3. Incremental updates (to 6 and 4) dynamically update remaining needed count (`4 more units required`, `6 more units required`).
  4. Item removal resets cart cleanly.
  5. Satisfying the 10-unit minimum removes the shortage notice and activates the checkout button.

---

## 4. Open Operational Gate (Pre-Launch / Hosting Cutover)

- **cPanel Live Deployment & Passenger Runtime Gate:**
  - Pinned engine requirement (`>=20.18.1`) matches host runtimes (`22.22.0` / `24.13.0`).
  - **Open Operational Gate:** Actual deployment on live cPanel under Phusion Passenger, live PostgreSQL socket connectivity, background process restarts, and private upload directory permissions outside `public_html` remain an open operational gate to be executed and verified before production launch.

---

## 5. Architectural Progression

1. **Node Runtime & Version Pinning:**
   - Downgraded from `3.92.1` to `3.91.0` to ensure `"node": ">=20.18.1"` compatibility with server runtimes `22.22.0` and `24.13.0`.
   - Dependency tree resolved cleanly with `yaml@2.9.1` and `yaml@1.10.3`.
   - Verified clean installation directly from lockfile via `npm ci` with zero bypass flags.
2. **Build & Type Safety:**
   - `npm run build` exits with code 0.
   - Strict TypeScript check (`tsc --noEmit`) passes with 0 errors.
   - 89 automated tests passing across 10 test suites in Vitest.
3. **Private Asset Isolation:**
   - Files stored outside `public_html` in a dedicated directory.
   - Direct HTTP access to private assets returns `HTTP 403 Forbidden`.
   - Time-limited HMAC-signed URLs provide controlled, temporary access.
4. **Owner Review & Sign-Off:**
   - The owner conducted the manual walkthrough of `/admin` and `/cart`, approving the backend foundation and signaling focus shift to Frontend UI/UX.

---

## 4. Architectural Progression

With the successful closure of Phase 1:
1. **Phase 2 (Foundation & Infrastructure `plans/03-foundation.md`):** Establish clean production monolith directory structure, PostgreSQL migration engine, RBAC seeds, structured logging, and health checks.
2. **Phase 3 (Design System & UI/UX `plans/04-design-system.md`):** Construct the corporate design system and UI components adhering strictly to project design constraints (flat colors via `:root` CSS variables, no gradients, fixed fonts, calm minimal corporate style, balanced whitespace, full RTL/LTR bilingual support).

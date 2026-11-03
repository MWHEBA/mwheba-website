# MWHEBA 2.0 | Track 1A Feasibility Evaluation Report (Local Verification Complete)

**Document ID:** `POC-TRK1A-REPORT-005`  
**Date:** 2026-11-02  
**Status:** TRACK 1A LOCAL GATES VERIFIED — MULTI-LAYER VERIFICATION ONGOING IN TRACK 1B  
**Mode:** PLAN ONLY / ISOLATED POC (Directory: `poc/`)  
**Strict Boundaries:** Zero changes to production (`https://mwheba.com/`), production databases, WordPress, or DNS.

---

## 1. Executive Summary

Track 1A of the Commerce Feasibility POC was executed in `poc/` to test whether **Payload CMS v3** with `@payloadcms/plugin-ecommerce@3.92.1` natively satisfies MWHEBA 2.0's requirements without architectural workarounds.

Following diagnostic testing, user privilege escalation vulnerabilities were completely closed and verified with permanent automated tests:
1. **User Role Immutability & Self-Escalation Prevention:** Non-admin users attempting to self-escalate to `admin` or `finance` are strictly rejected server-side with `Privilege Escalation Forbidden`.
2. **Public Signup Role Lock:** Public signups or unauthenticated registrations declaring elevated roles are unconditionally forced by server hooks to `roles: ['customer']`.
3. **Cross-Account Protection:** Users are strictly forbidden from modifying any account other than their own.
4. **Order Line Items & Quantities Immutability:** On an existing or paid order, mutating purchased items count, quantities (e.g. 4 $\rightarrow$ 1), products, or variants is strictly rejected server-side with `Order Immutability Error`.
5. **Cross-Product Variant Assignment Rejection:** At order creation, the server strictly validates that `variant.product === item.product`. Attempting to assign Product A's variant to Product B is rejected immediately with `Variant Mismatch Error`.

### Verification Status
- **TypeScript Strict Compilation:** `npx tsc --noEmit --incremental false` $\rightarrow$ **0 errors (Exit code 0)**.
- **Payload Typegen:** `npx payload generate:types` $\rightarrow$ **Clean sync with collections (Exit code 0)**.
- **In-Memory Business Logic Suite:** `tests/track1a.test.ts` $\rightarrow$ **10/10 tests PASSED**.
- **Payload CMS Integration & Database Suite:** `tests/payloadLocal.test.ts` $\rightarrow$ **10/10 tests PASSED**.
- **Total Automated Test Count:** **20 out of 20 PASSED**.

---

## 2. Test Layer Separation & Evidence

### Layer 1: In-Memory Domain Engine Tests (`tests/track1a.test.ts` — 10 Tests)
Validates mathematical correctness, MOQ aggregation algorithms, and data structures:
1. **POC-01 (Variant Aggregation):** 4 Black + 6 White mugs aggregate to 10 units; calculates 2,850 EGP (250 × 10 base + 35 × 10 printing fee).
2. **POC-02 (Incomplete Cart Persistence):** 5 Black mugs persist in cart with `remainingNeeded = 5`; checkout blocked with HTTP 422.
3. **POC-02 (Cart Mutation Resilience):** Increments, decrements, and deletions correctly update MOQ status.
4. **POC-02B (Cross-Product Isolation):** 5 of Product A + 5 of Product B persist in cart; checkout blocked with HTTP 422 detailing shortfalls for each product independently.
5. **POC-03 (Snapshot Immutability):** Order snapshot preserves frozen unit prices and fees regardless of subsequent catalog mutations.
6. **POC-04 (Digital Service Package):** 1 Brand Identity Package at 15,000 EGP with zero shipping and zero printing fees.
7. **POC-05 (Unified Mixed Cart):** 2 physical variants (10 units) + 1 service package calculate penny-perfect totals.
8. **POC-09 (Bank Transfer Engine):** Initializes transfer in `pending_verification`.
9. **POC-10 (Unauthorized Approval Guard):** Rejects non-finance approval attempts with HTTP 403.
10. **POC-10 (Authorized Finance Approval):** Records reconciliation code and updates status to `paid`.

### Layer 2: Payload CMS Lifecycle & Database Integration Tests (`tests/payloadLocal.test.ts` — 10 Tests)
Validates actual Payload CMS hooks, collection schemas, database persistence, and security controls:
1. **Asset Privacy & RBAC (`overrideAccess: false`):**
   - Customer A creates an artwork asset (`ArtworkAssets`).
   - Customer A queries and retrieves their asset.
   - Customer B queries the same asset ID with `overrideAccess: false` $\rightarrow$ **returns 0 documents (privacy isolation verified)**.
   - Admin/Finance queries the asset with `overrideAccess: false` $\rightarrow$ **successfully retrieves Customer A's asset**.
2. **User Collection RBAC, Anti-Privilege Escalation, & Public Signup Locking:**
   - Customer A attempts to self-escalate to `admin` or `finance` with `overrideAccess: false` $\rightarrow$ **rejected with `Privilege Escalation Forbidden`**.
   - Customer A's roles in database verified to remain strictly `['customer']`.
   - Customer A attempts to modify Customer B's account with `overrideAccess: false` $\rightarrow$ **access denied**.
   - Public registration declaring `roles: ['admin', 'finance']` with `overrideAccess: false` $\rightarrow$ **server hook strictly forces `roles = ['customer']`**.
   - Authorized administrator can promote users (e.g. adding `finance` role).
3. **Artwork Ownership Enforcement at Order Creation:**
   - Customer B attempts to create an order referencing Customer A's `artworkAssetId`.
   - Server hook catches the attempt and **rejects with HTTP 403 Forbidden**.
4. **Server-Side MOQ Enforcement (`orders.hooks.beforeValidate`):**
   - Attempting to create an order with empty items $\rightarrow$ **rejected by server hook**.
   - Attempting to create an order with 5 units of Product A (MOQ 10) $\rightarrow$ **rejected with `MOQ Violation (D-009)`**.
   - Attempting to create an order pooling 5 units of Product A + 5 units of Product B $\rightarrow$ **rejected with `MOQ Violation (D-009)`**.
5. **Variant Mismatch Guard:**
   - Attempting to create an order specifying Product B (Ceramic Mug) with a variant belonging to Product A (Thermal Mug).
   - Server hook catches parent mismatch and **rejects with `Variant Mismatch Error`**.
6. **Real Variant IDs & Penny-Perfect Financial Snapshot Persistence:**
   - Real variant documents created (`Black` and `White` variants linked to `color` type and option).
   - Valid order created: 4 Black Mugs + 6 White Mugs (Product A, total 10 units) + 1 Digital Service Package.
   - Order re-read directly from the database using `payload.findByID`.
   - Persisted totals verified: `amount = 17850`, `subtotal = 17500`, `totalCustomizationFees = 350`, `paymentStatus = 'pending'`.
   - Per-line frozen snapshots verified (`unitPrice`, `customizationFee`, `lineTotal`, `artworkStorageKey`).
7. **Frozen Price Snapshot Protection Against Catalog Changes:**
   - Product A price in catalog increased from 250 to 500 EGP; customization fee increased from 35 to 100 EGP.
   - Placed order updated in database (e.g. updating notes / status).
   - Order re-read from database: **Order total remains strictly 17,850 EGP (NOT 20,350 EGP)**.
8. **Purchased Items & Quantity Immutability on Existing Orders:**
   - Attempting to modify line item quantity from 4 to 1 on an existing placed order $\rightarrow$ **rejected with `Order Immutability Error`**.
   - Attempting to remove or add line items on an existing placed order $\rightarrow$ **rejected with `Order Immutability Error`**.
   - Order items verified in database to remain completely untouched.
9. **Post-Order Artwork Tampering Guard:**
   - Customer attempts to edit `storageKey` of an artwork asset bound to the placed order.
   - Server hook rejects mutation with `Immutable Asset Error`.
10. **Bank Transfer Sanitization, Duplicate Guard, & Append-Only Audit Trail:**
    - Client creates bank transfer declaring `status: 'approved'` and forged reconciliation code $\rightarrow$ Server sanitizes to `pending_verification` and nullifies code.
    - Unauthorized customer update $\rightarrow$ Rejection with HTTP 403 Forbidden.
    - Finance approval with valid reconciliation code $\rightarrow$ Succeeded; order `paymentStatus` updated to `paid`.
    - Duplicate approval of the same transfer $\rightarrow$ Rejected with `Duplicate Approval Guard`.
    - Audit trail on order verified: Contains BOTH original creation entry AND bank approval entry (append-only history preserved).

---

## 3. Quality Gate Status Summary

| Gate ID | Description | Track | Status | Verification Context |
| :--- | :--- | :---: | :---: | :--- |
| **POC-01** | Mixed-variant aggregation for MOQ (10 units across variants) | Track 1A | **PASSED** | Unit logic & Payload `beforeValidate` hook + DB persistence with real `variants`. |
| **POC-02** | Incomplete cart persistence & server checkout barrier | Track 1A | **PASSED** | Unit logic & Payload `beforeValidate` hook blocking order creation. |
| **POC-02B**| Cross-product MOQ isolation & variant mismatch guard | Track 1A | **PASSED** | Cross-product pooling and cross-product variant assignment strictly blocked. |
| **POC-03** | Per-line artwork attachment, privacy isolation, & price freeze | Track 1A | **PASSED** | `overrideAccess: false` test + ownership check + post-order asset locking. |
| **POC-04** | Fixed-price digital service package (no shipping/printing fee) | Track 1A | **PASSED** | Tested in mixed cart and verified in database. |
| **POC-05** | Mixed B2B cart checkout, snapshot & quantity immutability | Track 1A | **PASSED** | Placed order totals, quantities, and line items completely immutable. |
| **POC-06** | Online payment via live Paymob sandbox & multi-assertion | Track 1B | **PENDING** | Requires sandbox credentials (`poc/.env.local`). |
| **POC-07** | Duplicate webhook replay & database concurrency locking | Track 1B | **PENDING** | To be executed in Track 1B with PostgreSQL row-level locks. |
| **POC-08** | Failed payment handling & retry flow | Track 1B | **PENDING** | To be executed in Track 1B. |
| **POC-09** | Bank transfer submission initialized in `pending_verification` | Track 1A | **PASSED** | Server hook enforces `pending_verification` on creation. |
| **POC-10** | Finance-only bank transfer verification & order sync | Track 1A | **PASSED** | Finance RBAC enforced, order updated to `paid`, append-only audit trail verified. |
| **POC-11** | Basic refund / cancellation operational procedure | Track 1B | **PENDING** | Documented fallback / sandbox verification. |
| **POC-12** | Admin usability & plugin extension walkthrough | Track 1A/B | **PARTIALLY PROVEN** | Core schema and collections verified via Payload Local API; full UI walkthrough deferred to launch readiness. |

---

## 4. Track 1B Scope & Requirements

Track 1B (Paymob Live Sandbox Verification) has **not yet begun** and remains strictly blocked pending owner approval.

When authorized, Track 1B will create and execute:
1. `poc/src/logic/paymobEngine.ts`: Integration client with Paymob API, HMAC calculation, attempt scoping, and double-capture handling.
2. `poc/tests/track1b.test.ts`: Live sandbox automated tests for POC-06, POC-07, and POC-08.
3. Required environment credentials in `poc/.env.local`:
   - `PAYMOB_API_KEY`
   - `PAYMOB_INTEGRATION_ID_CARD`
   - `PAYMOB_HMAC_SECRET`

---

## 5. Current Posture

- **Track 1A Status:** All 8 local feasibility gates are now comprehensively hardened with 20 passing tests, 0 TypeScript errors, zero bypass paths for privilege escalation, item/quantity tampering, or variant mismatch.
- **Next Action:** Await project owner review and explicit instruction whether to proceed to Track 1B.

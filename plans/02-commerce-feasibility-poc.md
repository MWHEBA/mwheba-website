# MWHEBA 2.0 | Phase 1: Blocking Ecommerce Feasibility POC Plan

**Phase:** Phase 1  
**Status:** COMPLETED & PASSED  
**Mode:** VERIFIED & CLOSED  
**Goal:** Implement an isolated, local proof-of-concept (POC) sandbox using Next.js, Payload CMS v3, `@payloadcms/plugin-ecommerce`, and PostgreSQL. Test and validate mandatory commerce scenarios to prove whether the candidate stack natively and reliably supports MWHEBA's core B2B requirements (cart persistence of incomplete quantities with server-side checkout MOQ gating, mixed-variant aggregation, cross-product isolation, separate printing surcharges, per-line artwork persistence, live Paymob sandbox payments, and bank transfer verifications) without fragile hacks.

---

## 1. Overview & Context

Payload Ecommerce is a candidate architecture pending this blocking feasibility POC. We do **not** claim compatibility with custom cart fields, immutable order snapshots, separate printing charges, or custom payment adapters as established facts until demonstrated by working code in this POC. If the plugin fails to support these extension points cleanly, development stops immediately and an architectural pivot report is produced.

- **Dependencies:** Approval of `plans/00-master-plan.md` and `plans/01-discovery-and-audit.md`.
- **Scope:**
  - Setup an isolated sandbox workspace directory `poc/` or branch `poc/payload-ecommerce`.
  - Install Payload CMS v3 + pinned version of `@payloadcms/plugin-ecommerce` + PostgreSQL container.
  - Model physical products: `Product A: Premium Thermal Mug` (Variants: Black, White, Silver; Base Price: 250 EGP; MOQ: 10 per Product ID; separate Printing Fee: 35 EGP), `Product B: Ceramic Coffee Mug` (MOQ: 10 per Product ID), plus fixed-price service package (`Brand Identity Package`).
  - Implement server-side cart & checkout MOQ validation hook enforcing 10 units per individual Product ID:
    - **Incomplete Cart Mutation (Allowed):** Adding 5 Black mugs of Product A to an empty cart must succeed and persist; the cart UI displays "5 more units required".
    - **Mixed-Variant Aggregation (Valid):** Adding 5 White mugs of Product A (total 10 units of Product A) succeeds; checkout is now permitted.
    - **Cross-Product Isolation (Blocked at Checkout):** Adding 5 mugs of Product A + 5 mugs of Product B persists in cart, but checkout / order creation is blocked by server validation because neither product satisfies 10 units independently.
    - **Cart State Integrity:** Cart updates support incrementing, decrementing, and removing quantities without corrupting line-item state.
    - **API Hardening:** Direct API calls to checkout or order creation endpoints strictly reject incomplete MOQ orders.
  - Implement line-item logo upload and test persistence from Cart to Order snapshot.
  - Implement mixed cart checkout (10 mugs of Product A [5 Black + 5 White] with separate printing fee + 1 Brand Identity package).
  - Implement **actual live Paymob sandbox integration** (initiating intention against Paymob sandbox API, receiving real browser callback and server webhook, and calculating HMAC-SHA512 across the official 20 concatenated fields).
  - Implement duplicate webhook replay prevention and idempotency keys against the real Paymob payload structure.
  - Implement manual bank transfer workflow (order placed in `pending_verification`, finance verification transition).
  - Test seamless account creation during checkout without temporary passwords.
  - Compile the formal POC Assessment Report with go/no-go recommendation.
- **Out of Scope:**
  - Production deployments or live customer data.
  - Production payment credentials or real financial transactions (sandbox credentials only).
  - Full corporate website styling, blog, portfolio, or public marketing pages.
  - Automated PDF invoice generation (accurate database records maintained).
  - Inventory stock gating or tracking.

---

## 2. Test Scenarios & Pass/Fail Matrix (Mandatory vs Non-Blocking)

### 2.1 Unambiguous Mandatory Blocking Scenarios
All of the following 12 scenarios (including POC-02B) were **mandatory blocking gates**. All 12 have successfully achieved **PASSED** status:

| ID | Mandatory Scenario | Execution Steps | Expected Pass Condition | Status |
|---|---|---|---|---|
| **POC-01** | **Mixed-Variant MOQ Checkout** | Cart contains 5 Black + 5 White mugs of `Product A` (same Product ID; total 10 units). Proceed to checkout. | Total quantity equals 10; server permits checkout; subtotal and separate printing charges calculate accurately. | **PASSED** |
| **POC-02** | **Incomplete Cart Persistence & UI Notice** | Add 5 Black mugs of `Product A` to empty cart. Update quantity to 6, then 4, then remove item. Add 5 again. | **Cart mutation succeeds and persists** (not rejected at cart level). Cart UI displays "5 more units required". Direct checkout / order creation is rejected server-side with HTTP 422. | **PASSED & APPROVED** |
| **POC-02B** | **Cross-Product MOQ Isolation** | Add 5 mugs of `Product A` + 5 mugs of `Product B` to cart. Attempt checkout. | Items persist in cart; server blocks checkout and order creation with HTTP 422 because neither Product ID satisfies the 10-unit minimum. Cross-product aggregation strictly blocked. | **PASSED** |
| **POC-03** | **Per-Line Artwork Persistence** | Upload PDF/PNG vector logo attached specifically to line item 1. Complete checkout. | File stored in private storage; order item snapshot retains immutable link to uploaded asset even if source file is modified. | **PASSED** |
| **POC-04** | **Fixed-Price Service Package** | Add 1 unit of Brand Identity Package to cart. | Quantity is 1; no shipping requirement; fulfillment flagged as `service_intake`. | **PASSED** |
| **POC-05** | **Mixed Cart Checkout** | Cart contains 10 mugs (5 Black + 5 White) of Product A + 1 Brand Identity package. Complete checkout. | Order created with 3 distinct line items across 2 product types (2 physical variant lines marked for print/fulfillment + 1 service line marked for brief intake; accurate totals). | **PASSED** |
| **POC-06** | **Cash on Delivery (COD) Order Lifecycle & Decoupled Execution** | Place COD order for physical goods; advance through fulfillment (`confirmed` → `processing` → `shipped` → `delivered`). Attempt COD checkout on digital service package and mixed cart. | Physical COD order confirms and enters fulfillment with `paymentStatus: 'unpaid'`; shipping and delivery transitions NEVER mark order `paid` automatically. Digital service and mixed-cart COD attempts are rejected server-side with HTTP 422. | **PASSED** |
| **POC-07** | **COD Settlement Recording, Idempotency & Courier Remittance** | Authorized staff records cash collection: required amount, collected amount, collector identity (courier/office), timestamp, receipt/tracking reference. Re-submit identical collection call twice concurrently. Record courier company bank remittance. | First collection call logs collection and updates `paymentStatus: 'paid'`; second call is rejected idempotently with HTTP 200/409 without creating duplicate ledger records. Courier collection (`collected_by_courier`) is explicitly tracked separately from company bank remittance (`remitted_to_company`). | **PASSED** |
| **POC-08** | **COD Delivery Refusal, Cancellation & Pre-Production Proof Gate** | Simulate customer delivery refusal on shipped COD order. Place custom branded merchandise order and attempt to transition directly to `processing` / production before proof approval. | Refusal transitions order to `returned_to_origin` / `cancelled` while retaining `paymentStatus: 'unpaid'` (strictly zero false payments or false refunds). Custom printed item is blocked from entering production until explicit `proof_approved` status is recorded. | **PASSED** |
| **POC-08B** | **Online Payment Gateway (Paymob)** | Live Paymob sandbox card/wallet integration. | **Formally deferred to Phase 2 per Decision D-008. Existing POC engine modules remain dormant and non-blocking for Phase 1 launch.** | **DEFERRED (Approved)** |
| **POC-09** | **Manual Bank Transfer Flow** | Buyer selects "Bank Transfer" at checkout and uploads receipt slip. | Order created with Payment Status = `pending_verification`; accurate order and payment records saved. | **PASSED** |
| **POC-10** | **Unauthorized Bank Verification** | Non-finance user attempts to approve bank transfer via API or admin. | Rejected with HTTP 403 Forbidden; audit log records unauthorized access attempt. | **PASSED** |
| **POC-12** | **Unified Admin Usability** | Marketer and order operator log into single `/admin`. | Products, orders, line customizations, and payments visible in native Payload admin interface without DB queries. Verified by owner walkthrough. | **PASSED** |

### 2.2 Non-Blocking Scenario

| ID | Non-Blocking Scenario | Execution Steps | Pass Condition & Justification | Status |
|---|---|---|---|---|
| **POC-11** | **Refund / Cancellation Handling** | Admin initiates partial or full refund on paid order. | System records refund transaction in database ledger or documents clear manual banking operational procedure. **Justification:** If Paymob sandbox or plugin lacks direct automated API refund triggers, manual offline bank disbursement by the agency finance team is an acceptable operational fallback for launch, provided the ledger logs manual adjustments. | **DOCUMENTED (Draft SOP)** |

---

## 3. Work Breakdown & Concrete Tasks (Two-Track Architecture)

### TRACK 1A: Core Commerce Feasibility & B2B Rules (Immediate Execution — No External Keys Required)

#### Ticket POC-TSK-01: Isolated Sandbox Setup & Pinned Dependency Verification
- **ID & Title:** POC-TSK-01: Sandbox Environment & Plugin Extensibility Inspection
- **Business Outcome:** Functional, isolated dev environment to evaluate official `@payloadcms/plugin-ecommerce` capabilities and extension points against official documentation.
- **Dependencies:** None.
- **Scope:**
  - Create sandbox workspace directory `poc/` (isolated from project root).
  - Connect to the existing local PostgreSQL instance without Docker.
  - Install Payload CMS v3 + Next.js 15 + `@payloadcms/plugin-ecommerce` (verifying exact pinned package versions).
  - Inspect actual plugin extension points:
    - How custom fields are injected into `products`, `orders`, `carts`.
    - Whether cart item schemas support custom properties (`customizationFee`, `artworkAssetId`).
    - Hook lifecycle: `beforeChange` / `afterChange` execution order during cart mutation vs checkout.
- **Out of Scope:** Custom frontend styling or marketing blocks.
- **Implementation Approach:** Native Payload plugin integration via `payload.config.ts`.
- **Files/Modules Impacted:** `poc/package.json`, `poc/src/payload.config.ts`, `poc/.env.example`.
- **Database Changes:** Local test database `mwheba_poc`.
- **Acceptance Criteria:**
  - Payload admin launches cleanly at `http://localhost:3000/admin`.
  - Extension points for custom cart/order fields verified in TypeScript types.
- **Test Cases:** Verify DB migrations run without errors and admin user can log in.
- **Security/SEO Implications:** Isolated dev credentials only; no production keys.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Stop the local app and restore or remove only isolated POC data after backing it up.
- **Owner Approval Required:** Covered by owner authorization to run Phase 1 Track 1A POC.

---

#### Ticket POC-TSK-02: Product ID MOQ Hook, Cart Resilience & Separate Printing Fees
- **ID & Title:** POC-TSK-02: Cart Resilience, Product ID MOQ Enforcement & Separate Printing Fees
- **Business Outcome:** Ensure incomplete cart quantities persist cleanly while strictly blocking checkout and payment initiation if any physical product fails MOQ, and itemize printing fees.
- **Dependencies:** POC-TSK-01.
- **Scope:**
  - Configure catalog:
    - `Product A: Premium Thermal Mug` (Variants: Black, White, Silver; Base Price: 250 EGP; MOQ: 10; separate Printing Fee: 35 EGP).
    - `Product B: Ceramic Coffee Mug` (Variants: Blue, Red; Base Price: 180 EGP; MOQ: 10).
    - `Brand Identity Package` (Service, Price: 15,000 EGP, MOQ: 1).
  - Implement cart mutations:
    - Adding 5 Black mugs of Product A: Cart persists 5 units; calculates `remainingNeeded = 5`.
    - Updating quantity (incrementing to 6, decrementing to 4, removing): Cart recalculates without data corruption.
    - Adding 5 White mugs of Product A: Cart updates total for Product A to 10; sets `isMoqSatisfied = true`.
  - Implement server-side checkout validation hook:
    - Evaluated before order creation and payment initiation:
      Asserts `sum(quantity of all variants sharing productId) >= product.minOrderQuantity` for every physical product in cart.
      If any product fails, checkout mutation is rejected with HTTP 422.
    - Cross-Product Isolation: 5 of Product A + 5 of Product B in cart fails checkout because neither product has 10 units.
  - Calculate printing/engraving fee as a separate, distinct line charge (D-017).
- **Out of Scope:** Volume tier discounts.
- **Implementation Approach:** Extend plugin `carts` collection with server-side calculation and checkout validation hooks.
- **Files/Modules Impacted:** `poc/src/collections/Products.ts`, `poc/src/collections/Carts.ts`, `poc/src/hooks/validateMoqAndCustomization.ts`.
- **Database Changes:** Add `minOrderQuantity`, `customizationFee` fields on products.
- **Acceptance Criteria:**
  - POC-01 passes: 5 Black + 5 White of Product A permits checkout.
  - POC-02 passes: 5 Black mugs persist in cart; UI indicates 5 needed; checkout is rejected.
  - POC-02B passes: 5 of A + 5 of B persist in cart; checkout is rejected server-side with HTTP 422.
  - Printing fee itemized separately.
- **Test Cases:** Automated unit/integration tests covering the 3 test cases above.
- **Security/SEO Implications:** Direct API calls cannot bypass checkout MOQ validation.
- **Estimate & Risk:** 2 days. High strategic importance.
- **Rollback:** Revert hook code in sandbox.
- **Owner Approval Required:** No.

---

#### Ticket POC-TSK-03: Line-Item Artwork Upload & Mixed Cart Checkout
- **ID & Title:** POC-TSK-03: Per-Line Artwork Attachment & Mixed Cart Snapshot
- **Business Outcome:** Corporate logos remain permanently attached to specific order items even if the customer deletes or changes files later, and mixed physical + service orders checkout seamlessly.
- **Dependencies:** POC-TSK-02.
- **Scope:**
  - Create `ArtworkAssets` collection with private storage policy.
  - Extend Cart line item schema to accept `artworkId: string` and `printingNotes: string`.
  - Implement order placement hook that creates a permanent, immutable copy/snapshot of line-item data into `OrderItems`.
  - Test editing original product title, variant price, or customization fee to ensure existing order snapshot does not mutate.
  - Implement dual fulfillment fixture: test shipping rates (Alexandria, Cairo, Delta) and free office pickup (Miami, Alexandria).
  - Implement mixed cart checkout combining physical customized merchandise with a fixed-price service package (`Brand Identity Package`).
- **Out of Scope:** 3D mockup previews.
- **Implementation Approach:** Extend native plugin order schema with line-item customization snapshots.
- **Files/Modules Impacted:** `poc/src/collections/ArtworkAssets.ts`, `poc/src/collections/Orders.ts`, `poc/src/hooks/snapshotOrderItems.ts`.
- **Database Changes:** Schema relations between Orders, OrderItems, and ArtworkAssets.
- **Acceptance Criteria:**
  - POC-03 pass: Artwork is retained on line item 1 in order record and accessible to admin.
  - POC-04 pass: Service package checks out with quantity 1 without requiring artwork.
  - POC-05 pass: Mixed cart successfully creates order with physical lines and service intake line.
- **Test Cases:** Automated integration test executing full mixed checkout; query created Order; assert snapshot fidelity.
- **Security/SEO Implications:** Private storage prevents unauthorized access to corporate client logos.
- **Estimate & Risk:** 2 days. High risk.
- **Rollback:** Revert schema extensions in sandbox.
- **Owner Approval Required:** No.

---

#### Ticket POC-TSK-04: Manual Bank Transfer Flow & Admin Usability
- **ID & Title:** POC-TSK-04: Manual Bank Transfer Verification & Unified Admin Experience
- **Business Outcome:** Allow corporate B2B clients to complete checkout via bank transfer with receipt upload, strictly restricting approval to finance roles, and verify unified Payload `/admin` usability.
- **Dependencies:** POC-TSK-03.
- **Scope:**
  - Implement offline payment gateway option "Bank Transfer" at checkout.
  - Add receipt image/PDF upload field to checkout flow.
  - Order is placed with initial Payment Status = `pending_verification`.
  - Implement role-based access control (RBAC):
    - Non-finance / regular customer attempting to trigger approval endpoint is rejected with HTTP 403 Forbidden (POC-10).
    - Authorized finance user can view receipt slip and approve payment in `/admin`, transitioning state to `paid`.
  - Validate native Payload `/admin` usability: verify products, orders, per-line artwork attachments, and payment records are manageable directly without custom SQL (POC-12).
- **Out of Scope:** Automated bank reconciliation APIs.
- **Implementation Approach:** Native Payload access control rules and collection hooks.
- **Files/Modules Impacted:** `poc/src/collections/Payments.ts`, `poc/src/collections/Orders.ts`, `poc/src/access/isFinanceUser.ts`.
- **Database Changes:** Bank transfer receipt schema and audit trail fields.
- **Acceptance Criteria:**
  - POC-09 pass: Bank transfer order created in `pending_verification` with receipt attached.
  - POC-10 pass: Unauthorized approval attempt blocked with HTTP 403. Authorized finance user approval succeeds.
  - POC-12 pass: Complete back-office lifecycle verifiable directly in Payload admin.
- **Test Cases:** Integration tests for order creation, permission rejection, and finance state transition.
- **Security/SEO Implications:** Prevents unauthorized financial state alterations.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert access rules and payment hooks in sandbox.
- **Owner Approval Required:** No.

---

### TRACK 1B: Cash on Delivery (COD) Engine & Courier Settlement Architecture (Paymob Deferred to Phase 2)

#### Ticket POC-TSK-05: Cash on Delivery (COD) Engine, Courier Settlement & Rejection Lifecycle
- **ID & Title:** POC-TSK-05: COD Order Decoupling, Courier Settlement Recording & Rejection Lifecycle
- **Business Outcome:** Robust, audited Cash on Delivery (COD) architecture for physical merchandise: orders progress through fulfillment while remaining unpaid, collections are explicitly recorded and attributed (decoupling courier collection from company bank remittance), repeated collection attempts are handled idempotently, delivery rejections never cause false payments or refunds, and custom printed products require pre-production client proof approval. (Paymob online card/wallet gateway is formally deferred to Phase 2 per Decision D-008; its developed modules remain dormant and non-blocking).
- **Dependencies:** POC-TSK-04.
- **Scope:**
  - **COD Scope & Validation Rules:**
    - Allowed strictly for physical merchandise with shipping or office pickup.
    - Strictly prohibited for digital service packages and digital deliverables.
    - Mixed carts containing digital services are rejected from selecting COD (require Bank Transfer or split checkout).
  - **Decoupled Order vs. Payment Lifecycle:**
    - COD order placed: transitions to `orderStatus: 'confirmed'`, `paymentStatus: 'unpaid'`.
    - Fulfillment transitions: `confirmed` $\rightarrow$ `processing` $\rightarrow$ `shipped` $\rightarrow$ `delivered`.
    - Critical invariant: Order creation, dispatch, and delivery confirmation **NEVER** mark `paymentStatus: 'paid'` automatically.
  - **Settlement & Courier Remittance Registration:**
    - Explicit collection recording API/service: captures `orderId`, `requiredAmount`, `collectedAmount`, `collectorType` (`'courier'` | `'office_staff'`), `collectorName`, `collectedAt`, and `receiptReference`.
    - Two-stage remittance decoupling:
      1. Stage 1: `collected_by_courier` (customer handed cash to delivery driver). Transitions `paymentStatus: 'paid'`.
      2. Stage 2: `remitted_to_company` (delivery courier company deposits collected cash into MWHEBA bank account / ledger).
  - **Rejection & Non-Delivery Handling:**
    - Customer delivery refusal (`refusal_at_delivery`) or delivery failure (`failed_delivery_attempt`):
      - Updates `orderStatus: 'cancelled'`, `fulfillmentStatus: 'returned_to_origin'`.
      - `paymentStatus` remains `unpaid` (strictly NO false payment records and NO false refund adjustments).
  - **Collection Idempotency & Concurrency:**
    - Duplicate collection submissions (e.g. repeated courier API webhook or double admin click) are serialized via PostgreSQL transaction lock and rejected idempotently without creating duplicate ledger records.
  - **Custom Branded Pre-Production Proof Approval Gate:**
    - Physical orders requiring custom artwork/printing cannot transition to `processing` / production until explicit `proof_approved` state is signed off by client and agency operator, protecting against unrecoverable manufacturing costs in case of COD refusal.
  - **Paymob Deferral & Deactivation:**
    - Existing Paymob endpoints (`/paymob/webhook`) and scripts are set to inactive/dormant status so they do not block Phase 1 MVP launch or test suites.
- **Out of Scope:** Automated courier API integrations (e.g. Bosta/Aramex API webhook sync deferred to future release).
- **Implementation Approach:** Dedicated COD settlement service module, state transition validation hooks, and Payload collections.
- **Files/Modules Impacted:** `poc/src/logic/codEngine.ts`, `poc/src/logic/orderSnapshotEngine.ts`, `poc/src/collections/Orders.ts`, `poc/src/collections/Payments.ts`.
- **Database Changes:** Fields on `orders` (`codDetails`, `proofApprovedAt`, `courierRemittanceStatus`).
- **Acceptance Criteria:**
  - POC-06: COD order placed and delivered with `paymentStatus: 'unpaid'`. Digital service attempting COD is rejected with HTTP 422.
  - POC-07: First collection logs payment and marks `paid`; repeated collection call is handled idempotently without duplicate records. Courier collection is recorded separately from company bank remittance.
  - POC-08: Delivery refusal updates order to `returned_to_origin` / `cancelled` with `unpaid` status (no false refund/payment). Custom printed item is blocked from production without `proof_approved`.
- **Test Cases:**
  1. Complete COD physical order checkout $\rightarrow$ verify order confirmed, `paymentStatus: 'unpaid'`.
  2. Advance fulfillment to `shipped` and `delivered` $\rightarrow$ verify `paymentStatus` strictly remains `unpaid`.
  3. Digital service or mixed cart COD attempt $\rightarrow$ assert server rejection with HTTP 422.
  4. Explicit collection call with valid amount and courier ID $\rightarrow$ assert transition to `paid` and ledger entry created.
  5. Concurrent / duplicate collection call with same reference $\rightarrow$ assert idempotent rejection and zero duplicate ledger entry.
  6. Delivery refusal simulation $\rightarrow$ assert order cancelled, fulfillment returned, payment remains `unpaid`.
  7. Custom branded item without proof approval $\rightarrow$ assert transition to production is blocked.
- **Security/Financial Implications:** Eliminates cash collection leakage, prevents uncollected revenue assumptions, and protects against custom manufacturing losses.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert COD hook and service code.
- **Owner Approval Required:** Yes (approved via COD pivot directive).

---

#### Ticket POC-TSK-06: Refund / Cancellation Operational Procedure (Non-Blocking)
- **ID & Title:** POC-TSK-06: Refund & Ledger Operational Handling (Non-Blocking POC-11)
- **Business Outcome:** Document and test operational handling of order cancellations and refunds.
- **Dependencies:** POC-TSK-05.
- **Scope:**
  - Test order cancellation flow in Payload admin.
  - Record refund ledger adjustments in database.
  - Document standard operating procedure (SOP) for manual bank refunds if automated Paymob API refund is unavailable in sandbox.
- **Out of Scope:** Automated multi-currency chargeback dispute systems.
- **Implementation Approach:** Admin action hook and database transaction log.
- **Acceptance Criteria:**
  - POC-11 pass: Ledger reflects refund transaction and admin status updates accurately.
- **Estimate & Risk:** 0.5 days. Low risk.
- **Rollback:** N/A.

---

### TECH STACK APPROVAL GATE & FINAL DELIVERABLE

#### Ticket POC-TSK-07: Comprehensive Feasibility Report & Tech Stack Recommendation
- **ID & Title:** POC-TSK-07: End-to-End Evaluation & Written Feasibility Report
- **Business Outcome:** Author authoritative proof document providing clear evidence on whether to approve `@payloadcms/plugin-ecommerce` for production or pivot to Medusa / headless commerce.
- **Dependencies:** POC-TSK-01 through POC-TSK-06.
- **Scope:**
  - Conduct full end-to-end regression across all 12 mandatory blocking scenarios and non-blocking POC-11.
  - Document all architectural extension findings, limitations, and performance observations.
  - Formulate refined effort and timeline estimates for Phases 2 through 8.
  - Author formal deliverable: `docs/poc/feasibility-report.md`.
- **Acceptance Criteria:**
  - All 12 mandatory scenarios evaluated with definitive PASS / FAIL status and test execution logs.
  - Formal stack recommendation: **APPROVE PAYLOAD ECOMMERCE** or **PIVOT TO ALTERNATIVE**.
- **Owner Approval Gate:** Explicit project owner sign-off required to close Phase 1 and initiate Phase 2 Foundation.

---

## 4. Pass/Fail Decision Rules & Pivot Trigger
- **Pass Gate:** All 12 mandatory scenarios (POC-01, POC-02, POC-02B, POC-03, POC-04, POC-05, POC-06, POC-07, POC-08, POC-09, POC-10, POC-12) must pass cleanly.
- **Pivot Trigger:** If Payload Ecommerce cannot support line customizations or server-side checkout purchase rules natively, stop and present an architectural pivot (Payload for CMS + custom commerce schema in same PostgreSQL DB, or Medusa headless engine).

---

## 5. Phase Exit & Owner Approval Gate
1. Complete POC test execution logs with verified COD lifecycle, courier remittance, and bank transfer verifications: **COMPLETED (89/89 tests passing)**.
2. Formal feasibility report delivered at `docs/poc/feasibility-report.md`: **DELIVERED**.
3. Explicit Owner Gate Sign-off: **CONFIRMED & PASSED** (Owner verified `/admin` & `/cart` walkthrough and backend stability; signaled readiness to advance). Proceeding to Phase 2 Foundation.

# MWHEBA 2.0 | Phase 6: Payments and Billing Plan

**Phase:** Phase 6  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Goal:** Implement a secure, server-authoritative payment and billing architecture centered on **Cash on Delivery (COD)** for physical merchandise (with decoupled fulfillment, explicit courier collection tracking, and company remittance settlement) and **Corporate Manual Bank Transfer** (with finance verification gates), while maintaining audit trails, idempotency, delivery refusal handling, and pre-production proof approval for custom branded goods. **Online card/wallet payment via Paymob is formally deferred to Phase 2 per Decision D-008.**

---

## 1. Overview & Non-Negotiable Financial Invariants

Handling B2B agency transactions and promotional merchandise orders requires absolute financial accuracy. All payment implementations must adhere to these core rules:

1. **Approved Payment Methods for Launch (Phase 1 MVP):**
   - **Cash on Delivery (COD):** Available strictly for physical merchandise fulfilled via standard shipping or MWHEBA agency office pickup.
   - **Manual Corporate Bank Transfer:** Available for all order types (physical merchandise, fixed-price digital services, and mixed carts).
   - **Paymob Online Gateway:** Formally deferred to Phase 2 (D-008). Its developed modules and webhooks are maintained in a dormant/deactivated state and do not block Phase 1 launch.
2. **Server-Authoritative Pricing:**
   - All charges, surcharges, and order totals are calculated strictly on the server from the product database. Client-submitted prices or totals are rejected.
3. **Multi-Dimensional Status Architecture:**
   - An order is never represented by a single status. Orders maintain decoupled lifecycle states:
     - `orderStatus`: `draft` | `pending` | `confirmed` | `processing` | `shipped` | `delivered` | `completed` | `cancelled`
     - `paymentStatus`: `unpaid` | `pending_verification` | `paid` | `partially_refunded` | `refunded`
     - `fulfillmentStatus`: `unfulfilled` | `in_production` | `ready_for_pickup` | `shipped` | `delivered` | `returned_to_origin` | `cancelled`
     - `remittanceStatus`: `not_applicable` | `pending_collection` | `collected_by_courier` | `remitted_to_company`
4. **Decoupling Order Fulfillment from Payment Collection (COD Invariant):**
   - Placing a COD order transitions it to `orderStatus: 'confirmed'`, `paymentStatus: 'unpaid'`.
   - Dispatching the order transitions it to `fulfillmentStatus: 'shipped'`, with `paymentStatus` remaining `unpaid`.
   - Marking the order delivered transitions it to `fulfillmentStatus: 'delivered'`, with `paymentStatus` strictly remaining `unpaid`.
   - **Critical Invariant:** Order creation, shipping, and delivery transitions **NEVER** mark `paymentStatus: 'paid'` automatically.
5. **Explicit Collection & Two-Stage Courier Remittance:**
   - Recording collection requires an explicit administrative or courier settlement transaction recording:
     - Required order amount
     - Actually collected amount
     - Collector identity (`courier_partner` | `internal_office_staff`)
     - Collector / Driver / Agent name
     - Timestamp of cash collection
     - Courier tracking / receipt reference
   - **Two-Stage Accounting Separation:**
     - Stage 1: `collected_by_courier` — customer handed cash to the delivery courier; `order.paymentStatus` transitions to `paid`.
     - Stage 2: `remitted_to_company` — courier company formally reconciles and deposits the cash into MWHEBA's corporate bank account.
6. **Delivery Refusal, Failure & Return Handling:**
   - If the customer refuses delivery (`refusal_at_delivery`) or delivery fails permanently (`failed_delivery_attempt`):
     - `orderStatus` transitions to `cancelled`.
     - `fulfillmentStatus` transitions to `returned_to_origin`.
     - `paymentStatus` remains `unpaid`.
     - **Critical Invariant:** Refusals and failed deliveries must **NEVER** trigger false payment records or false refund transactions.
7. **Pre-Production Proof Approval Gate for Branded Goods:**
   - Physical merchandise requiring custom printing, engraving, or artwork cannot enter production upon order placement.
   - The order enters `proof_pending`. Production (`in_production`) is blocked until explicit client proof approval (`proof_approved`) is recorded by the client and MWHEBA operations team, mitigating non-refundable manufacturing costs in the event of delivery refusal.
8. **COD Scope & Exclusion Rules:**
   - **Allowed:** Physical products fulfilled via standard shipping or office pickup.
   - **Prohibited:** Fixed-price digital services and digital deliverables (e-books, templates, audits) cannot use COD; they require full prepayment via Bank Transfer.
   - **Mixed Carts:** If a cart contains both physical items and digital services, the checkout strictly disables COD, requiring payment via Bank Transfer or cart splitting.
9. **Collection Idempotency & Concurrency:**
   - Submitting a collection confirmation multiple times (e.g. repeated courier callback or accidental double click by office staff) is serialized via database transaction locks and handled idempotently with zero duplicate ledger records.
10. **Accurate Ledger Over PDF Engines:**
    - Per Decision D-016, no electronic invoicing (ETA) and no automated PDF invoicing engine will be built in the MVP. Pristine, auditable database records of all orders, collections, remittances, and bank reviews are maintained.

---

## 2. Work Breakdown & Concrete Tasks

### Ticket PAY-01: Cash on Delivery (COD) Checkout & Fulfillment Decoupling Engine
- **ID & Title:** PAY-01: Cash on Delivery Checkout & Decoupled Fulfillment Engine
- **Business Outcome:** Allow Egyptian B2B clients to purchase corporate merchandise with Cash on Delivery while ensuring fulfillment operations and payment status remain strictly separated.
- **Dependencies:** B2B-04.
- **Scope:**
  - Implement COD payment option at checkout:
    - Enforce COD validation rules: permit COD only when cart contains 100% physical merchandise.
    - Reject COD with HTTP 422 if cart contains digital services or mixed fulfillment lines.
  - Snapshot order creation for COD:
    - Set `orderStatus = 'confirmed'`.
    - Set `paymentStatus = 'unpaid'`.
    - Set `fulfillmentStatus = 'unfulfilled'`.
    - Set `remittanceStatus = 'pending_collection'`.
  - Fulfillment hook protection:
    - Prevent `shipped` or `delivered` hooks from mutating `paymentStatus` to `paid`.
- **Out of Scope:** Automated shipping label generation APIs (deferred).
- **Implementation Approach:** Server-side validation hooks and decoupled Payload collection schemas.
- **Files/Modules Impacted:** `src/modules/payments/services/codEngine.ts`, `src/modules/orders/collections/Orders.ts`, `src/modules/checkout/validation.ts`.
- **Database Changes:** Fields on `orders` (`paymentMethod`, `remittanceStatus`, `codCollectionDetails`).
- **Acceptance Criteria:**
  - COD order placed: order status is `confirmed`, payment status is `unpaid`.
  - Advancing order through shipping and delivery preserves `paymentStatus: 'unpaid'`.
  - Attempting COD on digital service or mixed cart returns HTTP 422 with descriptive error.
- **Test Cases:**
  1. Complete physical COD checkout $\rightarrow$ verify `paymentStatus === 'unpaid'`.
  2. Advance fulfillment to `shipped` $\rightarrow$ assert `paymentStatus === 'unpaid'`.
  3. Advance fulfillment to `delivered` $\rightarrow$ assert `paymentStatus === 'unpaid'`.
  4. Attempt COD on service package $\rightarrow$ assert rejection with HTTP 422.
- **Security/Financial Implications:** Eliminates premature revenue recognition.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Disable COD option in checkout configuration.
- **Owner Approval Required:** No.

---

### Ticket PAY-02: COD Courier Collection, Idempotency & Remittance Accounting
- **ID & Title:** PAY-02: COD Collection Settlement, Idempotency & Courier Remittance
- **Business Outcome:** Complete accountability for cash collected by couriers or office staff, with two-stage tracking of courier collection vs corporate bank deposit, and strict idempotency.
- **Dependencies:** PAY-01.
- **Scope:**
  - Implement Collection Registration Service:
    - Restricted to authorized roles (`admin`, `finance`, `operations`).
    - Captures: `orderId`, `collectedAmount`, `collectorType` (`courier` | `office_staff`), `collectorName`, `collectedAt`, and `receiptReference`.
    - Validates penny-perfect amount matching between `collectedAmount` and `order.grandTotal`.
    - Transitions `paymentStatus` from `unpaid` $\rightarrow$ `paid`.
    - Transitions `remittanceStatus` to `collected_by_courier` (or `remitted_to_company` if collected at office).
  - Implement Courier Remittance Reconciliation:
    - Dedicated finance action in `/admin` to batch-remit courier collections:
      - Marks selected courier collections as `remitted_to_company`.
      - **Strict Mathematical Amount Matching:**
        - `grossCollectedAmount`: exact sum of selected collection records.
        - `courierFeeDeductions`: itemized delivery/shipping fees deducted by courier partner.
        - `otherDeductions`: documented banking or return fees.
        - `expectedNetDeposit = grossCollectedAmount - courierFeeDeductions - otherDeductions`.
        - `actualDepositReceived`: actual cash deposited into MWHEBA bank account.
        - The reconciliation enforces `actualDepositReceived === expectedNetDeposit`. Any discrepancy requires explicit variance authorization with documented notes, otherwise the settlement is rejected with HTTP 422.
      - **Double-Remittance Prevention:** Each collection record has an immutable `remittanceBatchId`. Any attempt to include an already remitted collection (`remitted_to_company`) in another batch is strictly rejected with HTTP 409 Conflict.
      - Captures courier bank deposit slip reference, settlement batch ID, finance approver ID, and deposit receipt timestamp.
  - Concurrency & Idempotency Protection:
    - Runs in a single PostgreSQL ACID transaction with row-level locking (`SELECT FOR UPDATE`).
    - Repeated submission of the same collection receipt reference returns HTTP 200 `{ status: "ALREADY_COLLECTED" }` with zero duplicate financial ledger entries.
- **Out of Scope:** Direct automated courier API reconciliation.
- **Implementation Approach:** PostgreSQL transactional settlement service with append-only ledger entries.
- **Files/Modules Impacted:** `src/modules/payments/services/codSettlementService.ts`, `src/modules/payments/collections/PaymentCollections.ts`, `src/modules/payments/collections/CourierRemittances.ts`.
- **Database Changes:** `payment_collections` and `courier_remittances` tables.
- **Acceptance Criteria:**
  - Authorized officer records collection $\rightarrow$ order transitions to `paid`, `collected_by_courier` logged.
  - Duplicate collection submission $\rightarrow$ idempotent rejection with zero duplicate ledger balance.
  - Remittance batch requires penny-perfect mathematical reconciliation between gross collections, courier deductions, and bank deposit.
  - Attempt to re-remit an already remitted collection is rejected with HTTP 409.
- **Test Cases:**
  1. Record valid courier collection $\rightarrow$ assert `paymentStatus === 'paid'` and collection record created.
  2. Concurrent duplicate collection call $\rightarrow$ assert second call handled idempotently.
  3. Mismatched collected amount $\rightarrow$ assert rejected with HTTP 422 `amount_mismatch`.
  4. Remittance reconciliation with matching deposit $\rightarrow$ assert batch transitions to `remitted_to_company`.
  5. Remittance with mismatched deposit without variance approval $\rightarrow$ assert rejected with HTTP 422.
  6. Attempt to remit an already remitted collection in a new batch $\rightarrow$ assert rejected with HTTP 409.
- **Security/Financial Implications:** Guarantees cash collection tracking and prevents employee/courier leakage.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert settlement service.
- **Owner Approval Required:** No.

---

### Ticket PAY-03: Manual Corporate Bank Transfer Workflow & Finance Verification Gate
- **ID & Title:** PAY-03: Bank Transfer Submission & Finance Verification Gate
- **Business Outcome:** Support high-value Egyptian B2B transactions where corporate clients pay via bank wire or Instapay, with strict verification controls preventing unearned fulfillment.
- **Dependencies:** B2B-04.
- **Scope:**
  - Checkout UI: Present official MWHEBA bank details (Bank Name, Account Name, Account Number, IBAN, Swift, Instapay handle).
  - Customer Submission: Customer uploads bank transfer receipt slip (PDF/PNG) and inputs claimed amount and bank reference.
  - Order state initialization: `paymentStatus = 'pending_verification'`, `orderStatus = 'pending'`.
  - Admin Finance Portal:
    - Dedicated view in `/admin` restricted strictly to `finance` and `super_admin` roles.
    - Displays order details, uploaded receipt, claimed bank reference, and items.
    - Verification action: Finance officer enters internal bank statement reconciliation code and clicks "Approve Payment" or "Reject Payment".
  - Approval mutation updates `paymentStatus = 'paid'` and logs full audit trail (`actorId`, `timestamp`, `bankReferenceCode`).
- **Out of Scope:** Automated bank scraping.
- **Implementation Approach:** Payload collection hooks with custom admin UI action components.
- **Files/Modules Impacted:** `src/modules/payments/collections/BankTransfers.ts`, `src/modules/payments/actions/verifyBankTransfer.ts`, `src/modules/payments/ui/FinanceVerificationPanel.tsx`.
- **Database Changes:** `bank_transfer_submissions` and `bank_transfer_verifications` tables.
- **Acceptance Criteria:**
  - Non-finance user attempting to call verification endpoint is blocked with 403 Forbidden.
  - Approving bank transfer transitions order to `paid` and triggers confirmation email.
- **Test Cases:** Role-based authorization tests, receipt upload, and state transitions.
- **Security/SEO Implications:** Strict separation of duties prevents operational fraud.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert bank transfer actions.
- **Owner Approval Required:** Yes (to approve bank account details displayed at checkout).

---

### Ticket PAY-04: Custom Branded Merchandise Proof Approval & Rejection Handling
- **ID & Title:** PAY-04: Pre-Production Proof Approval & Delivery Refusal Handling
- **Business Outcome:** Protect agency against unrecoverable custom manufacturing costs by gating production on client proof approval, and cleanly handle delivery refusals without false accounting.
- **Dependencies:** PAY-01, PAY-02.
- **Scope:**
  - Pre-Production Proof Approval Workflow:
    - When physical items contain custom printing/artwork, order enters `proof_pending`.
    - Operations/design team uploads digital proof mockup in `/admin`.
    - Client reviews and approves proof (`proof_approved`).
    - Only after `proof_approved` can the order transition to `in_production` / `processing`.
  - Delivery Refusal & Cancellation:
    - Customer refuses delivery or courier fails all delivery attempts:
      - Operations records `refusal_at_delivery`.
      - Order status transitions to `cancelled`.
      - Fulfillment status transitions to `returned_to_origin`.
      - Payment status remains `unpaid`.
      - Critical check: Zero payment or refund adjustments logged in financial ledger.
- **Out of Scope:** Automated supplier purchase order issuance.
- **Implementation Approach:** State machine guards in Payload collection hooks.
- **Files/Modules Impacted:** `src/modules/orders/hooks/proofApprovalGuard.ts`, `src/modules/orders/hooks/deliveryRefusalHandler.ts`.
- **Database Changes:** `proof_status`, `proof_mockup_url`, `proof_approved_at` on orders.
- **Acceptance Criteria:**
  - Order with custom printing blocked from `in_production` until `proof_approved`.
  - Delivery refusal updates order to `cancelled` / `returned_to_origin` while retaining `unpaid`.
- **Test Cases:**
  1. Transition custom order to production without proof approval $\rightarrow$ assert blocked with HTTP 422.
  2. Approve proof $\rightarrow$ assert transition to production permitted.
  3. Mark refusal on shipped order $\rightarrow$ assert order cancelled, fulfillment returned, payment remains `unpaid`.
- **Security/Financial Implications:** Direct protection against physical inventory loss and custom production costs.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert proof guard hooks.
- **Owner Approval Required:** No.

---

### Ticket PAY-05: Financial Ledger, Tax Review Boundary & Deferred Paymob Architecture
- **ID & Title:** PAY-05: Financial Ledger, Tax Review Boundary & Deferred Gateway Maintenance
- **Business Outcome:** Accurate, immutable financial and transaction records in the database, with zero unnecessary PDF/ETA bloat, a clear legal tax review boundary, and cleanly maintained dormant Paymob modules for Phase 2.
- **Dependencies:** PAY-01, PAY-02, PAY-03.
- **Scope:**
  - Implement detailed financial snapshot on `Orders` collection:
    - Subtotal (sum of product base prices).
    - Total Printing/Customization Surcharges (itemized).
    - Delivery Fee (calculated fee for shipping; pickup fee/terms per owner confirmation).
    - Tax Amount (if applicable; default 0 until legally reviewed).
    - Grand Total (in Piastres/cents).
    - Payment Method (`cod` | `bank_transfer`).
    - Collection / Bank Reconciliation Code.
  - Dormant Paymob Integration Management:
    - Keep existing Paymob adapter, webhook verifier, and concurrency engine code safely archived in `src/modules/payments/adapters/dormant/` for rapid activation in Phase 2.
    - Ensure all Paymob HTTP routes and live calls are disabled in Phase 1 runtime configuration so they do not block launch or fail health checks.
  - Flag legally required physical/tax documents for separate review with agency accountant.
- **Out of Scope:** Automated PDF invoice generator and ETA e-invoicing (omitted per D-016).
- **Implementation Approach:** Comprehensive data modeling in Payload `orders` and `payments` collections.
- **Files/Modules Impacted:** `src/modules/orders/collections/Orders.ts`, `src/modules/payments/collections/Payments.ts`.
- **Database Changes:** Explicit financial columns in `orders` table.
- **Acceptance Criteria:**
  - Database maintains 100% mathematical consistency: `grandTotal = subtotal + customizationFees + deliveryFee + taxAmount`.
  - Zero unverified PDF generators or broken e-invoicing stubs in codebase.
  - Paymob code is cleanly isolated without blocking Phase 1 execution.
- **Test Cases:** Automated test checking financial calculations across 50 simulated orders with varying quantities and fees.
- **Security/SEO Implications:** None.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert schema adjustments.
- **Owner Approval Required:** Yes.

---

## 3. Risks & Mitigation
- **Risk:** High delivery refusal rate on Cash on Delivery orders leading to shipping costs.  
  *Mitigation:* Pre-production proof approval gate for customized items, phone/WhatsApp confirmation before dispatch, and tracking customer refusal history.
- **Risk:** Delayed cash remittance from courier companies.  
  *Mitigation:* Two-stage remittance accounting (`collected_by_courier` vs `remitted_to_company`) with weekly aging reports in `/admin`.
- **Risk:** Bank transfer receipt forgery.  
  *Mitigation:* System strictly prevents order progression to fulfillment based on receipt upload alone; finance officer must manually verify bank balance.

---

## 4. Phase Exit & Owner Approval Gate
1. Cash on Delivery (COD) decoupled order flow, shipping, and delivery transitions verified.
2. Explicit collection recording and courier remittance tracking tested in `/admin`.
3. Delivery refusal and custom proof approval workflows verified with automated tests.
4. Bank transfer flow and finance role verification tested in `/admin`.
5. Financial ledger and audit log verified.
6. Formal Owner Gate Sign-off: "Phase 6 Payments Approved. Proceed to Phase 7 Migration."

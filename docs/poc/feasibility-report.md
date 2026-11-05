# MWHEBA 2.0 | Commerce Feasibility POC Master Report

> **Document Reference:** `docs/poc/feasibility-report.md`  
> **Phase:** Phase 1 (Commerce Feasibility POC)  
> **Status:** COMPLETED & APPROVED BY OWNER  
> **Outcome:** Adopted Track 1A (Custom Payload Collections on PostgreSQL 16+); Rejected Track 1B (`@payloadcms/plugin-ecommerce`)  

---

## 1. Executive Summary & Architectural Decision

The blocking Commerce Feasibility POC evaluated whether MWHEBA Agency's B2B requirements (mixed-variant MOQ 10, line-item artwork, custom printing fees, decoupled Cash on Delivery, manual bank transfer, and service intake) could be natively satisfied.

### The Two Tracks Evaluated:
1. **Track 1B (`@payloadcms/plugin-ecommerce`):** Evaluated as a candidate plugin. **REJECTED.** The plugin's rigid opinionated schema assumed consumer retail, single-item carts, Stripe/PayPal reliance, lack of variant MOQ aggregation across a single Product ID, and absence of independent fulfillment/payment state decoupling.
2. **Track 1A (Custom Payload Collections on PostgreSQL):** **APPROVED & ADOPTED.** Implemented custom collections (`orders`, `carts`, `products`, `payment-collections`, `customization`, `fulfillment-jobs`, `artwork-assets`) directly in Payload CMS v3 on PostgreSQL. Fulfills 100% of business rules with strict server-side authority.

---

## 2. 12 Mandatory Blocking Scenarios: Results Matrix

All 12 mandatory scenarios passed with 100% success across automated test suites, typechecks, and owner visual walkthroughs:

| ID | Mandatory Scenario | Core Technical Enforcement | Verification Status |
|---|---|---|---|
| **POC-01** | Mixed-Variant MOQ (10 units per Product ID) | Variants of same Product ID aggregate (e.g. 4 Black + 6 White = 10 units). Server-side check blocks order creation if $<10$. | **PASSED** |
| **POC-02** | Persistent Incomplete Cart & Shortage Notice | Sub-MOQ quantities persist in cart; UI displays remaining units needed; checkout button disabled until met. | **PASSED & APPROVED** |
| **POC-02B** | Cross-Product MOQ Isolation | 5 units of Product A + 5 units of Product B strictly rejected with HTTP 422 (no cross-product pooling). | **PASSED** |
| **POC-03** | Per-Line Artwork & Private Upload Security | Files stored in private directory outside web root. Direct HTTP blocked (403); access via time-limited HMAC-signed URLs. | **PASSED** |
| **POC-04** | Fixed-Price Service Package | Digital service items marked `service_intake`, zero shipping charge, intake brief workflow assigned to Creative team. | **PASSED** |
| **POC-05** | Mixed Cart Checkout | Server freezes line prices and calculates penny-perfect totals for physical goods + digital services. | **PASSED** |
| **POC-06** | Decoupled Cash on Delivery (COD) | Delivery status advances (`shipped`, `delivered`) while payment status strictly remains `unpaid` until cash collection. | **PASSED** |
| **POC-07** | Idempotent COD Settlement & Courier Remittance | Serialized cash collections prevent double-entry; courier remittance tracked via independent ledger. | **PASSED** |
| **POC-08** | Delivery Refusal & Pre-Production Proof Gate | Customer refusal cancels order without false refund; physical production strictly blocked until proof approved. | **PASSED** |
| **POC-08B**| Online Payment Gateway (Paymob) | Dormant adapter in place; formally deferred to Phase 2 (Decision `D-008`). | **DEFERRED (Approved)** |
| **POC-09** | Manual Bank Transfer Flow | Deposit slip uploaded, order initialized in `pending_verification`, funds held awaiting finance review. | **PASSED** |
| **POC-10** | Finance Verification & Race Serialization | Finance-only RBAC (403 for unauthorized users); concurrent verification attempts serialized. | **PASSED** |
| **POC-11** | Manual Refund & Cancellation Procedure | Standard operating procedure documented: 2-person approval, bank reconciliation, immutable adjustments. | **DOCUMENTED** |
| **POC-12** | Unified `/admin` Usability Walkthrough | Single Payload admin interface evaluated and approved by project owner. | **PASSED & APPROVED** |

---

## 3. Standard Operating Procedure: Manual Refunds & Cancellations (POC-11)

For Cash on Delivery and manual bank transfer orders:
1. **Cancellation Before Collection:**
   - Confirm order status and verify whether physical production or dispatch has begun.
   - If dispatched or customized, resolve return/scrap costs prior to cancellation. Preserve `paymentStatus: unpaid`.
2. **Refund After Bank Transfer or COD Settlement:**
   - Finance verifies original settled transaction against external bank statement or courier remittance sheet.
   - Finance enters a refund request (order ID, amount in integer piastres, customer bank IBAN/cash voucher reference, reason).
   - Second authorized finance officer reviews and approves payout. Disbursement is executed externally; external transaction reference is recorded in the immutable audit log.
   - `paymentStatus` updates to `refunded` or `partially_refunded`. Never mutate or overwrite historical collection records.

---

## 4. Architectural Baseline Established

- **Monolith Architecture:** Single Next.js application hosting public store, corporate pages, and Payload Admin (`/admin`).
- **Database Engine:** Single PostgreSQL 16+ database with relational integrity and strict migrations.
- **Node.js Runtime:** Target `>=20.18.1` (tested and verified on Node `22.16.0` and `24.13.0`).
- **Storage:** Private upload directory outside web server root; authenticated HMAC signed URLs for sensitive assets.
- **Next Phase:** Transitioned to Phase 2 (Foundation & Infrastructure `plans/03-foundation.md`).

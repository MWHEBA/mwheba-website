# MWHEBA 2.0 | Architectural Review & Plan Corrections

**Document:** `plans/10-architecture-review.md`  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Review Scope:** Comprehensive audit of technical assumptions, alignment with official `@payloadcms/plugin-ecommerce` documentation, official Paymob API specifications, and pre-implementation consistency fixes.

---

## 1. Executive Summary of Corrections

Following thorough architectural review and verification against official documentation and the owner's confirmed requirements, the implementation plans (`plans/00` through `plans/09`) have been revised. The key corrections are detailed below:

| Architectural Area | Initial Plan Assumption | Verified Reality / Revised Strategy | Plan Affected |
|---|---|---|---|
| **Payload Ecommerce Extensibility** | Generic custom commerce models risking code duplication. | **Candidate Architecture:** Treat `@payloadcms/plugin-ecommerce` as an unproven candidate until demonstrated by working code in Phase 1 POC. Verify extension points before committing. | `00`, `02`, `03`, `06` |
| **Cart Mutation vs Checkout MOQ** | Rejected cart addition if quantity was less than 10 units. | **Revised Cart Behavior:** Incomplete cart mutations (e.g. 5 Black mugs) **succeed and persist**. The cart UI displays remaining units required. Server-side validation strictly blocks **checkout, order creation, and payment initiation** until 10 units per Product ID are met. Direct API calls to checkout are rejected. | `02`, `04`, `06`, `09`, `QUALITY_GATES.md` |
| **Minimum Order Quantity (MOQ)** | Assumed strictly 10 units of the identical SKU. | **Final Owner-Approved Decision:** Minimum order quantity is **10 units per individual Product ID**. Different variants of the same product (colors, sizes) count together toward the minimum (e.g., 5 Black + 5 White mugs = VALID). Cross-product aggregation is strictly rejected (e.g., 5 mugs of Product A + 5 mugs of Product B = INVALID). | `00`, `01`, `02`, `06`, `09`, `11` |
| **POC Exit Criteria** | Ambiguous scenario lists and refund gating. | **Unambiguous Enumeration:** Explicitly designated 12 mandatory blocking scenarios (POC-01, POC-02, POC-02B, POC-03, POC-04, POC-05, POC-06, POC-07, POC-08, POC-09, POC-10, POC-12). **POC-11 (Refund/Cancellation) is explicitly non-blocking** because offline manual finance disbursement is an acceptable operational fallback for launch. | `02`, `QUALITY_GATES.md` |
| **Paymob Integration & Payment Logic** | Assumed mock adapter or signature + `success` alone was sufficient. | **Multi-Assertion Verification Pipeline & Resilient Webhooks:** Live Paymob sandbox integration tests (not mock-only). Signature + `success` alone are never enough: assertions MUST verify HMAC, transaction finality (`success === true` & `pending === false`), order correlation, penny-perfect amount matching (`amount_cents`), currency (`EGP`), and unique transaction recording. Concurrency deduplication (`INSERT ON CONFLICT`) and row locking prevent double execution under retries or downtime. Browser redirect is decoupled and strictly read-only. | `02`, `07`, `QUALITY_GATES.md` |
| **Legacy SEO Status Governance** | Assumed 100% of discovered legacy URLs return 301. | **4-Tier Action Matrix:** Discovered URLs strictly governed per `docs/audit/05-redirect-map.csv`: `PRESERVE` routes return HTTP 200; `REDIRECT_301` routes return HTTP 301 to clean non-trailing-slash targets (resolving in a single hop); `GONE_410` routes return HTTP 410 Gone for demo clutter; `REQUIRES_REVIEW` awaits owner decision. Tests assert exact HTTP status codes. | `04`, `05`, `08`, `QUALITY_GATES.md` |
| **Customization / Printing Fees** | Bundled or unitemized in some drafts. | Calculated and displayed as a **separate, distinct line charge** on both cart and order snapshots. | `02`, `04`, `06`, `07` |
| **Inventory & Stock Management** | Assumed made-to-order policy for all goods. | **Strictly Out of Scope for MVP.** No inventory counting or stock gating; no unverified assumptions that all items are made-to-order. | `03`, `06` |
| **Invoicing & Tax Compliance** | Proposed building an automated internal PDF invoicing generator and ETA stubs. | **No ETA e-invoicing; do NOT build an automated PDF generator.** Maintain complete and accurate database financial records. Flag legally required physical documents for separate accountant review. | `06`, `07` |
| **Checkout Registration** | Unspecified or potential temporary password reset email. | **Seamless inline registration** where the customer enters a password directly during checkout or uses secure session creation. **No temporary passwords.** | `03`, `04`, `06` |
| **Production Smoke Test** | Draft suggested testing with 1 mug + 1 EGP payment (violating MOQ). | **Corrected to an authorized 10-unit QA test SKU** at an authorized testing amount approved by the owner, strictly respecting the MOQ rule, followed by an immediate refund. | `09` |
| **Production Rollback** | Assumed guaranteed 5-minute DNS reversal to legacy server. | **Realistic Rollback & Transaction Reconciliation Strategy:** Removed false assumptions about guaranteed DNS timing (ISP caching causes propagation delays). Legacy read-only mode, in-flight Paymob transaction polling, lead export, and manual customer outreach protocols mandated. | `09` |

---

## 2. Technical Deep-Dive on Critical Corrections

### 2.1 Candidate Architecture Status of Payload Ecommerce
Official documentation for `@payloadcms/plugin-ecommerce` indicates support for products, carts, orders, and addresses. However, until demonstrated by running code in the isolated Phase 1 sandbox:
- Custom line-item schemas (`customizationFee`, `artworkAssetId`) must be proven to serialize properly across the native cart-to-order transition.
- The hook execution order must be validated to confirm that server-side checkout validation fires reliably before order snapshots are written.
If these extension points require brittle monkey-patching, the POC report will recommend a pivot before any corporate CMS code is built.

### 2.2 Cart Resilience vs Server-Side Checkout MOQ
To provide a smooth B2B purchasing experience:
1. **Cart Mutations:** A customer who adds 5 Black mugs to start must not be greeted with an error. The cart accepts and stores those 5 units.
2. **Cart UI Feedback:** The cart view displays: *"5 more units of this mug required to enable checkout"*.
3. **Cart Modifications:** The customer can freely increment, decrement, or remove items without corrupting the cart state.
4. **Variant Aggregation:** Adding 5 White mugs of the same `productId` brings the total for that product to 10 units, satisfying the rule and enabling checkout.
5. **Cross-Product Isolation:** If the cart contains 5 mugs of Product A and 5 mugs of Product B, both persist, but checkout is blocked because neither satisfies 10 units.
6. **Server Authority:** Direct POST/GraphQL requests to the order creation or payment intention endpoints validate `sum(quantity) >= 10` per `productId`. If invalid, the server immediately returns HTTP 422.

### 2.3 Multi-Assertion Payment Confirmation & Webhook Concurrency Resilience
A valid cryptographic signature and `success: true` are necessary but strictly insufficient to confirm a payment. A robust e-commerce gateway must prevent payload tampering, currency substitution, cross-order replays, and race conditions.

**Mandatory 6-Point Assertion Pipeline:**
1. **Cryptographic Integrity:** Calculate HMAC using provisioned secret (verifying Intention API vs legacy Accept API schema) and compare securely via `crypto.timingSafeEqual`.
2. **Gateway Status Check:** Assert `success === true`, `pending === false`, `is_voided === false`, `is_refunded === false`.
3. **Order & Attempt Correlation:** Look up `Order` and `PaymentAttempt` using merchant order reference (`special_reference` / `merchant_order_id`). Assert referenced order exists and is in `unpaid` or `payment_pending`.
4. **Penny-Perfect Amount Matching:** Assert `payload.amount_cents === order.total_amount_cents` and matches `payment_attempt.amount_cents`. Any variance rejects the payment and freezes the attempt as `amount_mismatch`.
5. **Currency Matching:** Assert `payload.currency === order.currency` (e.g. `EGP`).
6. **Unique Provider Transaction ID:** Record `payload.id` in the payment attempt ledger and ensure no other order has claimed it.

**Webhook Concurrency & Downtime Recovery:**
- Atomic deduplication: `INSERT INTO PaymentEvents ... ON CONFLICT DO NOTHING` + row lock `SELECT FOR UPDATE` on `Order`.
- Browser redirect decoupling: `/checkout/result` is strictly read-only and polls order status; never marks an order paid without server webhook verification.
- Background reconciliation worker: Queries Paymob Transaction API every 15 minutes for lingering `payment_pending` orders to recover transactions missed during network drops or downtime.

### 2.4 Production Rollback & Realistic Reconciliation
DNS TTL is a suggestion to caching resolvers, not a guarantee. Regional ISPs in Egypt frequently cache DNS records for hours beyond the 300s TTL.

**Our Multi-Layered Rollback Runbook (REL-05):**
1. **Pre-Cutover Freeze:** Legacy site forms disabled to prevent new data on the old server.
2. **Maintenance Mode on Rollback:** If rollback is necessary, the new platform enters a maintenance state immediately to reject incoming orders.
3. **Automated Reconciliation Script:** Queries Paymob API for all payments captured during the cutover window; cross-references with PostgreSQL.
4. **Data Export:** Newly captured leads and paid orders are exported to CSV and handed to agency operations for manual fulfillment.
5. **DNS Reversion:** DNS records reverted to legacy server, backed by manual customer outreach to handle in-flight transactions.

---

## 3. Review Conclusion
All planning documents now accurately reflect the real operational constraints, official library APIs, and final confirmed business decisions with zero unresolved MOQ questions or feature bloat.

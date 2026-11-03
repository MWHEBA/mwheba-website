# MWHEBA 2.0 | Decision Consistency & Traceability Matrix

**Document:** `plans/11-decision-consistency-matrix.md`  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Purpose:** Ensure 100% architectural and operational consistency by explicitly mapping every confirmed business requirement, architectural hypothesis, and scoped boundary across all implementation phases and tickets.

---

## 1. Decision Status Taxonomy
- **CONFIRMED:** Firm business directive approved by project owner. Implementation tasks must strictly adhere.
- **PREFERRED PENDING POC:** Technical hypothesis to be validated in Phase 1 sandbox before permanent commitment.
- **ASSUMPTION PENDING APPROVAL:** Working assumption used for planning; requires explicit owner sign-off.
- **OUT OF SCOPE / DEFERRED:** Features explicitly excluded from initial release to maintain focus, velocity, and reliability.
- **OPEN / LOGISTICAL DETAILS:** Operational details (launch language parity, shipping fee matrix) to be audited during Phase 0 discovery.

---

## 2. Comprehensive Traceability Matrix

| Decision ID | Core Topic | Classification | Implementation Rule & Boundary | Impacted Phases | Impacted Implementation Tickets |
|---|---|---|---|---|---|
| **D-001** | Full Rebuild of `mwheba.com` | Confirmed | Complete modernization of corporate agency site + B2B merchandise store. | All (0–8) | AUD-01, FND-01, CMS-01, REL-05 |
| **D-002** | Physical Branded Merchandise | Confirmed | Offer physical products (mugs, giveaways) with optional custom logo attachment. | 1, 3, 5 | POC-01, DES-04, B2B-01, B2B-03 |
| **D-003** | Fixed-Price Service Packages | Confirmed | One-time digital agency packages (quantity 1, intake brief workflow, no shipping). | 1, 3, 5 | POC-04, DES-04, B2B-01, B2B-05 |
| **D-004** | Single Admin & Single Database | Confirmed | One Next.js App, one Payload CMS admin under `/admin`, one PostgreSQL 16+ database. | 1, 2 | POC-12, FND-01, FND-02 |
| **D-005** | Next.js + Payload + Ecommerce Plugin | Preferred Pending POC | Candidate architecture. Feasibility validated against 12 POC scenarios in Phase 1 before building CMS. | 1 | POC-01 through POC-12 |
| **D-006** | PostgreSQL Database | Preferred Pending POC | Use `@payloadcms/db-postgres` with versioned migration scripts. | 1, 2 | POC-TSK-01, FND-02, FND-03 |
| **D-007** | Dual Payment Methods (Phase 1) | Confirmed | Cash on Delivery (COD) for physical merchandise and manual corporate bank transfer for all orders. | 1, 5, 6 | POC-06, POC-07, POC-09, DES-04, B2B-04, PAY-01, PAY-02, PAY-03 |
| **D-008** | Primary Online Gateway: Paymob | Deferred | Paymob online card/wallet gateway deferred to Phase 2. Live sandbox testing is removed as a blocker for Phase 1 launch. Existing code kept dormant. | 1, 6, 8 | POC-08B, PAY-05, REL-05 |
| **D-009** | **Minimum Order Quantity (MOQ)** | **Confirmed** | **10 units per individual Product ID.** Incomplete cart quantities (e.g. 5 units) persist in cart; UI displays remaining needed. Different variants of same product aggregate together (5 Black + 5 White = VALID). Cross-product aggregation strictly rejected (5 of A + 5 of B = INVALID). **Server strictly blocks checkout and payment initiation until MOQ is met.** | 1, 3, 5, 8 | **POC-01, POC-02, POC-02B, DES-04, B2B-01, B2B-02, REL-01, REL-05** |
| **D-010** | Line-Item Artwork Upload | Confirmed | Corporate vector logos uploaded to persistent private filesystem storage outside `public_html`; bound to a specific cart line item; frozen into immutable order snapshot. | 1, 5 | POC-03, B2B-03, B2B-04 |
| **D-011** | Mixed Cart Support | Preferred Pending POC | Seamless cart containing both physical merchandise and digital agency service packages in one checkout. (COD prohibited for mixed cart). | 1, 5 | POC-05, B2B-04, REL-01 |
| **D-012** | Launch Language Parity | Open / Logistical | Audit legacy site in Phase 0 to verify whether all historical pages have English translations or if Arabic takes priority. | 0, 4, 7 | AUD-01, AUD-04, CMS-02, MIG-01 |
| **D-013** | **Seamless Checkout Registration** | **Confirmed** | Direct inline account creation during checkout. Customer specifies password or uses secure auth session. **No temporary passwords.** | 2, 3, 5 | **FND-04, DES-04, B2B-04** |
| **D-014** | Payment Schedule | Assumption Pending Approval | Working assumption: 100% full upfront payment for MVP, subject to final owner approval. | 0, 6 | AUD-04, PAY-01, PAY-03 |
| **D-015** | **Fulfillment: Shipping & Office Pickup** | **Confirmed** | Support both standard shipping and pickup from MWHEBA Agency Office at checkout. Pickup terms/fees subject to owner confirmation. | 3, 5 | **DES-04, B2B-04, B2B-05** |
| **D-016** | **Invoicing & Tax Compliance** | **Confirmed** | **No ETA e-invoicing; do NOT build an automated PDF generator in MVP.** Maintain complete and accurate database financial records; flag legal tax requirements for separate review. | 2, 6 | **FND-01, B2B-04, PAY-05** |
| **D-017** | **Customization Pricing (Printing Fee)** | **Confirmed** | Printing and engraving fees must be calculated and displayed separately from the base product price. | 1, 3, 5, 6 | **POC-01, DES-04, B2B-01, B2B-02, PAY-05** |
| **D-018** | **Inventory Management** | **Out of Scope** | Stock counts, inventory gating, and warehouse tracking are omitted for MVP. Do not assume all items are made-to-order. | 1, 2, 5 | **POC-TSK-02, FND-01, B2B-01** |
| **D-019** | Automation / n8n | Deferred | Advanced workflow orchestration deferred; clean webhook dispatchers documented. | 2 | FND-05 |
| **D-020** | Alternative Commerce Engine | Deferred | Evaluated only if Payload Ecommerce fails Phase 1 POC blocking scenarios. | 1 | POC-TSK-05 |
| **D-021** | COD Scope & Restrictions | Confirmed | Restricted strictly to physical goods; digital services & mixed carts prohibited from COD. | 1, 5, 6 | POC-06, B2B-04, PAY-01 |
| **D-022** | COD Decoupling & Courier Remittance | Confirmed | Unpaid order fulfillment, explicit collection logging, courier remittance separation, idempotency, delivery refusal handling. | 1, 6 | POC-06, POC-07, POC-08, PAY-01, PAY-02 |
| **D-023** | Branded Merchandise Proof Gate | Confirmed | Custom printed merchandise requires client proof approval before manufacturing begins. | 1, 5, 6 | POC-08, B2B-03, PAY-04 |

---

## 3. Strict Boundary Checklist
To ensure the implementation never deviates during execution, the following boundaries are actively enforced:
- [x] Incomplete quantities (e.g. 5 units) persist safely in the cart; UI displays remaining units required.
- [x] Server-authoritative MOQ validation strictly blocks checkout, order creation, and payment initiation until 10 units per Product ID are reached.
- [x] Different variants of the same product model (colors, sizes) count together toward the 10 units.
- [x] Different products never aggregate together even if in the same category.
- [x] Zero credit card numbers or CVVs stored in database or application logs.
- [x] Multi-assertion payment confirmation: signature and `success` alone are never trusted; amount, currency, order reference, and payment attempt matching are mandatory before marking paid.
- [x] Resilient webhook handling: atomic deduplication, database row-level locking, and replay idempotency prevent duplicate state changes under concurrent requests or downtime retries.
- [x] Browser redirect to `/checkout/result` is strictly decoupled and read-only; never triggers a `paid` transition without server webhook verification.
- [x] Discovered legacy URLs governed strictly by the 4-tier action matrix (asserting HTTP 200 for PRESERVE, 301 for REDIRECT_301, 410 for GONE_410); zero redirect chains.
- [x] Zero inventory or warehouse stock reservation tables (strictly excluded per D-018).
- [x] Zero hardcoded hex colors or gradients used in UI components (100% CSS variables).
- [x] Zero temporary-password account provisioning emails.
- [x] Zero automated PDF invoice generators built in initial MVP.
- [x] Zero mock-only shortcuts for Paymob testing (live sandbox required).
- [x] Zero production smoke tests that violate the 10-unit MOQ rule or use hardcoded unauthorized prices.
- [x] Zero DNS-only rollback procedures.

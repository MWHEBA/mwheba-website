# MWHEBA 2.0 | Decision Register

**Status:** Pending Owner Approval  
**Status Categories:**
- `CONFIRMED`: Explicitly approved business requirement; ready for implementation planning.
- `PREFERRED_PENDING_POC`: Architectural hypothesis requiring validation in Phase 1 POC before commitment.
- `ASSUMPTION_PENDING_APPROVAL`: Working assumption used for planning; requires explicit owner sign-off.
- `OPEN`: Unresolved question flagged for explicit owner decision.
- `OUT_OF_SCOPE` / `DEFERRED`: Explicitly excluded from MVP to prevent scope creep.

| ID | Decision Item | Category | Status | Notes & Implementation Rules |
|---|---|---|---|---|
| **D-001** | Full rebuild of mwheba.com | Scope | CONFIRMED | Agency website + B2B merchandise and fixed-price service store. |
| **D-002** | Physical branded products & giveaways | Product Scope | CONFIRMED | B2B promotional merchandise with optional custom artwork. |
| **D-003** | Fixed-price service packages | Product Scope | CONFIRMED | One-time agency services (branding, audits); no subscriptions. |
| **D-004** | Single primary admin and database | Architecture | CONFIRMED | One Next.js App, one Payload CMS admin, one PostgreSQL database. |
| **D-005** | Next.js + Payload CMS + Payload Ecommerce | Architecture | PREFERRED_PENDING_POC | Candidate stack pending blocking Phase 1 feasibility POC. Do not assume compatibility until demonstrated by working code. |
| **D-006** | PostgreSQL on cPanel hosting | Architecture | CONFIRMED | Owner confirms PostgreSQL is available and reports Node.js 24.13.0 (and 22.22.0) on CloudLinux 9.5. Pinned Payload 3.91.0 packages declare Node.js `>=20.18.1`, satisfying package engine constraints for both available host runtimes. Note: Theoretical package engine compatibility is resolved, but actual operational runtime verification on cPanel (Passenger lifecycle, PostgreSQL connection, and private storage permissions) remains an open verification gate before production deployment. Docker is excluded. |
| **D-007** | Dual payment methods at checkout (Phase 1) | Payments | CONFIRMED | **Cash on Delivery (COD)** for physical merchandise and **Manual corporate bank transfer** for all orders (services, digital, physical). Online card/wallet payment is deferred. |
| **D-008** | Primary online payment gateway (Paymob) | Payments | DEFERRED | **Paymob online card/wallet gateway deferred to Phase 2.** Live sandbox testing is removed as a blocker for Phase 1 launch. Paymob endpoints and webhooks are kept dormant until Phase 2 reactivation. |
| **D-009** | Minimum Order Quantity (MOQ) | Commerce Rules | CONFIRMED | **10 units per individual Product ID.** Different variants of the same product (colors, sizes) aggregate together toward the 10-unit minimum (e.g., 5 Black + 5 White mugs = VALID). Cross-product aggregation strictly rejected (e.g., 5 of Product A + 5 of Product B = INVALID). **Cart mutations with <10 units are permitted and persisted; cart UI displays remaining units required. Server-side validation strictly blocks checkout and payment initiation until MOQ is met.** |
| **D-010** | Line-item artwork / logo upload | B2B Customization | CONFIRMED | Attached to a specific order line item; stored in a persistent private filesystem directory outside the web document root on cPanel; immutable order snapshot and short-lived signed download links. S3 is excluded. |
| **D-011** | Mixed cart for physical items & services | Commerce Rules | PREFERRED_PENDING_POC | Validate native cart handling of mixed fulfillment lines in Phase 1 POC. |
| **D-012** | Bilingual site parity at launch | Content / SEO | OPEN | Arabic & English launch parity to be audited in Phase 0. |
| **D-013** | Seamless checkout registration | Identity / UX | CONFIRMED | Account created directly in checkout flow without separate registration page; customer specifies password or uses passwordless auth (no insecure temporary passwords). |
| **D-014** | Payment schedule (Full vs Deposit) | Payments | ASSUMPTION_PENDING_APPROVAL | Working assumption: 100% full upfront payment. Kept as assumption pending final owner approval. |
| **D-015** | Delivery fulfillment methods | Fulfillment | CONFIRMED | Both standard shipping and pickup from MWHEBA agency office supported. Pickup terms/fees subject to final approval (do not assume free). |
| **D-016** | Invoicing & Tax Compliance | Billing / Legal | CONFIRMED | **No electronic invoicing (ETA) required in MVP.** Do NOT build an internal PDF invoicing engine. Maintain accurate database order/payment records. Legally required tax documents flagged for separate review. |
| **D-017** | Customization / Printing Pricing | Pricing Rules | CONFIRMED | Printing and engraving fees must be calculated and displayed separately from the base product price. |
| **D-018** | Inventory tracking & stock management | Inventory | OUT_OF_SCOPE | Stock counts and warehouse management are strictly out of scope for MVP. Do not assume made-to-order either; inventory gating is omitted. |
| **D-019** | Automation / n8n | Integrations | DEFERRED | Post-launch consideration; clean webhook hooks documented. |
| **D-020** | Alternative engine (Medusa / Spree) | Architecture | DEFERRED | Evaluated only if Payload Ecommerce fails Phase 1 POC criteria. |
| **D-021** | Cash on Delivery (COD) Scope & Restrictions | Payments / Scope | CONFIRMED | COD is strictly restricted to physical merchandise orders fulfilled via standard shipping or agency office pickup. Digital services, downloadable assets, and mixed carts containing services are strictly prohibited from COD and require manual Bank Transfer. |
| **D-022** | COD Decoupling, Settlement & Courier Remittance | Payments / Accounting | CONFIRMED | COD orders confirm and enter processing with `paymentStatus: 'unpaid'`. Creation, shipping, and delivery transitions never mark the order `paid` automatically. Recording payment requires explicit collection registration (required amount, collected amount, collector identity, timestamp, collection/receipt reference). Courier collection (`collected_by_courier`) is explicitly decoupled from remittance to MWHEBA (`remitted_to_company`). Refusal of delivery updates status to `returned_to_origin` / `delivery_failed` while retaining `unpaid` (no false refunds or payments). Repeated collection entries are rejected idempotently. |
| **D-023** | Branded Merchandise Pre-Production Proof Approval | B2B Customization / Risk | CONFIRMED | Physical products requiring custom printing/artwork must pass an explicit Order Confirmation & Proof Approval (`proof_approved`) gate prior to manufacturing initiation to mitigate non-refundable production costs in case of COD delivery refusal. |

---

## Change Control Protocol
Any modification to this register requires:
1. Formal problem statement.
2. Comparative analysis of alternatives with official documentation evidence.
3. Impact assessment on delivery milestones, complexity, and security.
4. Explicit project owner approval.

# MWHEBA 2.0 | Product Requirements

**Status:** Working specification, subject to discovery and owner approval  
**Project:** Full rebuild of `https://mwheba.com/`  
**Business:** MWHEBA Agency, Egypt  
**Primary language of implementation artifacts:** English  
**Customer-facing languages:** Arabic and English (confirm launch scope)  
**Target:** Corporate website + B2B products and fixed-price services store

## 1. Vision
Build a unified, fast, SEO-friendly, content-managed website for MWHEBA Agency with a polished B2C-style buying experience designed for business customers. The platform combines agency lead generation, portfolio, content marketing, physical branded products/giveaways, and fixed-price services.

## 2. Business goals
- Increase qualified leads for custom agency services.
- Enable direct purchase of standardized services and physical products.
- Reduce manual quoting and order-processing friction.
- Enable marketing team to manage content, campaigns, and landing pages without developer involvement.
- Maintain clear ownership of orders, payments, and fulfillment.
- Keep initial operational complexity and maintenance cost reasonable.

## 3. Audiences and roles
- Anonymous visitor and guest buyer (guest checkout is proposed, not yet approved).
- Registered business buyer.
- Content editor / marketer.
- Catalog manager.
- Sales / customer support.
- Order operations / production.
- Finance / payment verifier.
- Super admin.

## 4. Core site areas
### Corporate site
- Home, About, Contact, service categories and service detail pages.
- Portfolio / case studies.
- Blog / insights.
- Dynamic landing pages and reusable page blocks.
- Lead forms, CTAs, SEO metadata, sitemap, canonical URLs.
- Arabic and English content with RTL/LTR support.

### Store
- Categories, search, filtering, product listing and product details.
- Physical promotional products, corporate gifts, giveaways, and print-related products.
- Product variants such as color and size where applicable.
- Cart, checkout, company details, orders and customer notifications.
- Fixed-price, one-time digital/agency service packages.
- Mixed carts containing physical products and services, if proven feasible in POC.

### B2B-specific rules
- Default planning assumption: minimum quantity of 10 for eligible physical products, configurable per product; service packages usually quantity 1.
- Enforce minimum quantity (10 units per Product ID with variant aggregation per D-009) strictly on the server at checkout, order creation, and payment initiation; incomplete quantities persist in cart with guidance notice.
- Optional logo/artwork upload tied to a **specific cart/order line item**, not only to the customer or entire order.
- Optional printing/customization notes per line item.
- Artwork must be preserved as immutable order evidence after checkout.
- Product and service fulfillment must be distinct, even within one order.
- Company name and contact details at checkout. Tax ID and other fields depend on business/legal decisions.

## 5. Payments and billing
**Confirmed for Phase 1:** Cash on Delivery (COD) for physical merchandise and manual corporate bank transfer for all orders (services, digital, physical).  
**Deferred to Phase 2:** Online card/wallet gateways (Paymob / Kashier) are formally deferred per Decision D-008 to unblock launch.
- One-time purchases only; **no subscriptions or recurring billing** in initial scope.
- Cash on Delivery (COD) decouples fulfillment from payment: creating, dispatching, or delivering an order NEVER marks it `paid` automatically.
- Explicit collection tracking (amount, courier/office collector, timestamp, receipt reference) with two-stage courier remittance reconciliation (`collected_by_courier` vs `remitted_to_company`), matching collected totals against remittance deposits, and idempotent collection recording.
- Delivery refusal or failure transitions order to `cancelled` and `returned_to_origin` while retaining `unpaid` (zero false payments or refunds).
- Pre-production proof approval gate (`proof_approved`) required for custom printed merchandise prior to manufacturing.
- Bank transfer orders remain pending until a finance-authorized user verifies receipt against bank records.
- Separate order, payment, invoice, and fulfillment statuses.
- Refunds and cancellations require explicit workflows and audit trails.
- Tax invoices require confirmation of MWHEBA's legal/tax obligations and integration needs. Do not equate a PDF invoice with compliance.

## 6. Product examples for POC
- Premium Thermal Mug, Silver variant, quantity **11**, optional uploaded corporate logo.
- One fixed-price brand identity package, quantity 1.
- Both in one cart; order line retains product variant, quantity, customization, and price snapshot.
- Payment by Cash on Delivery (COD) for physical items, plus bank transfer pending/verification flow (online card gateway sandbox deferred to Phase 2).

## 7. Non-functional requirements
- Responsive and accessible UI; mobile-first.
- Strong Core Web Vitals and SEO hygiene; set measurable targets during discovery.
- Secure uploads, RBAC, audit logs, backups and recovery drills.
- Transaction integrity and server-authoritative checkout validation (stock tracking and inventory reservations are strictly excluded per D-018).
- Local development reproducible with a local Node.js runtime and PostgreSQL; production targets cPanel without Docker or S3.
- Observability for failed payments, webhook errors, and background jobs.
- Staging before production; production migration with rollback plan.
- Avoid unsupported performance/uptime claims until infrastructure is benchmarked.

## 8. Out of scope for initial release
- Inventory tracking, stock levels, warehouse management, and stock reservations (strictly excluded per D-018; do not invent stock numbers; do not assume made-to-order for everything; keep inventory deferred).
- Subscription billing and automatic renewals.
- Marketplace or multi-vendor functionality.
- Full CRM, ERP, accounting system, or project management suite.
- Customer-specific negotiated pricing unless separately approved.
- AI automation and n8n orchestration, except documented future integration hooks.
- Native mobile apps.

## 9. Business Decisions & Governance Status

### Confirmed Decisions (Locked in DECISIONS.md)
- **Account Creation (D-013):** Inline account creation during checkout; no mandatory pre-registration; no temporary passwords emailed.
- **Payment Gateway (D-008):** Paymob confirmed as primary online gateway.
- **Fulfillment: Shipping & Office Pickup (D-015):** Support both standard shipping and pickup from MWHEBA Agency Office at checkout.
- **Minimum Order Quantity (D-009):** 10 units per individual Product ID. Variant aggregation permitted (e.g. 5 Black + 5 White mugs of Product #101 = PASS). Cross-product aggregation blocked (5 of Product A + 5 of Product B = BLOCKED). Incomplete cart persistence allowed; checkout strictly blocked server-side.
- **Customization Pricing (D-017):** Printing and engraving charges calculated and displayed separately from base product price.
- **Inventory & Stock Management (D-018):** Stock counts, inventory gating, and warehouse tracking are strictly OUT OF SCOPE for MVP (do not assume made-to-order for everything; keep inventory deferred).
- **Invoicing & Taxes (D-016):** No Egyptian Tax Authority (ETA) e-invoicing; no internal PDF invoice generator in MVP.

### Assumptions Pending Approval & Open Operational Details
- **Payment Schedule (D-014):** Working assumption: 100% full upfront payment at checkout (pending formal owner sign-off).
- **Shipping Rates:** Working test fixture: 60/80/90/120 EGP; free Miami office pickup (pending formal rate schedule).
- **Service Operations:** Service brief submission timing and client revision limit policy.
- **Payment Fees:** Contracted commercial Paymob transaction fee schedule.

## 10. Success definition
A marketer can publish a bilingual landing page; a buyer can order a customized physical product and a fixed-price service; finance can verify payment; operations can fulfill each line appropriately; and the team can manage everything through one primary admin without manual database work.

# MWHEBA 2.0 | Technical Architecture

## 1. Architecture decision
**Preferred, conditional stack:** Next.js + Payload CMS + Payload Ecommerce + PostgreSQL.

This is a **candidate architecture pending a blocking feasibility POC**. If the ecommerce plugin cannot support essential flows safely without disproportionate custom work, stop and produce a written alternatives assessment before changing the stack.

## 2. Design principles
- One Next.js customer-facing application.
- One primary Payload administration experience.
- One primary PostgreSQL application database.
- Modular monolith with explicit domain modules; no premature microservices.
- Server-authoritative pricing, discounts, shipping, tax and totals.
- Structured domain events and reliable background processing where needed.
- Storage separation: PostgreSQL for records; persistent filesystem outside the web document root for media and customer artwork.
- Payment provider abstraction, not gateway-specific logic throughout the codebase.
- Progressive enhancement, accessibility, internationalization and SEO by design.

## 3. Proposed modules
1. `content`: pages, blocks, navigation, blog, portfolio, SEO, localization.
2. `catalog`: physical products, fixed-price service packages, categories, variants.
3. `cart-checkout`: cart lifecycle, quantity rules, address/company fields, price validation.
4. `customization`: line-level artwork uploads, validation, metadata, order snapshot.
5. `orders`: order lifecycle, line items, customer view, admin operations.
6. `payments`: gateway adapter, bank transfer workflow, webhook processing, reconciliation.
7. `billing`: invoice references, tax integration boundary, refund/credit-note metadata.
8. `fulfillment`: physical production/shipping and service brief/delivery workflows.
9. `identity`: users, guests, RBAC, sessions, account security.
10. `integrations`: email, optional notifications, future CRM/n8n hooks.

The exact module layout must match verified Payload/plugin extension points. Do not invent hooks or interfaces.

## 4. Integration boundaries
- Gateway adapter supports session creation, verification, capture status, refunds (if supported), and webhook normalization.
- Manual bank transfer is an explicitly different payment flow; proof upload alone never marks paid.
- Invoice integration is separate from payment gateway integration.
- Shipping integration remains optional until fulfillment scope is decided.
- Future n8n receives authenticated domain events, not direct write access to core payment tables.

## 5. Deployment topology
- Next.js/Payload Node.js application on cPanel, subject to verification of the host's runtime and process manager.
- PostgreSQL database with backups and least-privilege credentials.
- Persistent private filesystem directory outside `public_html` for uploads, with tested backup and restore.
- Reverse proxy with TLS, WAF/rate limiting as appropriate.
- Redis/worker only if required by selected job queue, caching or rate-limit design.
- Separate local, staging, and production environments with separate secrets and payment credentials.
- Production deployment via reviewed migrations and documented rollback.

## 6. Security requirements
- RBAC for content, operations and finance roles.
- Server-side authorization for all admin mutations and file access.
- Artwork MIME/type/signature, size and extension validation; malware scanning where practical.
- Private storage and expiring signed URLs for customer-supplied files.
- Webhook signature verification and deduplication.
- Avoid storing sensitive card data or exposing payment secrets.
- Input validation, CSRF/session protections, rate limiting, security headers.
- Audit logs for payment verification, refunds, price edits and order status changes.

## 7. SEO and internationalization
- Arabic/English localization with RTL/LTR handling.
- Canonical and hreflang rules where applicable.
- Structured data for appropriate page types.
- Preserve/migrate URLs where possible and create explicit 301 redirect map.
- Dynamic sitemap, robots rules, indexability review for cart/account/checkout.

## 8. POC must validate
- Installed Payload Ecommerce version, maintenance status and exact API capabilities.
- Product variants and cart resilience (incomplete cart quantities persist cleanly).
- Per-product minimum quantity validation (MOQ of 10 per individual Product ID across variants per D-009) enforced strictly server-side at checkout.
- Line-item logo upload and reliable cart-to-order persistence with immutable snapshots.
- Mixed physical/service cart and correct fulfillment semantics without requiring shipping for services.
- Payment provider integration: Cash on Delivery (COD) decoupled lifecycle (order execution does not mark paid; explicit collection tracking; two-stage courier remittance reconciliation; refusal handling; idempotency; custom branded proof approval gate). Manual bank transfer pending flow and controlled RBAC authorization/confirmation. (Online Paymob gateway formally deferred to Phase 2 per D-008).
- Correct totals, atomic concurrency locking, and order/payment consistency under retries and downtime.
- Basic refunds/cancellation and order status transitions (stock and inventory tracking strictly excluded per D-018).

## 9. Architecture guardrails
Do not:
- Add Medusa or a second commerce engine without approval.
- Store artwork as base64 in PostgreSQL.
- Trust client-submitted prices or totals; all calculations are server-authoritative.
- Mark COD orders paid automatically upon order placement, shipping, or delivery; require explicit collection registration.
- Permit unverified courier remittance without matching collected totals against deposit slips.
- Introduce inventory or stock reservation tables (out of scope per D-018).
- Use a single status field to represent order, payment and fulfillment.
- Add subscriptions to solve one-time service packages.
- Assume plugin beta functionality is production-ready without tests.

# MWHEBA 2.0 | Conceptual Data Model

**Purpose:** Domain blueprint, not final Payload collection names or migration code. Verify which entities are provided by Payload Ecommerce before extending them. Do not duplicate plugin-owned models.

## 1. Content domain
- `Pages`: slug, locale, title, page blocks, SEO, status, publication metadata.
- `Navigation`: menus, items, locales.
- `BlogPosts`: author, categories, content, SEO, locales.
- `PortfolioProjects`: industry, services, gallery, results, content, locales.
- `ServicePages`: agency service marketing pages, CTA, lead form linkage.
- `Media`: metadata, storage key, alt text, ownership/access policy.

## 2. Commerce domain
Prefer plugin-native entities where suitable:
- `Products`: title, type (`physical` or `fixed_service`), publication status.
- `ProductVariants`: SKU, attributes, sellable price (inventory and stock tracking strictly excluded per D-018).
- `Categories`: hierarchy and merchandising metadata.
- `Carts`: buyer/guest identity, currency, totals, line items.
- `CartItems`: product/variant reference, quantity, price snapshot, customization reference.
- `Orders`: immutable purchased-item snapshots, buyer/company details, statuses.
- `OrderItems`: purchased variant/service, quantities, customization snapshot, fulfillment type.
- `Customers`: account/guest identity and business contact information.

## 3. B2B extensions
- `ProductPurchaseRules`: product reference, min quantity (MOQ 10 per Product ID per D-009), variant aggregation policy, cross-product isolation.
- `ArtworkAssets`: private object key, original filename, MIME, size, uploader, scan status.
- `LineItemCustomizations`: cart/order item linkage, artwork reference, printing notes, separate printing fee (D-017).
- `CompanyProfiles`: company name, contacts, billing fields (exact legal fields TBD).
- `ServiceBriefs`: order item reference, questions, answers, attachments, submitted date.
- `FulfillmentJobs`: order item reference, type, status, assignment, dates and evidence.

## 4. Payment/billing extensions
- `PaymentAttempts`: order/cart reference, provider, external session ID, expected amount_cents, currency, state (`initiated`, `failed`, `succeeded`, `amount_mismatch`).
- `PaymentEvents`: provider event ID, idempotency key, signature verification result, processing state (`processing`, `completed`, `failed`), timestamps.
- `BankTransferSubmissions`: order reference, claimed amount, bank reference, proof asset, submitted by.
- `BankTransferVerifications`: verifier, bank reconciliation reference, decision, timestamp.
- `InvoiceRecords`: invoice number/reference, status, tax integration reference, immutable snapshot.
- `RefundRecords`: order/payment reference, amount, reason, provider refund reference, state.
- `AuditEvents`: actor, action, entity, before/after references, time and request correlation.

## 5. Domain invariants
- Cart/order quantities must meet server-side purchase rules (10 units per Product ID across variants).
- Product variants and service packages must have clear fulfillment behavior without mandatory shipping for services.
- Each customization belongs to a specific line item.
- Order item snapshots must survive subsequent product/content edits.
- **Payment Verification Invariant:** A payment is marked `paid` ONLY after:
  1. Cryptographic HMAC signature matches payload.
  2. Gateway confirms `success === true` and `pending === false`.
  3. Referenced Order and PaymentAttempt exist in `unpaid` / `payment_pending` state.
  4. Callback `amount_cents` matches server order total exactly (penny-perfect).
  5. Callback `currency` matches order currency exactly.
  OR an authorized finance officer approves a manual bank transfer slip with internal reconciliation code.
- Financial operations are strictly idempotent; provider events deduplicated via database unique constraints and row-level locks.
- Refunds never silently erase original payment history.
- Tax/invoice records are auditable and never inferred solely from a checkout success screen.
- No unauthorized public access to uploaded customer artwork.
- Order state transitions must be transactionally consistent; inventory/stock tracking is strictly excluded per D-018.

## 6. Modeling questions for discovery
- Which entities are native to the exact installed plugin version?
- Does the plugin support mixed cart item types and per-item metadata?
- How are guest carts linked to customers after checkout?
- How does the candidate schema accommodate omitting stock tracking per D-018?
- Which payment and tax fields exist natively?
- Is invoice numbering owned by a certified external system?
- What retention and deletion rules apply to artwork and invoices?

## 7. Deliverable
After POC, produce `docs/schema/verified-schema.md` with actual collection names, indexes, relations, unique constraints, permissions and migration plan. Do not generate schema from assumptions alone.

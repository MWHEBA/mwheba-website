# Orders

**Priority** P0. Implement lifecycle changes alongside Inventory and Cash on delivery.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

Every successful purchase yields one durable order. Customers can follow their own orders, while merchants manage fulfillment and exceptions from Payload Admin with a traceable lifecycle.

## Current implementation

- `src/modules/orders/services/orderService.ts` creates orders, writes ordered item snapshots, creates fulfillment jobs and marks the cart purchased inside a transaction.
- `src/payload.config.ts` extends Payload Ecommerce order fields, hooks and role checks. `src/modules/orders/logic/orderSnapshotEngine.ts` provides snapshot and amount conversion logic.
- `src/modules/fulfillment/services/fulfillmentService.ts` owns line fulfillment and proof handling. The order detail and service brief live under `src/app/(frontend)/[locale]/account/orders/[id]/`.

## Dependencies

Read the [implementation roadmap](README.md), [Checkout](checkout.md), [Inventory](inventory.md), [Customers](customers.md), [Cash on delivery](cash-on-delivery.md), [Shipping](shipping.md) and [Store configuration](store-configuration.md). Add later payment and coupon data to this same model.

## Implementation

1. Reuse `createOrderFromCart` and the existing commerce collections as the canonical order path. Check native, admin and custom entry points for paths that could create orders or bypass required validation. Use the same mutation services for approved admin workflows.
2. Scope the idempotency key to the cart and authorized actor. Allocate the order number, store the order, allocate inventory, create required fulfillment jobs and close the cart in a consistent transaction. Roll back on failure. Handle an ambiguous commit by resolving the existing authorized order. Preserve a stable order number for support and customer references.
3. Freeze the order lines, SKUs, quantity, prices, separate customization amounts, approved artwork references, currency, shipping, tax, discounts when enabled, total and fulfillment policy. Keep legacy EGP and accounting-minor-unit fields compatible through explicit migrations. Catalog and settings edits apply to new quotes and orders.
4. Keep order, fulfillment, payment and remittance states independent. Record actor, time and reason for transitions. Use existing proof and per-line fulfillment rules. COD collection changes payment only through settlement. Bank transfer remains pending until finance verifies it.
5. Make cancellation and return processing explicit and permission-checked. A pre-dispatch cancellation can return the allocation once. A refusal after dispatch records the exception and remains unpaid if cash was never collected. Restore stock once only after operations approves the received sellable return. Financial adjustments and return stock movements have separate references and audit entries.
6. Provide role-appropriate admin lists for order lookup, packing, exception handling and settlement. Give customers an owned order history and detail view. Paginate lists and keep private artwork and payment proof under existing access controls.
7. Dispatch confirmation and approved status notifications only after successful commit. Reuse the existing templates and a configured delivery path. Record retryable failures without rolling back a valid order or triggering duplicate notifications.

## Verification

Use a disposable, migrated PostgreSQL database. Assert persisted order, job, cart, stock and payment state together for critical transitions.

```bash
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bOrderCreation.test.ts tests/b2bFulfillment.test.ts tests/pay03BankTransfer.test.ts tests/pay04ProofAndRefusal.test.ts tests/pay05FinancialLedger.test.ts
```

| Acceptance case | Observable result |
| --- | --- |
| Repeat checkout after successful commit or simulate a lost response | Same order and fulfillment jobs are recovered. The cart is closed and stock is allocated once. |
| Inject a failure during creation | Order, fulfillment job and stock movement roll back together. |
| Change product title, price or shipping settings after sale | Existing order preserves its original customer-approved values. |
| Deliver, record COD collection and reconcile the courier | Delivery preserves the unpaid payment state. Authorized collection and remittance update their separate records. |
| Cancel before dispatch and replay return handling after dispatch | Valid adjustment returns stock once. Refused, unreceived or unsellable goods stay out of available stock. |
| Customer, operations and finance access | A customer sees only owned records. Staff actions follow their permissions and create audit entries. |

### Local verification, 2026-11-26

- PostgreSQL integration injected an exception after a successful commit and recovered the durable order with its original reference, one fulfillment job, a closed cart and one allocation. A separate failure during the second fulfillment job left the order, first job, cart closure and allocations rolled back. Existing regressions verify frozen prices and delivery terms, customer ownership, COD collection, remittance and bank verification. [Inventory and order tests](../../tests/inventoryOrders.test.ts) · [Checkout regressions](../../tests/b2bOrderCreation.test.ts)
- A production build served two concurrent last-MOQ checkouts over loopback HTTP. One completed with HTTP 201 and remained unpaid. The other received HTTP 409. The authenticated customer opened the original order detail, an exact retry recovered the same order with HTTP 200, and a customer attempt to cancel through the staff endpoint returned HTTP 403. Operations restored stock once through the pre-dispatch cancellation endpoint. [Stock export](inventory.md#local-verification-2026-11-26)
- PostgreSQL tests confirmed that refusal after dispatch keeps payment unpaid with zero collection records or automatic restoration. An authorized inspection restored four of six received units once, rejected attempts beyond the remaining dispatched quantity and rejected receipt of a different SKU that had not been dispatched. [Lifecycle integration tests](../../tests/inventoryOrders.test.ts)

`npx tsc --noEmit`, `npm test` (528 tests across 42 files), and `npm run build` (63 generated pages) passed locally. Owner staging validation and notification transport are deployment gates.

## Definition of done

A merchant can find, fulfill and reconcile a real test order without direct database changes. Customers see their confirmed details, and order, stock and payment state stay consistent under retries and cancellations.

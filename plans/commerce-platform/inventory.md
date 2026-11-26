# Inventory and stock movements

**Priority** P0. **Depends on** [products and variants](products.md) and the merchant deployment boundary in [store configuration](store-configuration.md). **Integrations** [cart](cart.md), [checkout](checkout.md), [orders](orders.md), and [cash on delivery](cash-on-delivery.md).

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

Staff can initialize and reconcile sellable stock per SKU in Payload Admin. Checkout protects the last units under concurrent purchases. Operations can restore sellable units once after a qualifying cancellation or approved return, with an audit trail.

## Start here

Follow the [delivery plan](README.md) for the shared test environment and release order.

- `src/payload.config.ts` sets `inventory: false` on the Ecommerce plugin under D-018. Record the superseding inventory decision and approved rollout scope before schema work. The installed plugin's inventory capability needs a compatibility check with the current custom checkout.
- `src/modules/orders/services/orderService.ts` creates orders in the current PostgreSQL transaction. Use this lifecycle boundary for stock allocation.
- Follow existing cart validation in `src/modules/cart-checkout/services/cartStorage.ts`. Coordinate cancellation and return paths with the order and fulfillment modules and `src/modules/payments/services/codSettlementService.ts`.
- Review `src/migrations/` and `tests/b2bOrderCreation.test.ts` for transaction and migration precedents.

## Stock rules

- Maintain one canonical available quantity per sellable SKU. A simple product has its own stock. A variable product's stock is owned by each sellable variant. A fixed-price service has no physical stock movement.
- Cart adds and quotes can report availability but acquire no hold. A successful order allocates quantities by decrementing the available balance exactly once. Fulfillment, dispatch, delivery, and cash collection reuse the original allocation.
- A pre-dispatch cancellation can restore allocated sellable units once through the order transition. After dispatch, carry the allocation through refusal or a canceled delivery and restore only the quantity that authorized staff confirms was received and is sellable. Unsellable stock stays out of available stock.
- Capture each opening balance, order allocation, approved return, and manual adjustment in an auditable movement linked to the SKU, actor or trusted process, operation identity, quantity, and reason. Treat unavailable or uninitialized tracked quantities as unpurchasable until reconciled.

## Record an opening balance

1. In a disposable deployment, create synthetic physical products and variants with distinct SKUs. For an existing merchant, prepare the signed-off source quantities and reconcile open orders before applying any balance. Each candidate uses the SKU of a simple product or an individual variant. Use available-to-sell quantities after deducting obligations still outstanding at cutover.
2. An operations or super-admin account can submit up to 500 `{ sku, quantity }` rows to `POST /api/inventory/preview-opening`. Use whole nonnegative quantities. The read-only response labels each row `matched`, `duplicate`, `unresolved`, `initialized`, or `invalid`. Check duplicates across batches before opening any balances. Save unresolved items for review with the source row references.
3. In Payload Admin, look up each matched SKU and record its opening quantity with the approved source reference in the reason. Zero is a valid opening balance. An intentional later correction uses a signed quantity and a reason. An authorization failure, an unresolved SKU, or an already initialized balance requires separate review. An `operations` or `super_admin` actor records movements. Catalog managers can inspect the balances and movement history.
4. Verify the balance and opening movement before purchase testing. Keep the same operation key for a retry of a submitted opening or adjustment. A different operation on an initialized balance uses the adjustment action. Reconcile the source total against recorded openings and preserve the before/after report.

The migration initializes no balances. Orders placed before inventory activation have no allocation movement and therefore cannot produce a stock credit. If goods from those orders later return in sellable condition, Operations must reconcile the return and use an independently documented manual adjustment. Merchant source quantities, cutover reconciliation, and the backup and restore rehearsal require an approved merchant dataset and deployment.

## Implementation

1. Compare the pinned plugin's stock field and write path with custom checkout and decide which single persisted balance the app will use. Record D-018's replacement, the lifecycle, the admin adjustment policy, and the approach to existing open orders. Add an additive migration for the approved SKU balance and any movement records. Verify fresh and existing databases.
2. Load reconciled opening stock from authorized fixture or merchant data. Dry-run SKU matching, duplicate detection, missing balances, and open-order allocation semantics. Keep a report of unresolved SKUs. Treat unknown balances as unresolved and account for pre-cutover allocations exactly once.
3. Extend the existing order transaction to aggregate demand by SKU. Lock or update consistently in deterministic SKU order, validate every line against available stock, and atomically write the changes and audit movements together with the order. A shortage anywhere leaves the order and every balance unchanged. Carry the existing order idempotency identity through retry and ambiguous-success recovery so each allocation is applied once.
4. Use the same movement boundary for authorized adjustments, pre-dispatch cancellation, and inspection-approved returns. Enforce eligible status transitions and restored quantity limits. Protect existing inventory from direct edits outside this boundary, including admin entry points and later payment integrations.
5. Surface stock state and back-office movement history where needed. Wire actionable cart and checkout shortage messages to the common quote and normal order API. Keep reorder reminders and multi-location inventory outside this phase unless separately approved.

## Test and acceptance

Use a disposable PostgreSQL database with real concurrent transactions. Run the existing regressions, then add cases for the new inventory policy.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bOrderCreation.test.ts tests/b2bCartResilience.test.ts tests/pay01CodEngine.test.ts tests/pay04ProofAndRefusal.test.ts
```

| Fixture | Pass condition |
| --- | --- |
| One eligible purchase quantity and two parallel order submissions | Exactly one order succeeds and the final available balance is zero. The other buyer gets a recoverable stock error. Use a single retail unit when enabled or one minimum order quantity for B2B. |
| Same SKU across several cart lines and one other SKU with insufficient stock | Total demand for each SKU is checked. Any shortage rolls back the order and all movements. |
| Repeated or interrupted request after the database commits | Retry resolves the original order. Each SKU balance and allocation movement changes only once. |
| Pre-dispatch cancellation retried or COD refused after dispatch | Pre-dispatch release happens once. Refusal keeps the allocation pending a return inspection. A confirmed sellable return releases at most the previously allocated quantity and the retry is a no-op. |
| Simple product, two variants, and service | Sales and corrections affect only the chosen SKU balance, variants stay independent, and the service has no stock movement. |
| Staff adjustment and existing WooCommerce stock | Permitted staff can record a reason and adjust stock. Unauthorized changes fail. Imported balances reconcile by SKU, exclude unresolved inputs, and survive a repeat run. |

Stage a purchase, a cancel or return, and an admin adjustment. Save a before/after stock export plus the linked order and movement IDs. Run migration and restore drills for a copy of an existing store before applying changes to an existing merchant deployment.

### Local verification, 2026-11-26

- PostgreSQL 16.16 accepted the inventory migration on a fresh database and on a copy of the immediately preceding schema. The upgrade kept the synthetic legacy order, cart and SKU line intact. Cancelling that order after opening stock at 20 left 20 available and created zero restoration movements. A restored pre-upgrade snapshot retained the original unpaid order and pre-inventory schema. [Migration](../../src/migrations/20261126_090000_store_inventory.ts)
- Nine integration cases cover concurrent last-MOQ submission, aggregated customized lines, failed fulfillment-job rollback, ambiguous commit recovery, staff adjustments and history, variant separation, cancellation and inspected returns. The opening preview returned matched, initialized, duplicate, unresolved and invalid rows consistently across two runs with zero writes. This used synthetic inputs. Merchant opening quantities and cutover reconciliation await approved source data. [Integration tests](../../tests/inventoryOrders.test.ts)
- A production build served two concurrent purchases of the last 10 units over loopback HTTP. The winning purchase returned 201 and the other returned 409 with `INSUFFICIENT_STOCK`. The same authorized retry returned the original order. Operations cancellation returned the 10 units once, then a counted correction removed two damaged units. The table records the local stock export for order `MWH-2026-10003`, ID `3`, and synthetic SKU `STOCK-SMOKE-236598bb-f6a3-43e9-ab5f-963a6cea98b7`.

| Operation | Quantity change | Available afterward | Movement ID | Order ID |
| --- | ---: | ---: | ---: | ---: |
| Before opening | | Uninitialized | | |
| Opening | +10 | 10 | 3 | |
| Checkout allocation | -10 | 0 | 4 | 3 |
| Pre-dispatch cancellation | +10 | 10 | 5 | 3 |
| Staff correction | -2 | 8 | 6 | |

`npx tsc --noEmit`, `npm test` (528 tests across 42 files), and `npm run build` (63 generated pages) passed locally.

## Definition of done

There is one stock balance and one movement path per SKU. Available quantity cannot go negative through normal flows. Every write and restore is authorized, auditable, and safe to retry. Test evidence includes concurrent last-unit purchases, rollback, verified imports, and lifecycle behavior for COD.

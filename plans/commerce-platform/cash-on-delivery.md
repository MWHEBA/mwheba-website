# Cash on delivery

**Priority** P0, required for the COD pilot and the full commercial release.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Scope and baseline

- Support explicit collection for an eligible courier delivery or pickup. Keep order, fulfillment, payment and remittance states independent.
- The repository already has a [COD eligibility engine](../../src/modules/payments/services/codEngine.ts), a [settlement and refusal service](../../src/modules/payments/services/codSettlementService.ts), and [COD API routes](../../src/app/api/payments/cod).
- Reuse [payment collections](../../src/modules/payments/collections/PaymentCollections.ts) and [courier remittances](../../src/modules/payments/collections/CourierRemittances.ts). Read decisions D-007 and D-021–D-023 before changing payment or proof behavior.
- Depends on [Store configuration](store-configuration.md), [Shipping](shipping.md), [Checkout](checkout.md), [Orders](orders.md) and [Inventory](inventory.md). Follow the [execution plan](README.md) for their rollout order.

## Implementation steps

1. Resolve COD availability from the deployment's settings, the approved fulfillment method and all order lines. Require a nonempty cart of eligible physical merchandise. Check again when creating the order. Keep manual bank transfer available under the existing merchant policy for service and mixed carts.
2. Use the canonical quote and order service to persist the accepted amount and currency. A confirmed COD order starts unpaid with collection pending. Allocate stock within that order transaction using the Inventory contract. Dispatch, delivery and pickup readiness change fulfillment state only.
3. Provide authorized staff with an observable workflow to record cash against an eligible order. Record the expected and collected amount, currency, collector and channel, timestamp and unique receipt reference. Compare integer minor units to the frozen total and validate the actor and fulfillment state on the server. Route mismatches to finance review.
4. Write the collection, audit event and payment transition once in a transaction. A retry with the same intent returns the existing result. A conflicting receipt or prior incompatible settlement returns a controlled error. Use the existing pricing and accounting boundaries without converting the accepted total twice.
5. Reconcile courier collections separately from individual payments. Link the submitted remittance to eligible collections, validate gross and net against the documented deductions, and prevent already matched collections from entering another batch.
6. Route cancellation and refusal through Orders. Restore stock once after an eligible pre-dispatch cancellation or after operations receives and approves sellable returns. A refusal leaves the unpaid order unpaid and records the fulfillment outcome. Follow the existing approved proof gate before manufacturing customized items.
7. Present authorized operations and finance actions with bilingual payment, collection and reconciliation labels. Verify the merchant can distinguish orders waiting for cash from cash awaiting remittance.

## Staff workflow

- Give operations a queue for orders awaiting dispatch or pickup and finance a view of cash awaiting reconciliation. Reuse the existing role boundaries and service actions.
- Make references and correction reasons available on the staff order record. Log payment and stock changes against the responsible actor and order.
- Use the deployment's configured business name and fulfillment labels throughout the workflow.

## Verification

Use a disposable migrated PostgreSQL database, isolated storage and test-only credentials. Run from the repository root.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/codStorefront.test.ts tests/pay01CodEngine.test.ts tests/pay02CodSettlement.test.ts tests/pay04ProofAndRefusal.test.ts tests/pay05FinancialLedger.test.ts tests/b2bFulfillment.test.ts tests/inventoryOrders.test.ts
npm test
```

| Acceptance fixture | Expected result |
|---|---|
| Published physical item, approved delivery or pickup, COD enabled | One order is confirmed and unpaid. Dispatch or delivery alone leaves payment unpaid. |
| Service-only, mixed, empty, or excluded delivery option | Checkout prevents COD selection and the order service rejects direct COD submission. |
| Exact collection, replay, concurrent conflicting receipt | Exact collection marks the order paid once. Replays preserve one ledger event and conflicting entries are rejected. |
| Online payments and coupons disabled for this merchant | An eligible COD order can be placed, collected and reconciled through the same storefront and staff flow. |
| Courier collects, finance reconciles a matched batch | Collection and remittance are separately visible. A second reconciliation leaves balances unchanged. |
| Unauthorized collector, mismatched amount or currency | Order remains unchanged and finance can see the failure reason. |
| Customized order awaiting proof, refusal after dispatch, sellable return | Production waits for proof. Refusal records the original unpaid state. Approved restock restores the correct quantity once. |

On staging, place an order from the storefront and walk it through collection and reconciliation using test funds or an explicitly approved operational dry run. Record order, collection and remittance references with no shopper details in the evidence.

### Local verification, 2026-11-26

- Disposable PostgreSQL 16.16 accepted the repository migrations from an empty database. The [storefront regression](../../tests/codStorefront.test.ts) exercised the real cart, checkout, fulfillment and COD handlers with scoped staff and buyer sessions. It rejected COD for empty, service-only, mixed and excluded-delivery carts. After dispatch or delivery the order stayed unpaid. One ready pickup line could not authorize cash while another line was queued. Refusal left an unpaid order with zero collections and the same stock balance and movements. A concurrent receipt collision across two orders produced one collection and one conflict. Finance could read the recorded amount and currency mismatches.
- A production build served a synthetic courier order over loopback HTTP. Checkout returned 201 and the authenticated buyer opened the order in Arabic and English. The order stayed unpaid through all four physical fulfillment transitions. The buyer's collection attempt returned 403 and a currency mismatch returned 422. Exact collection and retry left one collection record. With remittance disabled, finance could not submit the batch. After opt-in, finance reconciled the batch and a repeat returned `ALREADY_RECONCILED`. The order remained paid with `remitted_to_company`, and available stock stayed at zero after the 10-unit allocation.

| Synthetic evidence | Reference |
| --- | --- |
| Order | `MWH-2026-10002`, ID `2` |
| Frozen total | `87,950` piastres, EGP |
| Collection | ID `1`, `SMOKE-004120ae-d31c-4282-9a29-f9043236dc3b` |
| Remittance | ID `1`, `SMOKE-BATCH-b1c6bc7b-b69f-4273-9149-67cfbcad925d` |

`npx tsc --noEmit`, the focused regression run (86 tests across seven files), `npm test` (532 tests across 43 files), and `npm run build` (63 generated pages) passed locally.

Eligible delivery and pickup coverage and fees come from each merchant's approved `pilotFulfillment` configuration. New courier remittance batches require `pilotFulfillment.courierRemittanceEnabled: true` after the merchant approves the accounting process and deductions. The amounts above are synthetic. The merchant's staging walkthrough and Arabic and English browser checks remain pending.

## Definition of done

- An enabled merchant can complete courier or pickup COD through storefront and staff tools with a reproducible ledger.
- Order, payment, remittance and inventory evidence agree after retry, cancellation and refusal.
- Existing manual transfer, B2B proof and role authorization coverage passes.

# Online payments

**Priority** P1, required for the full commercial release after the COD pilot. Live activation is configured per merchant.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Scope and baseline

- Deliver at least one verified provider through a hosted or provider-controlled payment flow. Keep the provider adapter boundary reusable across merchant deployments. Paymob is a candidate for activation under D-008 after sandbox and merchant approval.
- The repository has a dormant [Paymob adapter](../../src/modules/payments/adapters/paymobEngine.ts), [webhook handler](../../src/modules/payments/endpoints/paymobWebhook.ts), [payment attempts](../../src/modules/payments/collections/PaymentAttempts.ts) and [payment events](../../src/modules/payments/collections/PaymentEvents.ts). The current webhook is disabled in [Payload configuration](../../src/payload.config.ts) and the [order route](../../src/app/api/checkout/create-order/route.ts) blocks Paymob.
- Depends on [Checkout](checkout.md), [Orders](orders.md), [Inventory](inventory.md), [Store configuration](store-configuration.md) and the [cash-on-delivery pilot](cash-on-delivery.md). Follow the [execution plan](README.md) for release gates.
- Preserve existing manual bank transfer and COD semantics. Confirm the provider's current supported payment methods, signing contract, event model, refund requirements and account configuration against official documentation and the installed integration before implementing.

## Implementation steps

1. Confirm merchant onboarding, currency and eligible checkout flows. Write down the verified sandbox initiation and event lifecycle, pending expiration, timeout reconciliation, late success and refund handling. Secure merchant credentials per deployment and environment.
2. Keep the shared quote and order service authoritative. Create a pending payment attempt against the frozen order and amount. Coordinate stock allocation and expiration with Inventory. Never allocate twice if the provider completes the same order through a different callback or retry.
3. Initialize a provider session on the server with the stored amount, currency, merchant order reference and idempotency key. Store the provider references and state needed for reconciliation. Use the existing financial representation and a single conversion at each external amount boundary.
4. Route the shopper to the verified payment surface and show the order's current state on return. Restrict returned status details to the authorized session or order owner. A browser redirect can update the experience while verified server-side evidence drives settlement.
5. Authenticate provider events according to its documented protocol. Validate the event against the expected merchant, amount, currency and attempt or order identity. Record durable event identity and apply the state transition atomically with the associated payment ledger update. Duplicates and out-of-order events leave terminal states consistent.
6. Resolve uncertain outcomes through provider reconciliation. Coordinate expiry and restock with Orders and Inventory. A verified success received after expiry or stock release requires finance review and a recovery decision before fulfillment, such as reacquiring stock under the agreed policy or refunding the payment.
7. Keep merchant enablement off until its sandbox evidence, operational runbook, alerting and finance approval are ready. Document an enable and disable procedure that preserves reconciliation for existing attempts.

## Payment data boundary

- Keep card entry and card data inside the provider-controlled payment surface. Store only the reference, outcome and financial values needed to operate the merchant's order.
- Scope credentials, event verification and reconciliation to the current deployment. Separate sandbox and live credentials and use traceable references in logs.
- Assign ownership for handling stuck attempts and verify the provider settlement report against recorded transactions.

## Verification

Use a disposable migrated PostgreSQL database and the local test configuration. Run the existing regression command while the provider is disabled. If the activation contract changes, retain a disabled-merchant test.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/pay05FinancialLedger.test.ts tests/pay03BankTransfer.test.ts tests/pay01CodEngine.test.ts
npm test
```

| Acceptance fixture | Expected result |
|---|---|
| Merchant with provider disabled or missing configuration | Method is unavailable and the server rejects initiation. COD and configured manual bank transfer remain usable. |
| Successful and failed sandbox payments | Verified success settles one order once. Failed payment remains actionable under the agreed retry or expiry policy. |
| Redirect without confirmation, invalid signature or mismatched event | Payment state and ledger remain unchanged. |
| Repeated initiation, duplicate callback or out-of-order provider status | One logical payment is recorded and a settled order remains settled. |
| Managed zone rate and an eligible coupon | The provider amount equals the customer-approved total, including the saved charge and discount. Webhook settlement and reporting reconcile to that same order. |
| Pending attempt expiry followed by a late verified success | Stock and refund or fulfillment follow the agreed reconciliation policy, with a finance review record. |
| Authorized refund or approved manual refund workflow | The linked financial record and order display reflect the outcome with traceable references. |

Keep automated tests deterministic with stubbed provider responses and verified-format fixtures. Record separate sandbox smoke evidence for initiation, successful payment, failure and reconciliation before any live activation.

## Definition of done

- A configured merchant can validate the complete sandbox flow with an owned order and auditable payment record.
- Pending, duplicate, late and inconsistent outcomes have tested resolution behavior and an operations owner.
- Deployment settings control availability, and server-side confirmation is the authority for paid status.

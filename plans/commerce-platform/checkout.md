# Checkout

**Priority** P0. Start when the real cart is available, then complete with Inventory, Customers, Orders and COD.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

Take one authorized cart through contact details, delivery, server quote and confirmation into a durable order. The customer sees exactly what they are confirming and retains valid contact and delivery details when correcting price, stock or address changes.

## Current implementation

- `src/app/(frontend)/[locale]/checkout/page.tsx` renders `src/modules/cart-checkout/ui/CheckoutView.tsx`.
- `src/app/api/checkout/quote/route.ts`, `src/app/api/checkout/create-order/route.ts`, `src/modules/orders/services/checkoutQuote.ts` and `src/modules/orders/services/orderService.ts` implement the current quote and order services. Review `src/app/api/cart/validate-checkout/route.ts` and its server-action counterpart for shared validation.
- Existing code supports COD and manual bank transfer and checks quote drift. Reuse its session and snapshot behavior. The UI currently defaults to shipping and needs a service-only path.

## Dependencies

Read the [implementation roadmap](README.md), [Cart](cart.md), [Inventory](inventory.md), [Orders](orders.md), [Customers](customers.md), [Shipping](shipping.md), [Cash on delivery](cash-on-delivery.md) and [Store configuration](store-configuration.md). Keep the interfaces ready for [Online payments](online-payments.md) and [Coupons](coupons.md) after P0.

## Implementation

1. Keep `/api/checkout/quote` and `/api/checkout/create-order` as the storefront entry points. Ensure anonymous checkout uses the current approved guest-cart and inline registration flow. Require an existing account to authenticate before attaching an order to it. Resolve user, cart and merchant configuration server-side.
2. Reuse one calculation path for the quote and order placement. Capture authoritative product prices, variant selections, quantities, customization, eligible discounts, shipping, configured tax and total. Preserve the current EGP amounts and financial minor-unit boundary. Keep amount conversion in the existing shared logic.
3. Get eligible delivery and payment methods from server rules. Require a validated shipping address for delivery and apply an approved rate. Render pickup details when pickup is selected. Agree and document the no-shipping flow for service-only orders and retain mixed-cart handling. Require COD eligibility for the whole cart. Keep manual bank transfer available only when configured and permitted.
4. Revalidate ownership, cart version or line contents, publication, variant, MOQ, stock, address, delivery fee, payment eligibility and current quote at confirmation. If the accepted selection or totals have changed, return a typed conflict and a fresh quote. Ask the customer to confirm the new amount. Leave checkout data available for correction.
5. Use a stable checkout operation key across retries and scope it to the current cart and customer or guest session. Create the order, freeze the quote, allocate the stock once, add fulfillment jobs and mark the cart purchased in the authoritative transaction. Delegate transitions and adjustments to [Orders](orders.md).
6. Show the committed order number, amount, payment method and order link. Preserve sign-in and recovery when a new account succeeds or when the response is lost. Use a private, authorized order destination. Start the next cart through the existing cart lifecycle.
7. Cover loading, invalid input, low stock and payment unavailability in Arabic and English. Keep keyboard focus on the relevant error or confirmation and keep address/contact details available on recoverable errors.

## Verification

Run against a disposable, migrated PostgreSQL database. Add HTTP integration tests through the actual quote and create-order routes with real database fixtures.

```bash
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bOrderCreation.test.ts tests/b2bCommerceSettingsAndPricing.test.ts tests/pay01CodEngine.test.ts tests/rel01E2EAcceptance.test.ts
```

| Acceptance case | Observable result |
| --- | --- |
| Published physical variant with stock, served address and COD | Quote equals order snapshot and the amount shown to the customer. One order and one stock allocation exist. |
| Guest signs up inline, returning customer authenticates | Both paths retain the valid cart and the order can be opened by its owner. |
| Price, shipping rate or stock changes between quote and placement | Price/rate drift requires a fresh confirmation. Insufficient stock blocks placement with a clear correction path. |
| Service-only and mixed carts | Service-only flow uses no shipping when enabled. Mixed carts retain distinct fulfillment. COD remains restricted to eligible physical orders. |
| Invalid address, unsupported payment or a modified client total | Accepted order data always matches the server quote, or the request is rejected without order creation. |
| Full commercial release with online payment, configured shipping zone and coupon | The address resolves to an approved rate, discount and shipping are saved on the order, the provider amount matches the accepted quote, stock allocates once and verified settlement reconciles to the same order. |
| Request timeout or duplicate submit | Retry recovers the original order and allocates stock once. |

### Local checkout evidence, 2026-11-26

- Quote and order placement use the same server pricing rules in EGP. For an active cart, order placement requires the confirmation returned with its current quote. The route tests reject missing confirmations, altered totals and confirmations issued for another cart. They also reject direct selection of bank transfer when that method is unavailable. [Checkout integration tests](../../tests/b2bOrderCreation.test.ts)
- On synthetic fixtures, a product increase offset by a lower customization fee returned HTTP 409 at the original 2,300 EGP total. A product decrease offset by shipping rising from 80 to 100 EGP returned HTTP 409 at 2,080 EGP. Each refreshed quote required a second submission. The original order retained its 80 EGP delivery fee. [Price and shipping regressions](../../tests/b2bOrderCreation.test.ts)
- The checkout UI test verifies a visible revised total and confirmation button, preserved email and street address, and a single order request until the customer submits again. A returning customer's authenticated retry recovers the original order when it supplies the original cart ID and operation key. The same key can independently place an order for a second cart with its own quote. [Checkout UI test](../../tests/b2bOrderCreation.test.ts) · [Customer and session tests](../../tests/customerAccounts.test.ts)
- Against disposable PostgreSQL 16.16, a local production HTTP smoke test received 400 for a missing confirmation and 409 for stale pricing. Explicit resubmission returned 201 for one unpaid COD order. An authorized customer opened its detail page, anonymous access was denied, and replay returned the same order with HTTP 200.

`npm run migrate:up`, `npx tsc --noEmit`, `npm test` (519 tests across 41 files), and `npm run build` passed locally.

Merchant-approved coverage, fees, tax configuration and an owner-led staging checkout remain release gates. Inventory, coupons and online payment verification are tracked in their respective module plans.

## Definition of done

One real storefront purchase reaches a durable COD order and an authorized confirmation page in staging. Both normal and lost-response paths are covered by tests. Tax and delivery configuration used for launch are documented and approved for the deployment.

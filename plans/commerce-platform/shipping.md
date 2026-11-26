# Shipping and pickup

**Priority** P0 for the initial approved fulfillment option. P1 merchant-managed shipping zones and rates are required for the full commercial release.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Scope and baseline

- Launch with the simplest approved delivery or pickup option for the merchant. Support only the configured coverage and fees. Pickup may be enabled when the merchant provides approved terms and location.
- [CommerceSettings](../../src/modules/orders/globals/CommerceSettings.ts) holds the pilot approval and rates. The [quote service](../../src/modules/orders/services/checkoutQuote.ts) and [order service](../../src/modules/orders/services/orderService.ts) use the same [pilot fulfillment rules](../../src/modules/orders/services/checkoutFulfillment.ts). The order freezes the selected option and its approved terms.
- Depends on [Store configuration](store-configuration.md), [Products](products.md), [Checkout](checkout.md), [Orders](orders.md) and [Cash on delivery](cash-on-delivery.md). Follow the [execution plan](README.md).

## Implementation steps

1. Confirm launch coverage, stable region identifiers, active methods, actual fees, pickup location and terms, and which methods allow COD. Use test-only tariff fixtures when verifying code and merchant-approved configuration when enabling checkout.
2. Expose typed method options from the server with bilingual labels and amounts. Use stable region codes while normalizing accepted legacy labels deliberately. Return a clear no-service outcome for excluded destinations. A named fallback must be an explicit coverage rule.
3. Validate an address only for courier delivery, a selected pickup point for pickup, and neither shipment nor pickup for service-only orders. Resolve mixed-order shipping from physical lines. Keep the service intake path and the existing restrictions on COD for mixed and service-only orders.
4. Feed a single server-resolved shipping option into the shared quote and final order calculation. Snapshot method, region, charge, currency, approved configuration reference, and relevant delivery or pickup details. On price or availability drift, show the refreshed quote and require renewed confirmation before creating the order.
5. Add Payload admin configuration and validation for coverage and charges. Restrict edits to authorized roles, audit changes and keep provisional or missing rates unavailable on live checkout.
6. Add P1 merchant-defined zones, methods and rates via an additive migration. Let authorized staff create, edit and disable zones, link methods and set the rate for each method in Payload Admin. Resolve overlapping coverage deterministically or reject it. Map legacy governorate settings and preserve the original charge on old orders.
7. Add carrier quotes or tracking integrations when the merchant has a verified provider and the operation needs them. Retain a single checkout quote contract for fixed and provider-derived rates.

## Configuration boundary

- Store public pickup labels, address and instructions in the client deployment's configuration. Maintain delivery coverage and pricing with the shipping rules and audit history.
- Pass stable option identifiers through checkout. Resolve the current eligibility, amounts and customer-visible text on the server.
- Preserve order-time fulfillment details so operations can fulfill an older order after configuration changes.

In Payload Admin, a super admin can open **Settings → Commerce & Operations Settings → Pilot Delivery and Pickup**. Set `pilotFulfillment` only after confirming the relevant options with the merchant. Keep the configuration empty or use `status: "provisional"` during preparation. Physical checkout becomes available after a valid configuration is saved with `status: "owner_approved"`. Use a public approval reference and update it when recording a new approval. The legacy tariff schedule does not activate pilot checkout.

- Set `reference` to the public approval reference. In `delivery`, enter one row for each covered governorate with its exact `regionCode`, `amount` in EGP, and `codAllowed` set explicitly to `true` or `false`. Omit `delivery` or use an empty array for pickup-only operation. Deliveries outside the configured list are unavailable.
- To offer pickup, include one `pickup` object with a stable lowercase `id`, `amount` in EGP, `codAllowed`, and `label`, `address`, and `instructions` strings under `ar` and `en`. Set `amount` to `0` only if the merchant approves free pickup. Omit `pickup` or set it to `null` to disable pickup.
- [Supported governorate codes and accepted address labels](../../src/modules/orders/logic/fulfillmentRegions.ts) are shared by quote and order creation. Existing saved addresses can use a listed bilingual, Arabic, or English label. Coverage uses exact governorate matches after normalizing whitespace and Arabic alef variants.

## Verification

Use a disposable migrated PostgreSQL database and committed test-only configuration. Run from the repository root.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bCommerceSettingsAndPricing.test.ts tests/b2bOrderCreation.test.ts tests/pay01CodEngine.test.ts
npm test
```

| Acceptance fixture | Expected result |
|---|---|
| Approved fixed fee and eligible region | Quote and order use the same charge and preserve its configuration reference. |
| Unsupported region, provisional price or missing settings | Checkout identifies no approved eligible method and cannot create that shipment. |
| Pickup disabled, enabled with a fee, and enabled as free | Only configured options are available and the expected fee appears in the order. |
| Service-only and mixed orders | Service-only uses no shipping address or charge. Mixed orders calculate shipping from physical fulfillment. |
| Rate changed after quote | Order waits for a fresh customer confirmation and previously placed orders keep the frozen fee. |
| P1 two configured zones and an excluded destination | The merchant sets distinct charges through Payload Admin. Supported deliveries match the intended zone and rate. Excluded destinations cannot use the method. New rates apply to fresh quotes and prior orders keep their original fees. |
| P1 overlapping zones or methods with distinct COD rules | Admin prevents ambiguous rule definitions or the documented precedence deterministically selects the intended option. |

On staging, verify two configured destinations plus an excluded destination. Exercise pickup if enabled and check the merchant's order history and COD eligibility after a rate change.

### Local P0 evidence, 2026-11-26

The [synthetic fulfillment fixture](../../tests/fixtures/pilotFulfillment.ts) was exercised against a disposable PostgreSQL 16.16 database. The [checkout route tests](../../tests/b2bOrderCreation.test.ts) confirmed the following.

- Cairo (`EG-C`), 1 Fixture Street, Nasr City. The server quoted 80 EGP delivery and persisted an unpaid COD order for 2,080 EGP with the same 80 EGP fee and fixture reference `test-fixture-v1`.
- Aswan (`EG-ASN`), 2 Fixture Street, Aswan. The quote declined the destination. Direct order submission returned HTTP 422. Reusing the Cairo selection and confirmation for the Aswan address returned HTTP 409. Neither attempt created an order.
- Missing or provisional configuration leaves physical fulfillment unavailable. Pickup was exercised disabled, free and at 35.50 EGP. Changing its terms without changing the price required a fresh confirmation. Service-only checkout retained zero shipping, and the mixed-cart tests retained separate physical and service fulfillment.

`npm run migrate:up`, `npx tsc --noEmit`, the focused suite plus checkout SSR tests (52 tests), `npm test` (515 tests), and `npm run build` passed locally. The acceptance cases called the Next.js route handlers against PostgreSQL. A standalone HTTP smoke and staging verification remain pending.

Merchant activation still requires approved coverage and fees, the COD policy for each enabled option, and pickup terms and location if pickup is offered.

## Definition of done

- The merchant can approve and update delivery coverage and charges through appropriately scoped configuration.
- Storefront and checkout show only eligible choices, and the order retains the confirmed shipping details.
- The P0 pilot covers an approved fulfillment path. The full commercial release passes merchant-managed zone and rate tests. Carrier integrations follow merchant needs.

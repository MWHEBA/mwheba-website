# Coupons

**Priority** P1, required for the full commercial release after the COD pilot. Campaigns and availability are configured per merchant.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Scope and baseline

- Deliver one code per order initially, with fixed-amount or percentage discounts, validity dates, eligibility and explicit usage limits. Configure supported product or category restrictions according to merchant needs.
- The repository already has [cart calculations](../../src/modules/cart-checkout/services/cartCalculator.ts), a [quote service](../../src/modules/orders/services/checkoutQuote.ts) and an [order service](../../src/modules/orders/services/orderService.ts). These are the integration points for authoritative discounts and order totals.
- Depends on [Products](products.md), [Categories and tags](categories-and-tags.md), [Cart](cart.md), [Checkout](checkout.md), [Orders](orders.md), [Customers](customers.md) and [Store configuration](store-configuration.md). Follow the [execution plan](README.md) for release gates.

## Implementation steps

1. Confirm the merchant's v1 policy for eligible products, excluded fees and shipping, minimum eligible subtotal, validity boundaries, redemption limits, identity, tax treatment, and cancellation or refund handling. Define whether a cancelled order frees a usage slot and which authorized event does so.
2. Design a Payload admin collection for enabled status, a normalized unique code, discount type/value, currency for fixed-amount values, limits, dates and eligibility. Validate settings, restrict management to authorized roles, and expose a shopper-facing validation response with no unrelated campaign data.
3. Save the entered code as a cart proposal. Evaluate the promotion server-side with the authoritative catalog quantities and totals at every relevant quote. Recalculate on cart or delivery changes and explain expired or ineligible codes in checkout. Retain the existing pricing and rounding policy and cap the discount at its eligible amount.
4. Revalidate within the order transaction, applying the shared quote and existing money boundaries. Reserve or redeem once only when an order commits under the approved payment policy. Use database constraints and transactional locking for shared use limits, per-customer rules and replayed order creation.
5. Freeze the applied code or campaign reference, total discount and any eligible line allocations in the order snapshot. Use deterministic minor-unit allocation with the summed line discounts equal to the order discount. Later edits or expiry preserve the original order totals.
6. Coordinate online payment expiry, COD cancellation and refunds with Orders. Move a redemption into a release or reversal state only under the confirmed policy, with a unique audit event per transition. Ensure remittance and provider settlement use the discounted total stored on the order.
7. Expose localized state when a code is applied, removed, invalidated or changed after quote. Provide an admin view of campaign usage and order references.

## Administration and accounting

- Keep campaign settings and redemption data local to the store. Record who changes a coupon or reverses a redemption and when.
- Include the applied discount in the order change display, confirmation and finance view. Reuse frozen order totals for receipts and refund calculations.
- Confirm guest eligibility or an account requirement before exposing any per-customer offer.

## Verification

Use a disposable migrated PostgreSQL database and deterministic merchant, clock and currency fixtures. Run from the repository root.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bCartResilience.test.ts tests/b2bOrderCreation.test.ts tests/pay05FinancialLedger.test.ts
npm test
```

| Acceptance fixture | Expected result |
|---|---|
| Valid percentage and fixed amounts on differently priced eligible lines | Displayed discount matches the authoritative total. Allocations sum to the order discount and preserve a nonnegative total. |
| Disabled, expired, below-minimum, or excluded-product code | Quote shows the reason and places no redemption. |
| Cart change makes a previously valid code ineligible | Quote refreshes and order creation requires confirmation of the updated total. |
| Two orders compete for the final available use | Exactly one redemption commits. Retrying the winning order keeps the same order and usage count. |
| Merchant changes eligibility or deactivates a used code | Existing orders preserve their discount and settlement history. |
| Cancellation or refund of a discounted order | Usage and financial amounts follow the merchant's documented policy with one auditable status transition. |

Verify a checkout using a published product and coupon configured in Payload Admin on staging. Compare the discount in the storefront, order record and payment or collection record.

## Definition of done

- An authorized merchant can configure, disable and inspect v1 campaigns without code changes.
- Quotes, orders and settlement agree under expiry, concurrency, replay and rounding.
- Existing no-coupon checkout and COD or bank-transfer behavior continue to pass regression tests.

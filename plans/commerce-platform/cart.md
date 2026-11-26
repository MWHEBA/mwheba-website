# Cart

**Priority** P0. Implement after real catalog IDs are available and before the first checkout acceptance run.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

Shoppers can add, edit and remove published items through the storefront. The cart persists across reloads, gives accurate server-calculated totals and shows which lines need attention before checkout. Cart quantities remain advisory for inventory until the order transaction allocates stock.

## Current implementation

- `src/modules/catalog/ui/ProductDetailView.tsx` submits sample IDs, can show success before the mutation completes and sends a temporary artwork identifier.
- `src/modules/cart-checkout/context/CartContext.tsx`, `src/modules/cart-checkout/ui/CartDrawer.tsx` and `src/app/api/cart/items/route.ts` implement the existing storefront cart, signed guest session, item mutations and initial cart read.
- `src/modules/cart-checkout/services/cartStorage.ts` handles persistence and mutation idempotency. `cartCalculator.ts` hydrates live catalog data. `src/modules/cart-checkout/logic/moqEngine.ts` enforces quantity rules.

## Dependencies

Read the [implementation roadmap](README.md), [Products](products.md), [Inventory](inventory.md), [Checkout](checkout.md), [Customers](customers.md) and [Store configuration](store-configuration.md). Add the promotion preview only when [Coupons](coupons.md) is enabled for the deployment.

## Implementation

1. Connect the real product page to the existing cart provider and API. Pass the persisted product ID, selected variant ID, integer quantity, allowed customization fields and an operation key. Resolve product and variant records on the server, require publication and verify the variant belongs to the product. The server determines eligibility and amounts.
2. Reuse the existing cart record and session ownership checks. Review server actions and Payload cart endpoints for any parallel path that writes the same items, and route storefront mutations through the canonical service. Scope mutation replays to the cart, preserve operation keys across retries and prevent a completed cart from accepting new edits.
3. Use the existing quantity and customization services. Keep distinct variant, artwork and customization choices as separate lines. Bind actual private artwork to an authorized line through the existing upload path. Preserve D-009 aggregation per product across its variants and retain an incomplete cart with a readable warning.
4. Fetch availability for display. Show invalid or unavailable lines with a correction path and pass them to checkout revalidation. Use live server-calculated line prices and itemized fees in the cart. Keep cart operations free of stock allocations.
5. Await the API before confirming a mutation. Use the returned summary to refresh cart count, totals and notices. Handle pending, unavailable, failed and empty states. Retain the cart across route and locale changes.
6. Match the [Customers](customers.md) sign-in flow. For a shopper with both a guest and an account cart, use a server-side merge under the authenticated customer and rotate the guest context after success. Apply duplicate-line and operation rules consistently. Start a new cart after an order closes the old one.

## Verification

Use a disposable, migrated PostgreSQL database. Start with the existing tests below. Add regression cases for the real storefront entry points while implementing the module.

```bash
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bCartResilience.test.ts tests/b2bArtworkAssets.test.ts tests/commerceTemplates.test.tsx tests/moq.test.ts
```

| Acceptance case | Observable result |
| --- | --- |
| Published simple product and published variant added from their real product pages | Cart contains the persisted IDs, quantities and server totals. Success appears after the response. |
| Reload and sign in with a guest cart and an existing customer cart | Cart persists and the merge is deterministic. Replaying the merge leaves one correct set of lines. |
| Request with an invalid variant or artwork owned by a different session | Cart state stays intact and the UI displays a clear error. |
| Concurrent quantity edits and an operation retry | Final quantity follows the documented mutation semantics. Only the original operation changes the quantity. |
| Below-minimum B2B order or stock that changes after add | Cart allows correction. Checkout prevents order placement until the cart is valid. |
| Completed order then new purchase | The original cart is closed. A new cart accepts the next purchase. |

## Definition of done

The localized storefront uses real cart requests, persistent state and server totals, and guest, customer and B2B cases pass. Record one successful storefront-to-cart HTTP acceptance run. Use the owner’s authorized browser walkthrough for visual and interaction checks.

## Verification evidence | 2026-11-25

- Node.js `22.17.0` on Windows and disposable loopback PostgreSQL 16. Migrations and `npx tsc --noEmit` exited 0. The four focused Vitest suites passed 82 tests. `npm test` passed 507 tests across 40 files on a separate freshly migrated database. `npm run build` exited 0 and generated 49 static pages.
- The production build served `GET /en/store/cart-smoke-simple-8df8e8ec`, `GET /en/store/cart-smoke-configurable-8df8e8ec` and `GET /ar/store/cart-smoke-configurable-8df8e8ec` with HTTP 200. The product IDs were 18 and 19 and the selected variant ID was 10 in the temporary fixture database. `POST /api/cart/items` added both, rejected an unrelated variant with HTTP 422, and `GET /api/cart/items?locale=ar` kept the guest cart ID and EGP 2,450 total.
- After `POST /api/users/login`, `GET /api/cart/items` merged into the existing account cart, cleared the guest cookie and retired guest access. Replaying the guest add kept the quantity unchanged. `PATCH`, `DELETE` and another `GET /api/cart/items` left 11 units and EGP 2,200. `POST /api/checkout/quote` accepted the authenticated session alone and returned the same EGP 2,200 total with free pickup.
- The React regression exercised both actual Add buttons and their persisted Payload IDs. The HTTP run used a temporary loopback listener for the production build. The owner’s browser walkthrough remains a separate visual check.

# Products and variants

**Priority** P0. **Depends on** [store configuration](store-configuration.md) and the [taxonomy contract](categories-and-tags.md). **Consumers** [inventory](inventory.md), [cart](cart.md), [checkout](checkout.md), and [orders](orders.md).

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

A catalog manager can create, price, publish, and archive a simple product or a product with variants in Payload Admin. The localized storefront reads the published catalog and sends the selected product and variant IDs to the existing cart. Existing fixed-price service packages and corporate customization remain available where a merchant enables them.

## Start here

Follow the [delivery plan](README.md) for the shared test environment and release order.

- `src/modules/catalog/collections/Products.ts` extends the configured Payload Ecommerce products collection and currently enforces a minimum of 10 for physical merchandise.
- `src/payload.config.ts` registers the Ecommerce plugin, variant support, and collection overrides. Inspect the pinned package's actual collection shape before changing overrides.
- `src/app/(frontend)/[locale]/store/page.tsx`, `src/app/(frontend)/[locale]/store/[slug]/page.tsx`, and `src/modules/catalog/ui/` are the storefront entry points. Listing and detail currently use `sampleProducts.ts`. The details UI also constructs placeholder artwork IDs.
- `src/modules/cart-checkout/services/cartStorage.ts` and `src/modules/orders/logic/orderSnapshotEngine.ts` consume actual catalog IDs and order-time product data.

## Data and behavior

- Each sellable catalog item has a stable SKU. A simple product owns its SKU. A variable product has a SKU for each sellable combination of options. Keep SKUs unique across sellable records in the same deployment. All stock units of the same record share its SKU.
- Preserve stable existing product IDs and slugs, and preserve prior order snapshots. Resolve public display fields by locale using the storefront's agreed fallback. Return a clear unavailable state for archived, draft, or invalid selections.
- The catalog supplies price, type, fulfillment rules, applicable MOQ, and eligible customization. The server selects the price for the actual SKU using the existing amount conventions. Read live inventory availability from the inventory module. Hide operational fields from public responses.
- Existing MWHEBA B2B products retain their configured MOQ of at least 10. Deliver quantity-one retail products through a documented per-product MOQ policy and migration that preserves D-009 for those B2B products. MOQ groups variants of one product ID. Inventory checks the specific SKU. Fixed-price service packages retain their current service validation.

## Implementation

1. Create deterministic fixtures for one simple physical product, one two-variant product, one B2B product, and one fixed-price service. Set both localized names, valid media, positive fixture prices, and the actual variant types and options. Keep fixtures isolated from merchant production imports.
2. Map required catalog fields to the existing Payload collections. Resolve the existing `basePrice` / plugin price field contract with [checkout](checkout.md). Reuse the existing order snapshot reader and domain IDs. If adding SKU uniqueness, report duplicates before creating constraints. If enabling retail rules or localizing existing fields, generate an additive migration and preserve the old values and behavior for existing records.
3. Build a server catalog read path for published products, pagination, filters, and one product by slug. Use the same public view model for detail, metadata, and add-to-cart. Validate locale and use a bounded read and cache policy. Invalidate catalog data when publish status, price, or the public product presentation changes. Recheck prices and availability at checkout.
4. Replace sample reads in the live routes and report add-to-cart success after the server accepts the selected product and variant IDs. Link to the same product title and SKU in the cart. For enabled customization, connect the existing line-bound upload workflow and store the actual returned asset ID. Prevent fake placeholders from entering carts or orders.
5. Confirm an authorized catalog manager can manage records and variants in Payload Admin. Confirm changes reflect the correct merchant only and that renamed slugs retain the agreed redirect where applicable.

## Test and acceptance

Run the existing regression suites on a disposable, migrated database. Add integration coverage for the new fixtures.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bProductCatalog.test.ts tests/commerceTemplates.test.tsx tests/moq.test.ts tests/b2bArtworkAssets.test.ts
```

| Fixture | Pass condition |
| --- | --- |
| Published product, draft, and archived product | Public listing and detail return only published purchasable records. Archived or draft IDs are rejected at the transaction boundary. |
| Simple product and two variants with distinct prices | Select each option combination and add it to the real cart. The persisted line has its real IDs, SKU, and server amount. Invalid or cross-product variant selections fail without altering the cart. |
| B2B variants and quantity-one retail mode | Five units of each of two variants meet the ten-unit MOQ for the same B2B product. Checkout rejects a cart with five units of each of two unrelated ten-unit B2B products. A retail product with MOQ 1 can be bought in a quantity of one. |
| Existing service and a customized product | Service purchase keeps the existing type and amount. An eligible customized product saves the uploaded asset to the intended line and itemizes the server-calculated fee. |
| Product edited after purchase | Existing order and confirmation keep their original SKU, title, quantity, and charged amount. A later cart quote uses the current allowed price. |

Stage the normal storefront and cart HTTP entry points with fixture records. Capture one successful product-detail-to-cart result using real Payload IDs. Include both storefront locales in the acceptance evidence.

## Definition of done

The listing and detail routes use the actual published catalog, including metadata. Catalog changes pass the agreed cache behavior, the add-to-cart outcome reflects the server response, and migrations, legacy orders, and the B2B rules have regression coverage. Record any approved changes to SKU, pricing, or MOQ semantics with the relevant migration.

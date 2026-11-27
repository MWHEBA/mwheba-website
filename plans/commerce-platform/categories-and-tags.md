# Categories and product tags

**Priority** P0. **Depends on** [store configuration](store-configuration.md). **Consumer** [products and variants](products.md).

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

A catalog manager can organize and tag products in Payload Admin. Customers can navigate and filter the published storefront by stable taxonomy links. Each client deployment owns its taxonomy and storefront labels.

## Start here

Follow the [delivery plan](README.md) for the shared test environment and release order.

- `src/modules/catalog/collections/Categories.ts` contains the existing flat collection and its access policy.
- `src/modules/catalog/collections/Products.ts` has a single indexed `category` relationship. Product tags have no collection or relationship today.
- `src/app/(frontend)/[locale]/store/page.tsx` and `src/modules/catalog/ui/ProductListingGrid.tsx` are the public integration points.
- Review `src/scripts/seed.ts` for existing references and `src/app/sitemap.ts`, `src/proxy.ts`, and the redirect map for public URL behavior.

## Data and behavior

- Reuse the `categories` collection and keep existing category IDs and slugs. Add product tags as a distinct store-level taxonomy. Stable category and tag identifiers support predictable links and imports. Reuse existing locale behavior and store-level permissions.
- Decide the category cardinality and whether hierarchy is needed from the merchant's actual WooCommerce export or onboarding catalog. When adopting multiple categories, backfill the existing single relationship and keep old readers supported until all callers have changed. Where hierarchy is in scope, restrict parent selection to valid records and reject cycles.
- Filter only published products. Keep taxonomy landing routes or query parameters consistent in Arabic and English. Use validated filters, bounded pagination, deterministic sorting, and the catalog module's public visibility rules.
- Give deletion a predictable workflow. Use archive or deactivate for referenced categories and tags and hide them from storefront filters, or require reassignment before permanent deletion. Keep product publication a separate decision.

## Implementation

1. Inventory existing category records and catalog references, and map WooCommerce category and tag IDs if applicable. Pick which category links will be addressable and define the canonical filter URL behavior before creating public routes. Publish an explicit migration map when a slug moves.
2. Add the product tag collection and product relationship with stable slugs, edited labels, and catalog-manager access. Add localization and category hierarchy only to the approved depth and migrate existing values. Retain the current category path until migration verification succeeds.
3. Expose the taxonomy and product filters through the same published catalog query used by [products](products.md). Specify how combinations of category and tag filters are interpreted. Keep invalid filters safe and intentional, keep results bounded, and preserve filters during pagination and language switching where an equivalent route exists.
4. Add merchant admin editing and storefront labels, including loading and empty states. Confirm that archiving an attached tag or category preserves the intended published state of the assigned product.
5. Define handling for taxonomy listing SEO. Keep stable equivalent URLs via redirects, and prevent arbitrary combinations of filters from becoming indexable landing pages. Test sitemap entries only for pages chosen for indexing.

## Test and acceptance

Use a disposable, migrated database and extend the existing catalog and access regressions with the new fixtures.

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/b2bProductCatalog.test.ts tests/rbac.test.ts tests/mig03RedirectMatrix.test.ts
```

| Fixture | Pass condition |
| --- | --- |
| Legacy product with a single category | Migration preserves the category relationship and storefront visibility. Re-running an import with the same source identity does not duplicate it. |
| Reused category or tag slug and invalid relationship | Duplicate slugs are rejected within the taxonomy. If parent links are enabled, self-parenting, ancestor cycles, and nonexistent parent IDs fail validation. |
| Published product, draft product, and archived taxonomy | Filters return only matching published products. Archived terms are removed from public navigation, and the product still follows its own published status. |
| Customer and authorized catalog manager | Customer can read allowed public labels without writes. Catalog manager can edit permitted taxonomy records and product assignments. |
| Multiple localized product results and invalid filter | Combined filters, pagination, and bilingual labels are consistent. Unknown filters use the documented empty or validation behavior without broadening results silently. |
| Renamed public slug with an agreed redirect | The legacy route resolves to the intended canonical URL, which loads without leaking draft records. Internal links point directly to the canonical URL. |

Stage category and tag edits through Payload Admin and verify the public route or filter response for each changed term. Inspect the paginated result count and known fixture SKUs.

## Definition of done

A product can be assigned, filtered, and found deterministically in the public storefront. Existing category data and approved URLs survive the migration. Authorization, publication visibility, localized routes, and repeatable imports have regression coverage.

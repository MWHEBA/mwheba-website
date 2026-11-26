# Reusable commerce platform implementation plan

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Project copy and deployment model

Maintain a reusable template repository with tested versions. For each client, copy an approved version into a new independent repository using the Git hosting template flow or an equivalent clean copy. Record the source template version. Each client repository has its own code, customization, release schedule and deployment. Each deployment gets its own domain, Payload Admin, PostgreSQL database and credentials, upload boundaries, backups and secrets. Use Payload settings for routine merchant edits and the client repository for custom code. Apply future template fixes through a reviewed update in each client repository.

This is the delivery plan for future work. The [previous execution ledger](../MASTER_PLAN.md) and [decision register](../../docs/specs/DECISIONS.md) describe the existing MWHEBA scope. The running code uses Payload Ecommerce with custom product, cart and order behavior. The current storefront uses sample products, inventory is disabled, and customer self-service is incomplete. The first milestone is a COD pilot for one merchant. The full commercial release requires every P0 and P1 module and verifies documented onboarding on the first client copy. [Payload configuration](../../src/payload.config.ts) · [Sample products](../../src/modules/catalog/data/sampleProducts.ts)

## Module guides

P0 is the first implementation priority and establishes the COD pilot. P1 follows the pilot and is required for the full commercial release. Each merchant configures which implemented capabilities to enable and which credentials, coverage and merchant rules apply.

| Priority | Module | Main dependency or outcome |
| --- | --- | --- |
| P0 | [Store configuration and onboarding](store-configuration.md) | Merchant profile, branding, localization, operational settings and repeatable deployment |
| P0 | [Products](products.md) | Published Payload product and variant identities, current prices and media |
| P0 | [Categories and tags](categories-and-tags.md) | Merchant-managed taxonomy, filterable storefront and stable URLs |
| P0 | [Inventory](inventory.md) | Stock per sellable SKU, accounted once within the order transaction |
| P0 | [Cart](cart.md) | Persistent cart using real product and variant records |
| P0 | [Checkout](checkout.md) | Canonical server quote, validation, customer session and confirmation |
| P0 | [Orders](orders.md) | Order placement, frozen totals, state transitions, fulfillment and ownership |
| P0 | [Customers](customers.md) | Registration, returning-customer sign-in, recovery, addresses and order history |
| P0 | [Cash on delivery](cash-on-delivery.md) | Rule-based eligibility, collection, refusal, return and remittance |
| P0 baseline, P1 completion | [Shipping](shipping.md) | Approved delivery or pickup for the pilot. Merchant-managed shipping zones, methods and rates for the commercial release. |
| P1 | [Online payments](online-payments.md) | Provider sandbox, reconciliation and merchant-specific activation |
| P1 | [Coupons](coupons.md) | Server-evaluated discount rules, usage limits and audit history |

## Delivery sequence

### 0. Confirm scope and capture the baseline

- Inventory is in P0 under the current request. Record the change from D-018 in the decision register before applying a schema migration. Record retail quantity rules as an extension of D-009. Support configurable product-level MOQ, including quantity one for retail products, and preserve existing MWHEBA B2B product rules.
- Confirm the pilot merchant’s offer, supported languages, currency, delivery or pickup coverage, tax settings, COD rules, return policy and order-notification channel. Use approved values. Start from the application's EGP and Arabic/English support so additional currency and locale support can be validated independently.
- Audit the real WooCommerce data and active extensions where a merchant is migrating. Identify source-of-truth fields, SKU conflicts, variations, categories, tags, prices, stock, customer and address records, open orders, historical data needs and redirects.
- Record baseline results for migrations, seed, build, tests and an HTTP storefront smoke test. Prior local review found that the default seed can fail on missing variant options and the post-build CSS tests expect a manifest absent from the Turbopack output. Confirm both on the working revision and repair the relevant provisioning or test tooling before relying on a release gate. [Seed](../../src/scripts/seed.ts) · [Post-build tests](../../tests/bilingualLayout.postbuild.test.ts)

### 1. Prepare the template and provision the first client copy

- Implement the merchant settings contract. Prepare a clean template with base code, migrations and neutral fixtures. Backfill MWHEBA branding and content in its own project. Copy the reviewed template version into the first client's repository and bootstrap its owner, approved settings and catalog there.
- Keep all deployment credentials and signed media and session secrets in deployment configuration. Set per-deployment public origins, private roots, credentials and backup destinations. Verify required production configuration before accepting traffic.
- Use synthetic merchant profile fixtures with distinct names, logos, origins, contacts and checkout settings to test branding, indexable URLs and configuration isolation in automated tests.

### 2. Wire the catalog, cart and customer context

- Build the real shop and product pages and make product, variant, price and publication identities available consistently from the server. Add categories, tags and filters. Correct the seed or replace it with deterministic test fixtures through the normal product and variant model.
- Connect the storefront to the existing cart and preserve guest and returning-customer flows. Implement add, edit, remove, reload and authenticated cart merge. The cart shows stock and quantity guidance and carries no inventory allocation.
- Complete registration, sign-in, reset and session establishment. Connect customer order history and owned order detail after order placement is available.

### 3. Close the purchase, inventory and COD loop

- Implement the initial delivery or pickup method with merchant-approved pricing and coverage. Use a single server quote for the checkout display and order commit. Revalidate prices, delivery eligibility, quantities and stock when the buyer confirms.
- Implement inventory allocation with order creation and cart finalization in a single PostgreSQL transaction. Finalize once per saved order. Release each eligible quantity once after pre-dispatch cancellation or receipt and approval of a sellable return. Keep order lines, amounts and chosen delivery details frozen.
- Place and fulfill real COD orders using approved merchant and actor rules. Keep payment and fulfillment separate. Record collection against the expected amount. Exercise pickup or delivery, refusal, eligible restock, and courier remittance where applicable.
- Connect brand-specific confirmation and operational notifications to an approved delivery channel. Queue retries and expose pending or failed confirmations to the merchant. A notification retry must preserve the original order and stock effects.

### 4. Verify the first COD pilot

- Use an isolated staging application with its own approved configuration, test database, storage and recipient addresses. Verify the storefront and Payload Admin flow in Arabic and English where enabled. Use local HTTP checks and record an owner-led browser walkthrough under the repository's browser rule. Obtain separate approval before a pilot serves real buyers.
- Place a COD order through the storefront using the approved delivery or pickup method. Verify in Payload Admin that the order matches the accepted checkout quote and inventory is allocated once. Cancel a separate order before dispatch and verify eligible stock is restored once.
- Fulfill the test order and verify it remains unpaid until the merchant explicitly records the collection. Reconcile the collected amount with the order total and verify the collection reference, courier remittance where applicable and the buyer confirmation.
- Assign an owner for order placement failures, stock adjustments, notification failures and unmatched cash collections. Hand over provisioning inputs, supported merchant options, backup and restore instructions, incident contacts, update procedure and admin tasks. Routine brand and catalog updates use Payload Admin. Client-specific code changes, releases and maintenance live in that client's repository. Record the template starting version and client customizations for handover.

#### Local dev verification (2026-11-26)

The owner approved using the current dev code for this run. The Next.js production build served loopback HTTP against a freshly migrated, disposable PostgreSQL 16.8 database and separate private storage. The buyer, staff, courier, SKU and prices were synthetic. The run sent zero notifications and moved no money.

- Checkout returned `201` for order `MWH-2026-10001` (ID `1`). The accepted quote and the order returned by authorized Payload REST both showed EGP 879.50 (87,950 piastres), including EGP 799.50 merchandise and EGP 80.00 delivery. A modified total returned `409 PRICE_QUOTE_MISMATCH` before stock changed. Retrying the accepted request returned `200` with the same order ID and no extra allocation. After the retry, the original buyer session still showed the order number in Arabic and English over HTTP. The order API returned `403` for anonymous access and `404` for a different customer.
- Order `1` stayed `unpaid` through dispatch and delivery. Operations recorded one simulated EGP 879.50 cash collection (ID `1`, receipt `PILOT-RECEIPT-2105ccba-8648-408d-9ba3-105fa7e45942`). The order became `paid` with `collected_by_courier`. Retrying returned `ALREADY_COLLECTED` with the same collection ID. The fixture had courier remittance disabled.
- Two carts attempted to buy the final 10 units. Only order `MWH-2026-10002` (ID `2`) succeeded. The other confirmation returned `409 INSUFFICIENT_STOCK`. Operations cancelled order `2` before dispatch. It stayed `unpaid`, and the retry recorded no extra release. Stock for `PILOT-2105ccba-8648-408d-9ba3-105fa7e45942` moved `20 → 10 → 0 → 10`. Movement IDs `1` through `4` recorded opening stock of `+20`, two allocations of `−10`, and one cancellation release of `+10`.

The production build and `npx tsc --noEmit` passed. `npm test` passed all 532 tests across 43 files in a separate disposable database. Staging verification and the owner-led browser walkthrough remain pending.

### Commerce Phase 2

The remaining commerce work proceeds in this order.

11. [مناطق وطرق وأسعار الشحن](shipping.md)
12. [الدفع الإلكتروني](online-payments.md)
13. [الكوبونات](coupons.md)
14. القبول النهائي والتسليم. Complete [commercial release verification and handoff](#6-verify-the-full-commercial-release-and-cut-over) against the [release acceptance criteria](#release-acceptance).

Schedule future improvements after final acceptance and handoff.

### 5. Complete the three required P1 capabilities

- Ship merchant-managed shipping zones, methods and rates. Prove two zones with distinct charges and an excluded destination. Treat carrier integrations as later extensions when needed.
- Ship at least one verified online payment gateway through the adapter boundary. Verify provider support against pinned dependencies and official documentation, then prove sandbox initiation, payment confirmation, failure and reconciliation. Require per-merchant setup and approval before accepting live payments. COD remains available under its own rules.
- Ship merchant-managed coupons after stable pricing and order snapshots. Support fixed and percentage discounts, validity, eligibility and limits. Verify the last permitted redemption under concurrency.

### 6. Verify the full commercial release and cut over

- Run the entire acceptance matrix after P1 on the first client's isolated staging storefront. Place an online order with a zone-resolved rate and a managed coupon. Confirm that the accepted quote, frozen order, single stock allocation and provider settlement agree. Use the same staging storefront to verify a COD order with online payments, P1 shipping zones and coupons disabled and an approved P0 delivery or pickup option enabled.
- Tag the verified template. For an approved WooCommerce cutover, take the final backup and delta, reconcile orders and stock, and let one system accept new orders. Verify the merchant's enabled methods and retain an audit trail and reconciled rollback procedure.
- Mark the product ready to sell only when all P0 and P1 modules and the onboarding, data isolation and recovery gates pass. Record feature evidence and any per-merchant activation steps in the handover.

## Common verification

Use a disposable PostgreSQL database, per-run test secrets and private storage. From the repository root, install pinned dependencies, create any test storage directories and apply pending migrations before running database-backed tests. Use the default repository-relative `private-uploads` directory for the current path-sensitive tests. Do not point test or seed commands at a merchant database.

```sh
npm ci
npm run migrate:up
npm run typecheck
npm test
npm run build
npm run test:postbuild
```

Match the CI environment and document any platform-specific command or build-artifact difference with evidence. Each module guide names a focused regression suite. Add acceptance cases against the normal storefront, API and admin entry points when the listed behavior lacks coverage. Do not count a domain-service test alone as a successful storefront checkout.

## Release acceptance

The COD pilot exercises the P0 shopping and merchant-operations rows on one deployment. The full commercial release exercises every row and the module-specific criteria in the linked guides.

| Scenario | Required evidence |
| --- | --- |
| P0 Products and taxonomy | A catalog manager publishes a simple product and a product with variants, then assigns categories and tags. Storefront filters find the expected products and the selected SKU reaches the order. |
| P0 Cart, checkout and customer account | Cart persists across reload, edits and eligible sign-in. A returning customer can recover access, select an owned address and see only their own orders. The server quote matches the saved order. |
| P0 COD purchase | Customer receives confirmation and can access only its own order. Payload Admin shows the same items, total, delivery method and state. |
| P0 Inventory and last eligible purchase quantity | Two concurrent confirmations for the last eligible quantity produce one order and one stock allocation. Use a single unit for an approved retail SKU or one minimum order quantity for a B2B product. |
| P0 Retries, cancellation and eligible returns | Repeated requests do not duplicate orders, stock adjustments or collections. An eligible cancellation or return releases inventory once. |
| P0 Order fulfillment and collection | Dispatch and delivery preserve the recorded payment state. Confirmed cash collection and any required remittance reconcile to the saved order. |
| P0 Merchant operations | The owner can edit the profile, publish products, manage stock, process orders and see failures without code or database work. |
| Commercial onboarding and deployment isolation | Provision the first client in its own repository and staging deployment from a recorded template version. Verify the deployment uses its own branding, public origin, database, credentials, private storage and backup destination. Verify access boundaries for orders, sessions and signed media. |
| Migration and recovery | Reconcile import results and balances when migrating. Staging backup and restore can recover database and files for the intended merchant. |
| P1 Configurable shipping zones and rates | A merchant configures two zones with distinct charges and verifies an excluded destination. A rate edit affects fresh quotes and preserves prior orders. |
| P1 Coupons | An authorized merchant creates fixed and percentage codes. Eligibility, dates and usage limits are enforced in checkout, and the saved discount matches the quote. |
| P1 Online payments and combined checkout | A supported gateway charges the quote with the configured zone rate and eligible coupon. The order saves the same values, stock allocates once, and verified settlement reconciles with the provider. Disabled configurations continue to pass COD. |

For each implementation task, give the AI this plan, the relevant module guides and the exact slice to deliver. Require a short report listing behavior shipped, migrations, commands run, achieved acceptance cases and unresolved dependencies. Start the next slice after its prerequisites are verified.

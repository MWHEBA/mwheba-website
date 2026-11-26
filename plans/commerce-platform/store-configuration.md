# Store configuration and client onboarding

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Scope and dependencies

This P0 module packages the template and documents how each new client gets an independent repository and deployment. The merchant can update normal store details from Payload Admin. Follow the [delivery plan](README.md), and consume the checkout settings contracts from [shipping](shipping.md), [cash on delivery](cash-on-delivery.md) and [online payments](online-payments.md) as each capability ships.

Some MWHEBA settings already exist in `CommerceSettings`, `InquirySettings` and the environment. Layout branding, contact channels, SEO and seeded users also have hardcoded values. Audit route-specific marketing content, sample data and redirects as well as the obvious logo and name. [Commerce settings](../../src/modules/orders/globals/CommerceSettings.ts) · [Inquiry settings](../../src/modules/content/globals/InquirySettings.ts) · [Header](../../src/shared/ui/layout/Header.tsx) · [Footer](../../src/shared/ui/layout/Footer.tsx) · [SEO](../../src/shared/lib/seo.ts) · [Schema](../../src/shared/lib/schemaGenerator.ts) · [Seed](../../src/scripts/seed.ts)

## Configuration boundaries

| Owner | Data | Storage and access |
| --- | --- | --- |
| Merchant administrator | Localized display and organization names, logos and favicon, brand tokens, contact information and social links, supported locales, return and privacy pages, navigation and configurable storefront content | Payload globals, media and content collections. Validated writes limited by role. Expose a safe public projection. |
| Merchant operations and finance | Supported sales modes, approved currency and pricing settings, delivery or pickup, COD availability, finance and notification routing, approved customer-visible payment information and feature options | Reuse domain settings, with role-specific access. Order-affecting changes apply to fresh quotes and preserve historical order snapshots. |
| Deployment operator | Trusted public origin, runtime database identity, upload and backup locations, signing secrets, email transport credentials and per-merchant payment-provider secrets | Deployment configuration. Keep private values out of public environment variables, storefront data, CMS exports and logs. |

Keep one authoritative source per setting. Use the approved deployment origin for canonical links and server-generated callbacks. If both a merchant-facing domain field and the deployment origin are needed, validate their relationship at activation. Never use a request-provided host as the authority for email, checkout and provider callback URLs.

## Implementation sequence

1. Inventory merchant-specific hardcoding. Search for MWHEBA names, logos, addresses, phone and WhatsApp links, mail recipients, SEO titles, JSON-LD, defaults and redirect destinations. Include homepage and service copy, emails, favicon, policy links, store placeholders and demo accounts.
2. Add a typed merchant-profile Payload Global for public identity and presentation. Reuse current Navigation, InquirySettings and CommerceSettings for domain-owned fields. Define owner and finance permissions and a public read projection. Add an additive migration and backfill MWHEBA values only for its deployment.
3. Read the profile through one server accessor. Reuse it across public layout, metadata, sitemap, structured data, storefront labels and notifications. Use validated brand tokens through existing CSS variables. Keep layouts shared. Use cache boundaries safe for the current deployment and invalidate changed content by its documented mode.
4. Move production requirements into deployment configuration checks. Verify explicit database URL, signing secrets, trusted public origin and private storage. Use a separate credential set and storage root for each deployment. Keep payment, coupon and shipping options unavailable until the merchant supplies their required configuration. Require an approved delivery or pickup option and COD configuration for the pilot.
5. Define a repeatable template copy procedure. Create a new independent repository from a reviewed template version and record its source version. Supply deployment-specific configuration, apply migrations and run a safe bootstrap for the authorized owner, approved merchant profile and catalog. Keep client data, live credentials and test accounts outside the copied template. Record settings outstanding for activation.
6. Document operator inputs, the independent release procedure for each client repository, and how to apply selected template fixes in a reviewed client update. Document migration, backup and restore for one client's database and private files. Verify setup on the target host using the first client's isolated staging deployment. Use a preview or maintenance state until setup validates.
7. Require real notification transport for flows that depend on delivery, including password recovery. Wire per-deployment transport and run staging confirmation and retry checks with test recipients. Preserve pending and failed work for operations follow-up. [Operations manual](../../docs/ops/OPERATIONS_MANUAL.md)

## How to verify

Run from the repository root using the disposable database and test storage described in the [delivery plan](README.md).

```sh
npm run typecheck
npx vitest run --fileParallelism=false tests/foundation.test.ts tests/rbac.test.ts tests/cmsSeoAndSitemaps.test.ts tests/mig04TechnicalSeo.test.ts tests/marketingLayout.test.tsx tests/emailTemplates.test.ts
npm run build
npm run test:postbuild
```

Add automated coverage and a repeatable HTTP or owner-led acceptance check for the following cases.

| Acceptance case | Expected result |
| --- | --- |
| Provision the first client copy from a reviewed template version | Its independent repository records the template version. Its staging deployment uses the intended profile, site origin, staff, catalog and settings. Re-running bootstrap preserves existing merchant data and owner identity. |
| Change merchant profile | Payload edits appear in the header, footer, contact details, metadata and messages. |
| Switch enabled locale | The public pages expose supported localized names, metadata and directions, with predictable fallback for optional values. |
| Missing required production configuration | Startup or launch validation fails clearly. Public responses, logs and exports expose no secrets. |
| Deployment isolation | The staging deployment uses its own database, credentials, private storage and backup destination. Use synthetic fixtures to verify it rejects sessions and signed asset links created with a different signing configuration, and order references outside its data. |
| Resume or restore one client | Snapshot and files restore consistently in its approved staging target. |
| Existing MWHEBA profile | Upgrading maintains approved MWHEBA branding, content and storefront URLs. A bootstrap test with a synthetic merchant profile verifies that a new brand exposes its own data and does not inherit demo accounts. |

## Definition of done

- An authorized owner can provision, brand and operate a storefront using documented inputs and Payload settings.
- The first client copy runs in its own isolated staging deployment. Its owner can update the merchant profile and run a test order.
- The operator can reproduce setup, verify database and file backup/restore, and activate only the client's approved features.
- Existing MWHEBA data has a reviewed migration path. Required production fields and test coverage are documented in the implementation handoff.

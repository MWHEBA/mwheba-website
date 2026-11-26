# Customers

**Priority** P0. Deliver the buyer identity and account experience with Checkout.

## Shared objective

Build a reusable storefront template on Next.js, Payload CMS and PostgreSQL that merchants can operate from Payload Admin. Copy the template into a separate repository for each client and deploy that copy with its own business data, storage and secrets. Deliver a reliable cash-on-delivery purchase flow first. The full commercial release also includes online payments, configurable shipping zones and rates, and coupons.

## Outcome

New shoppers register during checkout and can follow their orders afterward. Returning customers can sign in, recover access, manage their own profile and saved addresses, and see their own orders. Merchant staff administer customers through scoped Payload roles.

## Current implementation

- `src/modules/identity/collections/Users.ts` provides Payload Auth, customer and staff roles, company and tax fields, and access rules. `src/modules/identity/access/roles.ts` contains shared role checks.
- `src/modules/orders/services/orderService.ts` can create a customer during checkout. A matching existing account requires authentication. The checkout API returns the order, and a newly registered shopper still needs a storefront sign-in.
- `src/app/(frontend)/[locale]/account/orders/[id]/page.tsx` checks the order owner but links to a missing account landing page. The order brief page has an inline sign-in path. Check the installed Payload Auth endpoints and usage before connecting the customer UI.

## Dependencies

Read the [implementation roadmap](README.md), [Cart](cart.md), [Checkout](checkout.md), [Orders](orders.md) and [Store configuration](store-configuration.md). Work with the existing Users collection and auth configuration so merchant releases retain one identity model per deployment.

## Implementation

1. Implement localized account home, sign-in, sign-out, password recovery, profile and paginated order history. Use the pinned Payload Auth APIs and verify session cookies in the Next.js route flow. Keep account and reset navigation within the current store and preserve a validated return destination.
2. Keep D-013 inline registration for approved checkout flows. Normalize emails consistently and preserve database uniqueness. Authenticate before associating an order with an existing email. After a new account and order commit, establish the customer session through the approved server flow or route immediately into sign-in with order recovery. Keep passwords and tokens out of logs, analytics and order snapshots.
3. Coordinate the cart handoff with the [Cart](cart.md) guide. Preserve the original checkout information during sign-in and merge eligible guest lines once. Verify that a lost response still lets the confirmed customer log in and find their committed order.
4. Read customer identity from the authenticated request. Scope profile, address, order, brief and artwork access to the owner and retain explicit staff permissions. Verify the same rules through the storefront and Payload APIs. Allow only authorized administrators to grant staff roles. Provide owner-scoped address create, read, update and delete plus default selection. Make owned saved addresses selectable at checkout and preserve the confirmed address snapshot on existing orders.
5. Connect password recovery and required account or order messages to the current deployment’s configured transactional transport. Keep recovery responses generic, expire tokens and enforce one-time use using verified Payload behavior. Require real delivery verification before operational handover.
6. Provide a WooCommerce migration mapping by legacy customer ID and normalized email. Define duplicate and missing email handling before import. Use a verified activation or reset flow for migrated accounts. Keep staff accounts and credentials deployment-specific. Verify migrated order history ownership before enabling customer access.

## WooCommerce migration mapping

| WooCommerce record | Target and reconciliation rule |
| --- | --- |
| Registered customer with a stable customer ID and a verified, unique email | Store a durable mapping from source store and legacy customer ID to Payload `users.id`. Use the trimmed, lowercased email to check identity and uniqueness. Reruns reuse the recorded mapping. Resolve a collision with an existing Payload customer through verified identity and manual approval before linking either record. |
| Missing, invalid, unverified, or duplicate email | Quarantine the customer and dependent orders for review. Record the reason and legacy IDs. Resolve with a verified customer address or an explicit guest decision before assigning customer access. |
| Guest or unassigned order | Preserve guest classification and the original order snapshot. A matching billing email alone cannot establish ownership. |
| Registered order and saved address | Link through the approved legacy customer ID map. Preserve the original shipping address on the order and import approved address-book entries independently. Reconcile the order counts and amounts per mapped customer, then test positive and negative customer access before making imported history visible. |
| Passwords, reset tokens and staff accounts | Activate buyers with the storefront’s expiring reset flow through the destination deployment’s configured mail transport. Provision staff separately with approved roles and deployment-specific credentials. |

Rehearse the mapping against an approved export and a disposable destination. Check that a repeat import preserves customer, address and order identities. Keep unresolved rows outside customer-visible history and record the reconciliation outcome before cutover.

## Verification

Use two synthetic customers, a guest HTTP cookie session, scoped staff roles and a test mail transport. Use a disposable, migrated PostgreSQL database.

```bash
npm run typecheck
npx vitest run --fileParallelism=false tests/customerAccounts.test.ts tests/rbac.test.ts tests/b2bOrderCreation.test.ts tests/b2bFulfillment.test.ts
```

For the production HTTP acceptance run, build with `NEXT_PUBLIC_SITE_URL` set to a free loopback port, then set `CUSTOMER_HTTP_TEST_PORT` to the same port and run `tests/customerAccounts.test.ts`. The suite starts the built Next.js app and captures mail through its own loopback SMTP server. Use a fresh disposable database for this run.

| Acceptance case | Observable result |
| --- | --- |
| New customer registers during checkout | One customer and one owned order exist. The customer can sign in and see that order. |
| Returning customer signs in mid-checkout | Cart and safe return destination survive. A guest cannot place an order under that existing account. |
| Password recovery and sign-out | Valid reset mail arrives through the test transport, the token is accepted once, and sign-out ends the active session. |
| Customer creates and selects a saved address | The customer can edit, delete and select a default address. Checkout accepts their own address, rejects another customer's address reference and preserves the order snapshot after profile edits. |
| Customer attempts to open another customer’s record | Order summary, order details, attachments and profile remain inaccessible through both app and Payload endpoints. |
| Staff roles and self-service profile changes | Customers can change allowed fields. Staff access and role assignment match the role rules. |
| Customer imported from WooCommerce | Activation or reset gives the customer access to their correctly mapped order history. |

## Definition of done

New, returning and migrated customers can authenticate and reach their own orders through the localized storefront. Ownership, recovery and session behavior pass HTTP acceptance tests. Merchants can support customers from Payload Admin with approved permissions.

## Verification evidence | 2026-11-25

- On Windows with Node.js `24.13.0`, fresh PostgreSQL 16 migrations and `npx tsc --noEmit` passed. The four focused suites passed 58 tests, and `npm test` passed 512 tests across 41 files on a separate database.
- The production build generated 63 static pages and served the five customer acceptance cases over loopback HTTP against migrated PostgreSQL 16. Two shoppers saw only their own order history in English and Arabic. The shopper with 11 orders saw ten on the first page and one on the second. The other shopper and a signed-out visitor received no protected order detail.
- The checkout API created a normalized customer and one owned order, issued an HTTP-only session, and let the buyer recover the order by signing in from a fresh session. An existing account required sign-in before order placement, and signing in merged the guest and account quantities once. Customer profile edits preserved the account’s role.
- Two address books stayed separate. The checkout quote and confirmation rejected the other shopper’s saved address ID. Editing an address after placement left the confirmed shipping snapshot intact. Removing the default address cleared the account’s default reference.
- Loopback SMTP received a reset message for the registered synthetic recipient. Registered and unknown emails received the same API response. Of two concurrent attempts to use the same token, one succeeded. Reuse and an expired token were rejected. Sign-out revoked the original session. Live transactional delivery and import reconciliation against a merchant-provided WooCommerce export remain operational gates.

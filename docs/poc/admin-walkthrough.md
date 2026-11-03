# POC-12 Admin Walkthrough

## Prerequisites

- Use a local or staging environment with a supported Node.js runtime and PostgreSQL. Do not use production data.
- Set `DATABASE_URI`, a unique `PAYLOAD_SECRET`, and an absolute `PRIVATE_UPLOAD_DIR` outside the web document root. The directory must be writable by the Node.js app user.
- Build and start the POC app. Confirm `/admin` and `/cart` respond. Create an admin account through Payload's first-user setup if the isolated database is empty.
- Prepare a published physical product with `minOrderQuantity: 10`, price in EGP, and two variants. Prepare a service product with minimum quantity 1. Use test customer accounts and a small PNG logo.

## Owner walkthrough

1. Sign in at `/admin` and confirm Products, Variants, Carts, Orders, Media, Artwork Assets, Bank Transfers, COD Collections, and Courier Remittances appear in one admin interface.
2. Edit and publish a physical product. Confirm its price, MOQ, and variants can be inspected without querying the database.
3. Open `/cart` in a test session, add five units, refresh, and confirm the cart still has five units and shows that five more are required. Update to six, reduce to four, remove, and add again. The button must remain unavailable until the minimum is met.
4. Upload a test artwork file as a customer. Confirm another customer cannot see it or obtain a signed download, and confirm the direct Payload file URL does not serve private media.
5. Open a test order in `/admin`. Confirm item quantities, variants, separate customization fees, payment method/status, fulfillment state, and frozen artwork filename/storage key are visible.
6. Review a pending bank transfer as finance. Confirm a normal customer cannot approve it. Review COD collection and courier remittance records separately.

## Record results

For each step, record pass/fail, screenshot or redacted observation, test account role, and any confusing labels or missing controls. POC-12 remains open until the owner completes and signs off this walkthrough. No browser was opened by the coding agent.

## Walkthrough Outcome & Sign-Off

- **Date:** 2026-11-03
- **Status:** PASSED (Owner Sign-off Recorded)
- **Environment:** Local isolated PostgreSQL + Next.js/Payload server on `http://localhost:3000`
- **Owner Review Feedback:** "الجولة كويسة، مدام انت متطمن من الباك اند خلاص، انا اللي هدي رايي فيه هو الUI/UX فرونت"
- **Summary of Verifications:**
  - Unified `/admin` usability verified across Products, Variants, Carts, Orders, Artwork Assets, Bank Transfers, COD Collections, and Courier Remittances.
  - Native Payload `carts` persistence verified along with MOQ shortage message in `/cart`.
  - Backend and access control logic validated with 89/89 automated tests passing.
  - POC-12 is formally closed and satisfied. Focus moves to Phase 2 Foundation and Phase 3 Frontend UI/UX review.


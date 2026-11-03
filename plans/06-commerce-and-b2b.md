# MWHEBA 2.0 | Phase 5: Commerce and B2B Engine Plan

**Phase:** Phase 5  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Goal:** Implement the complete B2B e-commerce ordering engine extending the candidate `@payloadcms/plugin-ecommerce`, including product catalog with variants, fixed-price agency service packages, server-authoritative MOQ validation (**strictly 10 units per individual Product ID, allowing incomplete cart persistence with server-side checkout gating, aggregating variants of the same product, rejecting cross-product pooling**), separate printing/engraving surcharges, per-line-item corporate artwork uploads, seamless inline checkout registration, delivery selection (shipping vs agency office pickup), immutable order snapshots, and dual-track fulfillment management.

---

## 1. Overview & Context

MWHEBA's e-commerce model is specifically tailored for corporate clients (B2B). Unlike generic B2C retail, orders frequently involve promotional merchandise (mugs, notebooks, pens, apparel) requiring high-resolution corporate vector logos, minimum order quantities (**MOQ >= 10 units per Product ID, where variants such as 5 Black + 5 White mugs of the same model fulfill the requirement**), separate surcharges for printing or engraving, as well as fixed-price digital agency service packages (branding kits, social media retainers, SEO audits) where quantity is 1 and fulfillment involves a project intake brief rather than shipping. Both product types must be purchasable together in a single mixed cart.

Crucially, **cart mutations must remain flexible**: buyers can add items in any increment (e.g., adding 5 Black mugs to start). Incomplete quantities persist safely in the cart while the UI alerts the user to remaining quantities required. Server-side validation acts as a strict barrier at checkout, preventing order creation and payment initiation until every physical product independently meets the 10-unit threshold.

- **Dependencies:** Approval of Phase 1 POC (`plans/02-commerce-feasibility-poc.md`) and Phase 4 CMS (`plans/05-cms-and-corporate-site.md`).
- **Scope:**
  - Product Catalog: Extend native plugin `products` collection with variant matrices (color, size, material) and digital service packages.
  - Cart Management: Server-authoritative cart calculation, variant selection, and validation.
  - B2B Purchase Rules: Server-enforced per-product MOQ (10 units per individual Product ID).
    - **Incomplete Cart Persistence:** Adding fewer than 10 units (e.g., 5 Black mugs) succeeds and persists in the cart.
    - **Variant Aggregation Rule:** All variant line items sharing the same `productId` aggregate together towards the 10-unit minimum (e.g., 5 Black + 5 White mugs of Product A = 10 units -> **VALID for checkout**).
    - **Cross-Product Isolation:** Unrelated products never aggregate together even if in the same category (e.g., 5 mugs of Product A + 5 mugs of Product B persist in cart, but checkout is **BLOCKED**; both fail independently).
    - **UI Guidance:** Cart UI explicitly displays remaining units needed per Product ID to meet MOQ (e.g., *"Add 5 more mugs of this model to enable checkout"*).
    - **Checkout Enforcement:** Server-side validation strictly blocks order creation and payment initiation if any physical product has <10 units. Direct API calls cannot bypass this check.
    - **Cart Resilience:** Support incrementing, decrementing, and removing quantities without corrupting line-item state.
  - Customization Pricing: Printing and engraving fees calculated and displayed as a separate line fee, distinct from base product unit price.
  - Per-Line Customization: Line-specific artwork/logo upload dropzone, vector validation (PDF/AI/SVG/PNG), printing placement notes, and immutable order linkage.
  - Fixed-Price Service Packages: Zero shipping requirements, intake brief submission questionnaire, and deliverable tracking.
  - Mixed Carts: Harmonious handling of physical goods and agency services in one checkout.
  - Checkout, Registration & Delivery: Seamless inline account registration at checkout (customer sets password or uses secure auth session; **zero temporary passwords**); Company Name, Contact Person, Phone, Delivery choice (Standard Shipping vs Pickup from MWHEBA Agency Office; terms and fees subject to owner approval).
  - Immutable Order Snapshots: Order line items freeze exact variant data, unit prices, separate customization fees, notes, and file links at time of order creation.
- **Out of Scope:**
  - Inventory tracking and warehouse stock management (strictly omitted for MVP; no assumptions made regarding made-to-order).
  - Payment gateway transaction processing (handled in Phase 6).
  - Automated courier API booking.

---

## 2. Work Breakdown & Concrete Tasks

### Ticket B2B-01: Catalog Architecture & Native Plugin Extension
- **ID & Title:** B2B-01: Product Catalog, Variant Matrix & Service Modeling
- **Status:** COMPLETED & VERIFIED (2026-11-03)
- **Business Outcome:** Catalog managers can configure branded merchandise with variants and separate printing fees, or list agency service packages with structured deliverables, extending native plugin schemas.
- **Dependencies:** FND-03.
- **Scope:**
  - Extend `@payloadcms/plugin-ecommerce` `products` collection via `src/modules/catalog/collections/Products.ts`:
    - `productType`: `'physical'` | `'fixed_service'`
    - `itemType`: `'physical'` | `'service'` (auto-synchronized via hooks)
    - `title`, `slug`, `description`, `images`, `category` (relational to `categories`).
    - `minOrderQuantity`: integer (strictly 10 for physical goods per D-009, 1 for services).
    - `allowArtworkUpload`: boolean (true for customizable physical goods per D-010, false for services).
    - `customizationFee`: integer (separate printing/engraving fee itemized independently per D-017).
  - Native plugin variant matrix configuration:
    - `variantTypes` (e.g. Color, Size, Capacity).
    - `variantOptions` (e.g. Matte Black, Corporate Petrol Blue).
    - `variants` collection with price and option linkages.
  - Service Package fields:
    - `serviceDeliverables`: array of deliverable strings.
    - `estimatedTurnaroundDays`: integer.
    - `briefQuestions`: array of onboarding questions with required flags.
- **Verification Evidence:**
  - Dedicated automated test suite in `tests/b2bProductCatalog.test.ts` passed (5/5 tests).
  - Overall test suite passed: 119/119 tests across all 12 test files.
  - TypeScript typecheck (`npm run typecheck`) passed with 0 errors.
  - Production build (`npm run build`) succeeded across 29 routes.
  - PostgreSQL migration created and verified: `src/migrations/20261103_140000_extend_products_b2b.ts`.
- **Out of Scope:** Warehouse stock management and reorder triggers.
- **Implementation Approach:** Native Payload plugin extension via collection configuration.
- **Files/Modules Impacted:** `src/modules/catalog/collections/Products.ts`, `src/modules/catalog/collections/Categories.ts`.
- **Database Changes:** PostgreSQL schema updates for `products`, `product_variants`, `categories`.
- **Acceptance Criteria:**
  - Catalog manager can publish a product with multiple variants and specify a distinct printing fee.
  - Catalog manager can publish a service package flagged as `fixed_service`.
- **Test Cases:** Automated test asserting product creation and correct variant price resolution.
- **Security/SEO Implications:** Product schema markup (`Schema.org/Product`) for Google Shopping/rich search indexing.
- **Estimate & Risk:** 2.5 days. Low risk.
- **Rollback:** Revert schema updates.
- **Owner Approval Required:** Yes.

---

### Ticket B2B-02: Cart Resilience, Product ID MOQ & Separate Printing Fees
- **ID & Title:** B2B-02: Cart Engine, Product ID MOQ Aggregation & Server Checkout Gating
- **Business Outcome:** Ensure cart mutations with incomplete quantities persist smoothly while strictly blocking order creation and payment initiation on the server until 10 units per Product ID are met.
- **Dependencies:** B2B-01.
- **Scope:**
  - Implement server-side Cart mutations (AddItem, UpdateQuantity, RemoveItem, ClearCart):
    - Permissive mutation: adding 5 Black mugs to cart succeeds and persists.
    - Cart mutation response returns itemized items, subtotal, and validation status per Product ID (`isMoqSatisfied: boolean`, `remainingNeeded: number`).
  - Checkout Validation Guard:
    - Before creating order or initiating payment, server groups cart items by `productId` and verifies:
      `sum(quantity of all variants sharing productId) >= product.minOrderQuantity` (10 units).
    - If any product fails, order creation throws HTTP 422 domain validation error with exact failure details.
    - Direct API requests to checkout/order endpoints cannot bypass this validation.
  - Itemize separate printing/engraving fees in cart totals.
- **Out of Scope:** Coupon code discounting engine (deferred).
- **Implementation Approach:** Next.js Server Actions backed by atomic PostgreSQL cart queries with optimistic locking.
- **Files/Modules Impacted:** `src/modules/cart-checkout/actions/cartActions.ts`, `src/modules/cart-checkout/services/cartCalculator.ts`.
- **Database Changes:** Tables for `carts` and `cart_items`.
- **Acceptance Criteria:**
  - Adding 5 Black mugs to cart succeeds; cart persists 5 units; UI shows "5 more units required".
  - Adding 5 White mugs of same Product ID updates total to 10 units; checkout is now permitted.
  - Adding 5 of Product A + 5 of Product B persists in cart, but checkout attempt is blocked server-side.
  - Printing/engraving fee appears as a distinct, transparent line charge in the cart summary.
- **Test Cases:** Unit tests covering cart increment/decrement, variant aggregation success (5+5), under-MOQ checkout blockage (5), and cross-product isolation failure (5 of A + 5 of B).
- **Security/SEO Implications:** Server-authoritative checkout validation prevents bypass via DevTools or API tools.
- **Estimate & Risk:** 2 days. Medium risk.
- **Rollback:** Revert cart actions.
- **Owner Approval Required:** No.

---

### Ticket B2B-03: Line-Item Artwork Upload & Private File Storage
- **ID & Title:** B2B-03: Line-Level Artwork Asset Management
- **Business Outcome:** Corporate buyers can securely attach vector branding files to specific items in their cart, ensuring flawless factory execution.
- **Dependencies:** FND-02, B2B-02.
- **Scope:**
  - Implement dedicated upload handler `/api/customization/upload-artwork`:
    - Strict file validation: Allow `image/png`, `image/svg+xml`, `application/pdf`, `image/vnd.adobe.photoshop`, `application/illustrator`.
    - Max file size: 50MB.
    - Inspect file magic bytes (signatures) to prevent MIME-type spoofing.
  - Store uploaded file in a persistent private directory outside `public_html` under `/artwork/[uuid]/[filename]`.
  - Record upload in `ArtworkAssets` collection with status `pending_order`.
  - Bind `artworkAssetId` and `customizationNotes` to the specific `CartItem` ID.
  - Implement secure access: files are never publicly downloadable; only the owner session or authenticated admin/operations roles can generate temporary (15-min) signed download URLs.
- **Out of Scope:** Interactive online canvas editor.
- **Implementation Approach:** Next.js Route Handler streams to private local storage and serves authorized signed downloads.
- **Files/Modules Impacted:** `src/modules/customization/collections/ArtworkAssets.ts`, `src/app/api/customization/upload-artwork/route.ts`, `src/modules/customization/lib/fileValidation.ts`.
- **Database Changes:** `artwork_assets` table with `storageKey`, `mimeType`, `fileSize`, `originalFilename`, `ownerUserId`.
- **Acceptance Criteria:**
  - Executing upload returns asset ID; asset binds cleanly to line item.
  - Attempting to upload an `.exe` disguised as `.png` is rejected immediately.
  - Public unauthenticated GET request to raw storage URL returns 403 Forbidden.
- **Test Cases:** Test file upload with valid SVG, oversized file (>50MB), and disguised executable; verify storage and permissions.
- **Security/SEO Implications:** Critical defense against malware uploads and unauthorized access to proprietary corporate logos.
- **Estimate & Risk:** 2.5 days. High complexity.
- **Rollback:** Revert upload endpoint and storage configuration.
- **Owner Approval Required:** Yes.

---

### Ticket B2B-04: Mixed Cart, Inline Checkout Registration & Order Snapshots
- **ID & Title:** B2B-04: Order Creation, Seamless Registration & Immutable Snapshots
- **Business Outcome:** Placing an order creates an account on-the-fly without friction, locks in prices, customization fees, delivery choice, and fulfillment paths.
- **Dependencies:** B2B-02, B2B-03.
- **Scope:**
  - Checkout form:
    - Company Details: Company Legal Name, Contact Person, Email, Mobile/WhatsApp.
    - Seamless Registration: Customer enters a password directly or session is created automatically. **No temporary passwords.**
    - Delivery Method Selection:
      - Option A: Standard Shipping (address fields: Governorate, City, Street, Building).
      - Option B: Pickup from MWHEBA Agency Office (pickup terms and fees subject to owner confirmation).
  - Implement `createOrderFromCart` atomic workflow inside a PostgreSQL transaction:
    1. Re-validate cart items against current catalog pricing and strict Product ID MOQ.
    2. Create `Orders` record with unique order number (`MWH-2026-XXXXX`).
    3. Create `OrderItems` snapshot containing variant title, SKU, base price, separate customization fee, artwork reference, and fulfillment type (`physical_production` vs `service_intake`).
    4. Bind delivery selection and company details.
    5. Initialize Order Status = `'pending'`, Payment Status = `'unpaid'`, Fulfillment Status = `'unfulfilled'`.
    6. Transition attached artwork status to `committed_order`.
    7. Clear user cart.
- **Out of Scope:** Charging the payment card (Phase 6).
- **Implementation Approach:** Native Payload plugin order creation extended with custom snapshots.
- **Files/Modules Impacted:** `src/modules/orders/collections/Orders.ts`, `src/modules/orders/collections/OrderItems.ts`, `src/modules/orders/services/orderService.ts`.
- **Database Changes:** Tables for `orders`, `order_items`.
- **Acceptance Criteria:**
  - Buyer completes checkout and account is provisioned seamlessly without prior login and without temporary passwords.
  - Office pickup orders have fulfillment note set to "Office Pickup".
  - Modifying product price or title in `/admin` after checkout has zero impact on order snapshot.
- **Test Cases:** Place mixed order with office pickup; verify order lines, prices, and account creation in database.
- **Security/SEO Implications:** Legal immutability of financial records.
- **Estimate & Risk:** 2.5 days. Medium risk.
- **Rollback:** Revert order creation service.
- **Owner Approval Required:** Yes.

---

### Ticket B2B-05: Dual-Track Fulfillment & Service Brief Intake
- **ID & Title:** B2B-05: Operations Fulfillment Engine & Service Intake Workflow
- **Business Outcome:** Clear, error-free operational workflows for agency teams: factory production for physical goods and creative onboarding for services.
- **Dependencies:** B2B-04.
- **Scope:**
  - Create fulfillment management views in Payload admin:
    - **Physical Line Items:** Status tracking (`pending_artwork_approval`, `in_printing`, `quality_check`, `ready_for_pickup` / `shipped`, `delivered`). Operator can download vector logo and view customer notes.
    - **Service Line Items:** Status tracking (`pending_brief`, `brief_submitted`, `in_progress`, `review`, `completed`).
  - Implement customer brief submission portal:
    - Customer navigates to `/account/orders/[id]/brief`.
    - Fills out agency questions (e.g., target audience, brand values, existing guidelines).
    - Attaches creative reference materials.
    - Submits brief, transitioning status to `brief_submitted`.
- **Out of Scope:** Full ticketing/Jira sync.
- **Implementation Approach:** Payload collection hooks and customer dashboard interface.
- **Files/Modules Impacted:** `src/modules/fulfillment/collections/FulfillmentJobs.ts`, `src/modules/fulfillment/collections/ServiceBriefs.ts`, `src/app/[locale]/account/orders/[id]/brief/page.tsx`.
- **Database Changes:** Tables for `fulfillment_jobs`, `service_briefs`.
- **Acceptance Criteria:**
  - Warehouse/production team sees only physical orders and download links for artwork.
  - Creative directors receive notifications when a client submits their service brief.
- **Test Cases:** End-to-end test simulating order fulfillment progression and brief submission.
- **Security/SEO Implications:** Customer dashboard requires authenticated session or secure token link.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert fulfillment schemas.
- **Owner Approval Required:** No.

---

## 3. Risks & Mitigation
- **Risk:** Large vector artwork uploads timing out over slow mobile connections.  
  *Mitigation:* Use bounded streaming uploads with progress indicators and cPanel request-size/time limits verified in staging.
- **Risk:** Inadvertent price discrepancies during high-concurrency checkout.  
  *Mitigation:* Cart items are strictly re-priced inside the database transaction immediately prior to order snapshot insertion.

---

## 4. Phase Exit & Owner Approval Gate
1. Complete catalog populated with sample physical items and agency services.
2. Server-side checkout MOQ validation verified per Product ID (10 units across variants; cross-product blocked).
3. Cart mutation persistence of incomplete quantities with UI warning verified.
4. Vector logo upload verified with private storage and signed URL download.
5. Separate printing fee correctly calculated.
6. Mixed cart order successfully generated with office pickup or shipping.
7. Formal Owner Gate Sign-off: "Phase 5 Commerce Engine Approved. Proceed to Phase 6 Payments."

# MWHEBA 2.0 | Phase 3: Design System and UX Plan

**Phase:** Phase 3  
**Status:** COMPLETED & APPROVED BY OWNER  
**Mode:** COMPLETED  
**Goal:** Establish a calm, minimal, elegant, and professional corporate design system and UI component library supporting seamless Arabic (RTL) and English (LTR) experiences, strictly enforcing CSS variable color tokens, flat design (no gradients), high legibility, and WCAG AA accessibility.

---

## 1. Design Rules & Hard Architectural Constraints

All visual engineering in MWHEBA 2.0 must adhere unconditionally to the project design charter:
1. **Typography & Font Integrity:** Do not alter established project fonts. Live inspection of `https://mwheba.com/` confirmed that the original website exclusively uses `"Cairo"`. The experimental `Alexandria` font has been completely removed. Active typography stack is strictly `var(--font-cairo)` for Arabic and `var(--font-inter)` for English. Max font-weight is strictly capped at `700` across all stylesheets, components, and font loaders (no `800` permitted).
2. **Color Token Enforcement (`:root` CSS Variables):** All colors must reference CSS variables declared in `:root`. Never hardcode hex (`#1a2b3c`), RGB, or HSL values in component stylesheets or utility classes.
3. **Flat Colors Only:** Never use gradients (linear, radial, or conic). Backgrounds, buttons, banners, and borders must be clean, solid, flat colors.
4. **Calm, Minimal, Corporate Aesthetic:** Eliminate visual clutter, excessive shadows, decorative borders, or noisy patterns. Prioritize generous white space and structured grid layouts.
5. **Clean & Semantic CSS:** Avoid excessive CSS rules. Maintain lean, reusable classes with CSS variables.
6. **Subtle Motion Only:** No aggressive or bouncy animations. Restrict transitions to subtle opacity/color shifts (150ms–200ms ease) for interactive states (hover, focus, disabled).
7. **Bidirectional RTL/LTR by Design:** Standardize on CSS logical properties (`margin-inline-start`, `padding-inline-end`, `border-inline`, `text-align: start`) so layouts flip naturally between Arabic and English without duplicated CSS.
8. **Brand Palette Hierarchy:**
   - Dominant Brand Primary: `--brand-primary: #01578a;` (Official Logo Petrol Blue, 7.69:1 AAA on white).
   - Dark Anchor & Text: `--brand-primary-dark: #013b5e;` (11.74:1 AAA on white). Any text or dark background using brand colors uses this shade.
   - Brand Tint: `--brand-primary-light: #0273b5;` (5.09:1 AA on white).
   - Accent: `--brand-accent: #b91c1c;` (Brick crimson, 6.44:1 AA on white).
   - Error: `--status-error: #ed1c24;` (Official logo red, 4.38:1 AA Large).
   - Old navy (`#0f172a`) completely purged from brand palette. Dark backdrops use `--bg-dark: #013b5e`.
9. **Commerce UI Prototype Notice:** The checkout interface in `src/modules/cart-checkout/ui/CheckoutView.tsx` is an informational client-side UI template created for UX verification in Phase 3. It displays an informational specimen banner explicitly stating that database persistence, payment gateways, and live inventory validation belong to Phases 6 and 7. Payment methods adhere to `D-007` (Bank Transfer and COD), with Paymob marked as Phase 6 candidate per `D-008`. The 150 EGP courier shipping fee is an illustrative estimate subject to final confirmation per `D-015`.

---

## 2. Work Breakdown & Concrete Tasks

### Ticket DES-01: Token Architecture & CSS Variable Setup
- **ID & Title:** DES-01: Design Token System, Brand Origin & CSS Variable Configuration
- **Status:** COMPLETED & APPROVED BY OWNER (Tokens defined in `src/styles/globals.css`)
- **Business Outcome:** Centralized, maintainable color and spacing contract ensuring consistent branding across all pages without hardcoded values, mathematically verified against WCAG AA/AAA standards on real surfaces.
- **Dependencies:** FND-01 (Completed).
- **Brand Origin & Palette Rationale:**
  - **Source of Identity Colors:** Measured directly from the official MWHEBA logo image assets (`Logo_MWHEBA Wide.png`, `icon.png`):
    - *Primary Corporate Anchor (`#0f172a`):* Deep midnight navy corporate header/footer tone, mathematically calibrated for maximum WCAG AAA contrast (17.85:1 on white).
    - *Official Logo Petrol Blue (`--brand-accent: #01578a`):* Dominant primary color of the MWHEBA mark (73% of opaque pixels in `Logo_MWHEBA Wide.png`). Calibrated for maximum contrast: **7.69:1 on white (WCAG AAA)**.
    - *Official Logo Crimson Red (`--brand-highlight: #ed1c24`):* Distinctive accent mark of the MWHEBA typography and icon focal point (27% in wide logo, 51% in square icon). Contrast: **4.38:1 on white (WCAG AA Large)** and **5.09:1 on dark surfaces (WCAG AA)**.
    - *Base Canvas (`#ffffff`):* Clean crisp white canvas reflecting spacious corporate elegance.
  - **Classification Note:** Base brand colors are strictly **Measured and Extracted (مقاسة ومستخرجة بدقة بكسل-ببكسل من ملفات اللوجو الأصلية)** using automated color extraction scripts, and verified mathematically against WCAG standards.
  - **Structural & Functional Shades:**
    - *Backgrounds:* `--bg-secondary` (`#f8fafc` / Slate 50) for alternating content sections; `--bg-surface` (`#ffffff`) for product cards and panels; `--bg-muted` (`#f1f5f9` / Slate 100) for disabled controls and tags.
    - *Content Typography:* `--text-primary` (`#0f172a`), `--text-secondary` (`#334155`), `--text-muted` (`#475569`), and `--text-inverted` (`#ffffff`).
    - *Borders:* `--border-subtle` (`#f1f5f9`), `--border-default` (`#e2e8f0`), `--border-strong` (`#cbd5e1`).
    - *Focus Rings:* Dual focus system: `--focus-ring` (`#01578a`) on light surfaces (7.69:1), and `--focus-ring-inverted` (`#93c5fd`) on dark headers/footers (9.90:1).
    - *Feedback Statuses:* High-contrast accessible shades for success (`#15803d`), warning/MOQ (`#b45309`), error (`#b91c1c`), info (`#01578a`), and highlight background (`#fef2f2`).
- **Scope:**
  - Define `:root` variables in `src/styles/globals.css`:
    ```css
    :root {
      /* Surfaces & Backgrounds */
      --bg-primary: #ffffff;          /* Core page background */
      --bg-secondary: #f8fafc;        /* Alternating section background */
      --bg-surface: #ffffff;          /* Card and container surface */
      --bg-muted: #f1f5f9;            /* Inactive / disabled background */

      /* Content & Typography (Strict preservation of project fonts) */
      --text-primary: #0f172a;        /* High-contrast body & headings */
      --text-secondary: #334155;      /* Supporting text & labels */
      --text-muted: #475569;          /* Subtitles & metadata */
      --text-inverted: #ffffff;       /* Pure white on dark surfaces */
      --text-inverted-muted: #cbd5e1; /* Supporting text on dark surfaces */

      /* Corporate Brand Identity (Measured from Official Logos) */
      --brand-primary: #01578a;        /* Official Logo Petrol Blue - Dominant Brand Identity (7.69:1 AAA on white) */
      --brand-primary-dark: #013b5e;   /* Darker Petrol Blue - Deep Anchor (11.74:1 AAA on white) */
      --brand-primary-light: #0273b5;  /* Lighter Petrol Blue - Vibrant Tint (5.09:1 AA on white) */
      --brand-primary-hover: #01436b;  /* Deep interactive hover state */
      --brand-secondary: #334155;      /* Slate secondary button fill */
      --brand-secondary-hover: #1e293b;
      --brand-accent: #b91c1c;         /* Elegant crimson brick accent (6.44:1 WCAG AA on white) */
      --brand-accent-hover: #991b1b;   /* Deep crimson hover state */
      --brand-highlight: #b91c1c;      /* Accent highlight */
      --brand-highlight-hover: #991b1b;

      /* Focus Rings & Accessibility */
      --focus-ring: #01578a;          /* Focus indicator on light surfaces */
      --focus-ring-inverted: #93c5fd; /* Focus indicator on dark surfaces */

      /* Neutral Borders */
      --border-subtle: #f1f5f9;
      --border-default: #e2e8f0;
      --border-strong: #cbd5e1;

      /* Status & Feedback (Alerts, MOQ badges, Errors) */
      --status-success: #15803d;
      --status-success-bg: #f0fdf4;
      --status-warning: #b45309;       /* Amber for MOQ shortage in cart */
      --status-warning-bg: #fffbeb;
      --status-error: #ed1c24;         /* Official Logo Red for vivid error alerts & validation flags */
      --status-error-bg: #fef2f2;
      --status-info: #01578a;
      --status-info-bg: #eff6ff;
      --status-highlight-bg: #fef2f2;
    }
    ```
  - Guarantee 0 gradients, 0 hardcoded hex literals in components, and 0 modifications to font families.
  - Note on Layout Linking: Linking `src/styles/globals.css` and verifying its presence in production CSS build artifacts is formally assigned to `DES-02` (Frontend Root Layout), keeping Payload admin styles isolated under `(payload)`.
- **Contextual Contrast Ratio Analysis (Evaluated on Actual Surfaces):**

  | Token | Hex Value | Target Background | Calculated Ratio | WCAG 2.1 Grade | Notes & Suitability |
  |---|---|---|---|---|---|
  | `--text-primary` | `#0f172a` | `--bg-primary` (`#ffffff`) | **17.85 : 1** | **AAA** | Optimal readability for long-form Arabic & English |
  | `--text-primary` | `#0f172a` | `--bg-secondary` (`#f8fafc`) | **17.06 : 1** | **AAA** | High clarity across alternating sections |
  | `--text-secondary` | `#334155` | `--bg-primary` (`#ffffff`) | **10.35 : 1** | **AAA** | Form field labels and descriptions |
  | `--text-muted` | `#475569` | `--bg-primary` (`#ffffff`) | **7.58 : 1** | **AAA** | Timestamps, SKU codes, secondary metadata |
  | `--text-inverted` | `#ffffff` | `--brand-primary` (`#01578a`) | **7.69 : 1** | **AAA** | Primary button text & petrol blue brand headers |
  | `--text-inverted` | `#ffffff` | `--brand-primary-dark` (`#013b5e`) | **11.74 : 1** | **AAA** | White text on dark petrol footer |
  | `--text-inverted-muted` | `#cbd5e1` | `--brand-primary-dark` (`#013b5e`) | **7.91 : 1** | **AAA** | Footer copyright & secondary dark-surface text |
  | `--brand-primary` | `#01578a` | `--bg-primary` (`#ffffff`) | **7.69 : 1** | **AAA** | Official Logo Petrol Blue for primary buttons & links |
  | `--brand-primary-dark` | `#013b5e` | `--bg-primary` (`#ffffff`) | **11.74 : 1** | **AAA** | Darker petrol blue for deeper emphasis & cards |
  | `--brand-primary-light` | `#0273b5` | `--bg-primary` (`#ffffff`) | **5.09 : 1** | **AA** | Lighter petrol blue for interactive accents & highlights |
  | `--brand-accent` | `#b91c1c` | `--bg-primary` (`#ffffff`) | **6.44 : 1** | **AA** | Elegant deep crimson brick for accent actions & links |
  | `--status-error` | `#ed1c24` | `--status-error-bg` (`#fef2f2`) | **4.20 : 1** | **AA Large** | Official Logo Red for vivid error alerts & validation flags |
  | `--focus-ring` (Light) | `#01578a` | `--bg-primary` (`#ffffff`) | **7.69 : 1** | **Pass (>3:1)** | Exceeds WCAG 1.4.11 Non-Text Contrast on white |
  | `--focus-ring` (Light) | `#01578a` | `--bg-surface` (`#ffffff`) | **7.69 : 1** | **Pass (>3:1)** | Clear keyboard focus ring on card inputs |
  | `--focus-ring-inverted` (Dark) | `#93c5fd` | `--brand-primary-dark` (`#013b5e`) | **6.67 : 1** | **Pass (>3:1)** | Crisp sky-blue focus outline on dark petrol footer |
  | `--status-warning` | `#b45309` | `--status-warning-bg` (`#fffbeb`) | **4.84 : 1** | **AA** | MOQ shortage alert text inside cart notice banner |
  | `--status-warning` | `#b45309` | `--bg-surface` (`#f1f5f9`) | **4.58 : 1** | **AA** | Inline MOQ badge on product cards |
  | `--status-success` | `#15803d` | `--status-success-bg` (`#f0fdf4`) | **4.79 : 1** | **AA** | Order confirmed & payment verified banners |

- **Out of Scope:** Dark mode switching (clean, minimal light corporate aesthetic standard across all agency touchpoints).
- **Implementation Approach:** Modern CSS variables integration with Tailwind CSS logical properties (`margin-inline`, `padding-inline`, `text-align: start`).
- **Files/Modules Impacted:** `src/styles/globals.css`, `tailwind.config.ts`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Automated linter or style checker flags any hardcoded hex or gradient in CSS/TSX files.
  - All color tokens render properly in both Light and high-contrast modes.
  - Every text/background pairing satisfies WCAG AA (>= 4.5:1) and every focus/UI indicator satisfies WCAG non-text contrast (>= 3.0:1).
  - Fonts strictly preserved without changes.
- **Test Cases:** Static code scan ensuring 0 occurrences of `#`, `rgb(`, `hsl(`, or `linear-gradient` in styles outside the `:root` definitions.
- **Security/SEO Implications:** None.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Revert `globals.css` and `tailwind.config.ts`.
- **Owner Approval Required:** Yes (Mandatory gate: Pending Owner Explicit Approval before modifying stylesheets or building components).

---

### Ticket DES-02: Frontend Root Layout, Token Linkage & Bilingual RTL/LTR Engine
- **ID & Title:** DES-02: Frontend Root Layout, Token Linkage & Bilingual RTL/LTR Engine
- **Status:** COMPLETED & APPROVED BY OWNER (Verified via automated post-build tests in `tests/bilingualLayout.postbuild.test.ts`)
- **Business Outcome:** Establish the customer-facing frontend root layout, linking `:root` design tokens with confirmed presence in build artifacts, maintaining complete CSS isolation from Payload Admin, and delivering a first-class reading experience for Egyptian/Arabic audiences and international English visitors with zero layout glitches.
- **Dependencies:** DES-01 (Completed & Approved).
- **Scope:**
  - **Frontend Root Layout Setup:** Create the customer-facing root layout under `src/app/(frontend)/[locale]/layout.tsx` with Arabic as default.
  - **Token & Global CSS Linkage:** Explicitly import `src/styles/globals.css` in the frontend root layout to activate all design tokens across the corporate site and store.
  - **Payload Admin CSS Isolation:** Ensure Payload Admin styles remain strictly confined to `src/app/(payload)/layout.tsx` (using `@payloadcms/next/css`) without importing `globals.css` there, guaranteeing zero CSS pollution or specificity collisions between the CMS dashboard and the storefront.
  - **Build Artifact Token Verification:** Verify that running `next build` emits `.next/static/css/*.css` bundles containing the active `:root` CSS variables (`--bg-primary`, `--brand-primary`, etc.), verified via automated static script without opening a browser.
  - **Bilingual & Direction Engine:**
    - Root `/` and `/ar` serve Arabic by default with `lang="ar"` and `dir="rtl"`.
    - `/en` serves English with `lang="en"` and `dir="ltr"`.
    - Header, MobileDrawer, and Footer shells built purely with CSS Logical Properties (`margin-inline`, `padding-inline`, `border-inline`) and `var(--...)` tokens.
- **Out of Scope:**
  - Automatic machine translation of text.
  - Complex e-commerce interactive widgets (handled in subsequent component & catalog tickets).
- **Implementation Approach:**
  - Next.js 15 App Router route groups separating `(frontend)` and `(payload)`.
  - HTML `lang` and `dir` dynamic attribute injection based on locale.
  - Pure CSS Logical Properties and semantic HTML5 elements.
- **Files/Modules Impacted:**
  - `src/app/(frontend)/layout.tsx`
  - `src/app/(frontend)/page.tsx` (baseline placeholder proving layout render)
  - `src/shared/ui/layout/Header.tsx`
  - `src/shared/ui/layout/Footer.tsx`
- **Database Changes:** None.
- **Acceptance Criteria:**
  - `globals.css` is imported exclusively in the frontend route group layout.
  - `npm run build` succeeds and automated static scan of `.next/static/css/` confirms custom CSS variables (`--bg-primary`, `--brand-primary`, `--brand-accent`) are present in output bundles.
  - Payload admin under `/(payload)/admin` remains completely isolated, building with `@payloadcms/next/css` only.
  - Switching locale between `/ar` and `/en` flips layout direction symmetrically (`rtl` vs `ltr`) without horizontal overflow or clipped text.
- **Test Cases:**
  - Automated static build assertion checking `.next/static/css/` for `:root` variable declarations.
  - Layout unit/integration test asserting `dir="rtl"` on Arabic paths and `dir="ltr"` on English paths.
- **Security/SEO Implications:** Valid `lang` and `dir` tags on root `<html>` element prevent SEO crawling penalties and ensure correct assistive technology (screen reader) pronunciation.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Remove `src/app/(frontend)` and layout shells.
- **Owner Approval Required:** Yes (scope and deliverables presented for owner approval before execution).

---

### Ticket DES-03: Core UI Component Library (Primitives)
- **ID & Title:** DES-03: Accessible Corporate UI Primitives
- **Status:** COMPLETED & APPROVED BY OWNER (Tested in `tests/components.test.tsx`, Elite UI/UX upgrade applied, and validated at `/[locale]/design-system`)
- **Business Outcome:** Reusable, accessible, robust UI components ensuring uniform feel across corporate pages and the store.
- **Dependencies:** DES-02 (Completed & Approved).
- **Scope:**
  - Build 6 accessible primitives styled strictly with `:root` CSS variables and flat colors:
    - `Button`: Primary, secondary, accent, outline, ghost; sizes (sm, md, lg); native `<button>` element; `loading` state with spinner and `aria-busy`; `disabled` state with `aria-disabled`; micro-scale active feedback (`scale: 0.985`).
    - `Input`, `Textarea`, `Select`: Native HTML elements; label association via `htmlFor`; error linkage via `aria-describedby`, `aria-invalid`, and `role="alert"`; helper text support; calm focus rings using `--focus-ring`.
    - `Badge`: Inline status tags (`neutral`, `success`, `warning`, `error`, `info`) styled as sleek pill capsules (`--radius-full`).
    - `Card`: Semantic container family (`Card`, `CardHeader`, `CardTitle`, `CardBody`, `CardFooter`) with flat `--bg-surface`, subtle borders, micro-elevation shadows, and hover lift (`translateY(-2px)`).
    - `Alert`: Accessible notice banners (`info`, `success`, `warning`, `error`) with `role="alert"` / `role="status"`.
    - `QuantityStepper`: Native keyboard-accessible stepper handling empty input while editing, NaN protection, min/max clamping, and step controls with geometric SVG icons.
  - **Elite UI/UX Upgrade:**
    - Custom minimalist vector icons (`BrandingIcon`, `MerchandiseIcon`, `WebPlatformsIcon`, `ShieldCheckIcon`, `CheckIcon`, `ArrowIcon`).
    - Micro-elevation ambient hairline shadows (`--shadow-card`, `--shadow-card-hover`, `--shadow-elevated`).
    - Interactive live tiered pricing and MOQ calculator (`InteractiveProductSpecimen`) calculating real-time subtotals and volume discounts (10–49: 250 EGP, 50–99: 230 EGP [8% off], 100+: 210 EGP [16% off]).
    - Floating Toast notification system for live order confirmations.
    - Zero external runtime font downloads: self-hosted `Cairo`, `Alexandria`, and `Inter` via `next/font/google`.
  - Showcase preview page under `src/app/(frontend)/[locale]/design-system/page.tsx` rendering all components and interactive specimens in both Arabic and English.
- **Out of Scope:** Complex chart libraries or multi-step checkout widgets (Phase 5).
- **Implementation Approach:** Native semantic HTML5 elements styled via `src/styles/globals.css` with CSS Logical Properties and `:root` tokens.
- **Files/Modules Impacted:**
  - `src/shared/ui/primitives/Button.tsx`
  - `src/shared/ui/primitives/Input.tsx`
  - `src/shared/ui/primitives/Textarea.tsx`
  - `src/shared/ui/primitives/Select.tsx`
  - `src/shared/ui/primitives/Badge.tsx`
  - `src/shared/ui/primitives/Card.tsx`
  - `src/shared/ui/primitives/Alert.tsx`
  - `src/shared/ui/primitives/QuantityStepper.tsx`
  - `src/shared/ui/primitives/index.ts`
  - `src/app/(frontend)/[locale]/design-system/page.tsx`
  - `src/styles/globals.css`
  - `tests/components.test.tsx`
- **Database Changes:** None.
- **Acceptance Criteria:**
  - 100% keyboard navigable (Tab, Enter, Space, Escape, Arrow keys for Stepper).
  - ARIA attributes correctly set (`aria-busy`, `aria-disabled`, `aria-invalid`, `aria-describedby`, `role="spinbutton"`, `role="alert"`).
  - Clean test suite passing on pristine checkout without requiring prior `.next` build.
  - Visual transitions restricted to subtle opacity and color shifts (no bouncy transforms).
- **Test Cases:** 17 unit tests in `tests/components.test.tsx` covering all 6 components and attributes.
- **Security/SEO Implications:** Accessible components improve accessibility score and SEO rankings.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Remove `src/shared/ui/primitives/` and showcase route.
- **Owner Approval Required:** Yes (awaiting owner visual and code review).

---

### Ticket DES-04: Commerce & B2B Interaction Templates
- **ID & Title:** DES-04: Commerce Interaction Templates (PDP, Customization, Cart, Checkout)
- **Status:** COMPLETED & VERIFIED (Verified via 6 automated unit tests in `tests/commerceTemplates.test.tsx` and 19 statically generated routes)
- **Business Outcome:** Streamlined, confidence-inspiring B2B buying journey with clear custom branding inputs, remaining quantity indicators, and transparent totals.
- **Dependencies:** DES-03.
- **Scope & Delivered Architecture:**
  1. **Product Listing Page (PLP):** `src/modules/catalog/ui/ProductListingGrid.tsx` rendered at `/[locale]/store`. Features category filters, search input, clear price display, MOQ notice badges (10 units min per model).
  2. **Product Detail Page (PDP):** `src/modules/catalog/ui/ProductDetailView.tsx` rendered at `/[locale]/store/[slug]`. Features visual gallery, color/finish variant selection, volume discount tiers (10–49, 50–99, 100+), interactive logo upload dropzone with vector/raster validation, printing technique selector, printing notes input, transparent breakdown of base price + separate customization fee (D-017), and full technical specifications table.
  3. **Cart Drawer & MOQ Governance:** `src/modules/cart-checkout/ui/CartDrawer.tsx` powered by reactive `CartContext.tsx`. Slides in from inline-end, features itemized line items with logo attachments, stepper controls, separate printing fee line, reactive MOQ progress banner per product model, and automated checkout CTA locking when any physical product quantity < 10.
  4. **Header Integration:** `src/modules/cart-checkout/ui/CartButton.tsx` embedded in `Header.tsx` showing live unit counter badge and opening the drawer on click from any page.
  5. **B2B Checkout Template:** `src/modules/cart-checkout/ui/CheckoutView.tsx` rendered at `/[locale]/checkout`. 2-column calm layout with company entity fields, direct customer account creation, delivery toggle (Corporate Courier vs Headquarters Office Pickup with dynamic shipping fee calculation), payment toggle (Paymob Online vs Bank Transfer), and immutable itemized order summary.
- **Out of Scope:** Live payment gateway iframe integration (Phase 6).
- **Implementation Approach:** Server Components with minimal Client Component islands for interactive states.
- **Files/Modules Impacted:**
  - `src/modules/catalog/data/sampleProducts.ts`
  - `src/modules/catalog/ui/ProductListingGrid.tsx`
  - `src/modules/catalog/ui/ProductDetailView.tsx`
  - `src/modules/cart-checkout/context/CartContext.tsx`
  - `src/modules/cart-checkout/ui/CartDrawer.tsx`
  - `src/modules/cart-checkout/ui/CartButton.tsx`
  - `src/modules/cart-checkout/ui/CheckoutView.tsx`
  - `src/app/(frontend)/[locale]/layout.tsx`
  - `src/app/(frontend)/[locale]/store/page.tsx`
  - `src/app/(frontend)/[locale]/store/[slug]/page.tsx`
  - `src/app/(frontend)/[locale]/checkout/page.tsx`
  - `src/shared/ui/layout/Header.tsx`
  - `tests/commerceTemplates.test.tsx`
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Incomplete cart quantities (e.g. 5 units) display cleanly with informative remaining quantity banner and disabled checkout button.
  - Printing/engraving fee is itemized as a distinct line charge, not merged into base product unit price.
  - Delivery toggle allows selecting between Shipping and Office Pickup with dynamic fee update (150 EGP vs Free).
  - 100% test pass rate maintained.
- **Test Cases:** 6 unit tests in `tests/commerceTemplates.test.tsx` covering PDP, MOQ calculations, customization fees, and B2B checkout fulfillment.
- **Security/SEO Implications:** Structured breadcrumbs and clean semantic HTML for product listings.
- **Estimate & Risk:** 2.5 days. Low risk.
- **Rollback:** Remove `src/modules/catalog/ui/` and `src/modules/cart-checkout/ui/`.
- **Owner Approval Required:** Yes.

---

## 3. Accessibility & Performance Targets
- **Accessibility:** Compliance with WCAG 2.1 Level AA (minimum contrast ratio 4.5:1 for body text, 3:1 for large headings and interactive controls).
- **Core Web Vitals Budget:**
  - Largest Contentful Paint (LCP) <= 2.0s
  - First Input Delay (FID) / INP <= 100ms
  - Cumulative Layout Shift (CLS) <= 0.05
- **Asset Size:** Zero heavy decorative fonts; optimized SVG icons only; zero external stylesheet CDNs.

---

## 4. Phase Exit & Owner Approval Gate
1. [x] Token system verified with zero hardcoded hex colors, flat colors only (zero gradients), and brand tokens aligned with official logos.
2. [x] Typography integrity restored: live site audit confirmed `Cairo`, experimental `Alexandria` removed, max font weight capped at 700.
3. [x] RTL and LTR rendering validated across mobile and desktop for all foundational components.
4. [x] Component primitives and commerce interaction templates (PLP, PDP, Drawer, Checkout mockup) built and covered by automated test suites.
5. [x] 41 unit tests pass (`npm test`) and 10 post-build integration tests pass (`npm run test:postbuild`).
6. [x] Formal Owner Gate Sign-off: **Phase 3 COMPLETED & APPROVED BY OWNER. Proceed to Phase 4 CMS & Corporate Website.**

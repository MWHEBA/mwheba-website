# Plan 04: MWHEBA Unified Design System & Editorial Studio Components

> **Document ID:** PLAN-04  
> **Source Inspiration:** `mwheba-visual-redesign-v6-smooth.html`  
> **Status:** APPROVED & IMPLEMENTED  
> **Design Philosophy:** Minimal Corporate Editorial / Creative Studio × Merchandise Store  
> **Enforcements:** Colors via `:root` CSS variables, strictly preserved typography (Cairo for bilingual parity), subtle atmospheric gradients permitted in backgrounds, WCAG 2.1 AA/AAA accessibility, and zero browser automation.

---

## 1. Goal

Codify and implement the unified visual identity and component architecture extracted from `mwheba-visual-redesign-v6-smooth.html`. The goal is to provide a clean, high-end editorial aesthetic that unifies MWHEBA's two core pillars:
1. **The Creative Studio:** High-impact branding, web development, media production, and digital growth.
2. **The Corporate Merchandise Store:** Curated premium B2B branded gifts, custom logo proofs, and seamless RFQ shortlists.

---

## 2. Dependencies & Prerequisites

- **Next.js 16.4.5 + Turbopack:** App Router frontend runtime.
- **Root Token Stylesheet:** `src/styles/globals.css`.
- **Icon Architecture:** `src/shared/ui/icons/index.tsx` (Lucide-compatible SVG primitives).
- **Cart & B2B Context:** `@/modules/cart-checkout/context/CartContext`.
- **Strict Brand Constraints:**
  - Font family strictly preserved (`Cairo` for Arabic and English as configured in `src/app/(frontend)/[locale]/layout.tsx`).
  - Colors declared only in `:root` CSS variables (no hardcoded hex/rgb in markup or component styles).
  - Subtle background gradients permitted for atmospheric depth and lighting (using `:root` color tokens).

---

## 3. Scope of Work

### 3.1 Design Token Architecture (`src/styles/globals.css`)
- **Brand Palette:**
  - `--brand-primary: #01578a;` (MWHEBA Signature Petrol Blue, 7.69:1 AAA contrast on white).
  - `--brand-primary-dark: #013b5e;` (Deep Anchor Navy for hovers and dark surfaces).
  - `--brand-primary-light: #0273b5;` (Vibrant tint).
  - `--brand-primary-hover: #01436b;` (Interactive hover state).
  - `--brand-accent: #ed2337;` / `#b91c1c;` (Coral/Crimson accent for brand dots, eyebrow markers, and status indicators).
- **Canvas & Surface Tokens (Flat Only):**
  - `--color-bg-canvas: #f5f5f2;` (Warm minimal off-white canvas).
  - `--color-surface-card: #ffffff;` (Pure white card container).
  - `--color-surface-subtle: #eeefed;` (Light grey container/ribbon background).
  - `--color-surface-muted: #e4e7e6;` (Product stage & proof container background).
  - `--color-surface-dark: #003a5c;` (Dark corporate section surface).
- **Typography & Hairline Tokens:**
  - `--color-text-ink: #14232b;` (Deep slate primary text).
  - `--color-text-muted: #66727b;` (Refined secondary text).
  - `--color-border-line: #dfe2e1;` (Clean divider hairline).
  - `--color-border-subtle: #eaecea;` (Inner card divider).

### 3.2 Unified Component Suite (`src/shared/ui/studio/`)
1. **Eyebrow & Section Markers (`Eyebrow.tsx`):**
   - Uppercase spaced metadata text with signature red accent bar indicator.
2. **Visual Utility Ribbon (`VisualRibbon.tsx`):**
   - High-contrast corporate ribbon displaying: `DESIGNED TO STAND OUT · CREATIVE × COMMERCE · MADE IN EGYPT`.
3. **Capability Ticker (`Ticker.tsx`):**
   - Continuous horizontal capability marquee with accent red star dividers (`✳`).
4. **Dual Pathway Cards (`PathwaysGrid.tsx`):**
   - Dual split-card layout linking to "The Creative Studio" (Light) and "The Corporate Store" (Dark).
5. **Interactive Live Proof Stage (`LiveProofStage.tsx`):**
   - Client mockup testing module: upload logo (PNG/JPEG/WEBP/SVG), select material finishes (Blue, Charcoal, Silver in flat tones), and preview before inquiry.
6. **Editorial Product Cards (`ProductShowcaseCard.tsx`):**
   - Product stage with flat muted backdrop, category label, quantity stepper (10 MOQ step), and shortlist addition.

---

## 4. Out-of-Scope

- Introducing Medusa, external commerce microservices, or headless Shopify.
- Changing font families away from `Cairo`.
- Adding client-side pricing calculators or trusting client price totals.
- Heavy GSAP animation libraries that bloat bundle size (relying instead on lightweight CSS transitions and native smooth scrolling).
- Overly flashy or neon gradients (subtle atmospheric background gradients are permitted).

---

## 5. Concrete Tasks

1. **CSS Token Extension:** Update `src/styles/globals.css` with flat v6 tokens and unified utility classes.
2. **Component Creation:**
   - Create `src/shared/ui/studio/Eyebrow.tsx`
   - Create `src/shared/ui/studio/VisualRibbon.tsx`
   - Create `src/shared/ui/studio/Ticker.tsx`
   - Create `src/shared/ui/studio/PathwaysGrid.tsx`
   - Create `src/shared/ui/studio/LiveProofStage.tsx`
   - Create `src/shared/ui/studio/ProductShowcaseCard.tsx`
   - Create barrel export `src/shared/ui/studio/index.ts`
3. **Automated Verification Tests:** Create test suite `tests/designSystemStudio.test.tsx` verifying accessibility, token binding, and component rendering.
4. **Regression Testing:** Ensure existing 439 tests continue passing.

---

## 6. Files & Modules Affected

- `plans/04-design-system.md` (This document)
- `src/styles/globals.css`
- `src/shared/ui/studio/` (New directory and components)
- `tests/designSystemStudio.test.tsx` (New verification test suite)

---

## 7. Acceptance Criteria

- [x] All colors declared strictly in `:root` CSS variables.
- [x] Zero hardcoded hex/rgb colors in components.
- [x] Subtle atmospheric background gradients permitted using `:root` variables.
- [x] Cairo font preserved strictly across Arabic and English.
- [x] Full RTL/LTR logical property compliance.
- [x] Minimum 10 units quantity stepping for B2B merchandise.
- [x] All automated tests pass with 0 regressions.

---

## 8. Rollback Strategy

All additions are modular and non-breaking:
- New CSS classes are namespaced (`studio-*`, `ui-*`, `proof-*`).
- If any issue arises, components can be rolled back via git with zero impact on the database or core Payload collections.

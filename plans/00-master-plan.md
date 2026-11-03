# MWHEBA 2.0 | Master Implementation Plan

**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Architecture Baseline:** Next.js + Payload CMS v3 + Payload Ecommerce (`@payloadcms/plugin-ecommerce`) + PostgreSQL 16+ (Candidate Stack Pending POC Gate)  
**Primary Execution Principle:** One approved phase at a time; small, verifiable, reviewable slices; server-authoritative logic.

---

## 1. Executive Summary & Strategy
MWHEBA 2.0 is a complete rebuild of `https://mwheba.com/`, unifying MWHEBA Agency's corporate presence, portfolio, bilingual marketing, and fixed-price B2B digital service packages with an e-commerce catalog of physical corporate merchandise and giveaways.

The strategy adheres strictly to a **gate-driven execution model**:
1. **Discovery & Live Audit (Phase 0):** Establish exact legacy inventory, SEO baselines, and operational parameters.
2. **Blocking Ecommerce Feasibility POC (Phase 1):** Validate the candidate stack (Payload CMS v3 + `@payloadcms/plugin-ecommerce` + PostgreSQL) in an isolated sandbox. This test validates whether the plugin can actually support custom cart fields, immutable order snapshots, separate printing charges, Cash on Delivery (COD) decoupled lifecycle and courier remittance, manual bank transfer verifications, and server-side checkout MOQ enforcement (10 units per Product ID with variant aggregation). **Do not assume plugin compatibility until demonstrated by working code. If this fails, development stops and an alternative architecture review is presented.**
3. **Phased Build-Out (Phases 2–8):** Foundation, design system, corporate CMS, commerce extensions, payments, bilingual migration, and launch hardening.

---

## 2. Phase Breakdown and Execution Order

```
[Phase 0: Discovery & Audit]
          │
          ▼
[Phase 1: Blocking Ecommerce POC] ──(Gate: Pass/Fail Evaluation)──┐
          │                                                       │ (Fail: Pivot Review)
          ▼ (Pass)                                                ▼
[Phase 2: Foundation & Infrastructure]              [Architectural Re-evaluation]
          │
          ▼
[Phase 3: Design System & UX]
          │
          ▼
[Phase 4: CMS & Corporate Website]
          │
          ▼
[Phase 5: Commerce & B2B Engine]
          │
          ▼
[Phase 6: Payments & Billing]
          │
          ▼
[Phase 7: Content & SEO Migration]
          │
          ▼
[Phase 8: Security, Testing & Launch]
```

### Phase Schedule & Dependencies Summary

| Plan Document | Execution Phase | Title | Primary Objective | Blocking Dependencies | Key Deliverable | Owner Gate |
|---|---|---|---|---|---|---|
| `plans/00-master-plan.md` | **Governance** | Master Plan | Roadmap & execution governance | None | Complete `plans/*.md` set | Yes |
| `plans/01-discovery-and-audit.md` | **Phase 0** | Discovery & Audit | Legacy inventory & business constraints | Master Plan approved | Audit dossier (`docs/audit/`), URL inventory, risk log | COMPLETED |
| `plans/02-commerce-feasibility-poc.md` | **Phase 1** | Commerce Feasibility POC | Validate Payload Ecommerce candidate against B2B needs | Phase 0 audit findings | Isolated sandbox, POC report, 12-scenario Pass/Fail matrix | COMPLETED & PASSED |
| `plans/03-foundation.md` | **Phase 2** | Foundation & Infrastructure | Monolith setup, PostgreSQL, CI/CD, RBAC | Phase 1 approved (POC passed) | Next.js/Payload scaffold, cPanel runtime checks, CI pipeline | مكتملة ومعتمدة من المالك |
| `plans/04-design-system.md` | **Phase 3** | Design System & UX | Calm, minimal, corporate RTL/LTR design system | Phase 2 foundation ready | CSS token architecture, UI primitives, layouts, commerce templates | مكتملة ومعتمدة من المالك (DES-01 إلى DES-04) |
| `plans/05-cms-and-corporate-site.md` | **Phase 4** | CMS & Corporate Site | Editor-driven marketing, portfolio, blog, leads | Phase 3 design system | Reusable blocks, dynamic pages, lead workflows | مكتملة ومعتمدة من المالك (مع ترحيل اختبار البريد الحي وضبط TRUSTED_PROXY_DEPTH كبوابتين تشغيليتين لما قبل الإطلاق) |
| `plans/06-commerce-and-b2b.md` | **Phase 5** | Commerce & B2B Engine | Physical catalog, MOQ, line-item artwork, services | Phase 4 CMS & Phase 1 POC approved | Mixed cart, line customization, order snapshots | قيد التنفيذ (جارٍ تنفيذ B2B-01) |
| `plans/07-payments-and-billing.md` | **Phase 6** | Payments & Billing | Cash on Delivery (COD) settlement, courier remittance, bank transfer | Phase 5 commerce engine approved | COD settlement engine, courier tracking, bank review, audit trails (Paymob deferred) | Yes |
| `plans/08-migration-and-seo.md` | **Phase 7** | Migration & SEO | Bilingual content migration, 301 redirects | Phase 5 Commerce & Phase 6 Payments approved | Ingested content, 301 redirect map, SEO QA report | Yes |
| `plans/09-security-testing-launch.md` | **Phase 8** | Security, Testing & Launch | E2E tests, pen-test audit, cutover, rollback runbook | Phase 7 migration verified | Production release, disaster recovery drills | Yes |

---

## 3. High-Level Governance and Quality Gates

Every phase is governed by strict Quality Gates defined in `QUALITY_GATES.md`:
1. **Server-Authoritative Enforcement:** No client-side price, customization fee, or MOQ calculations are trusted. All business rules execute on the server.
2. **Product ID-Level MOQ Enforcement at Checkout:**
   - Incomplete quantities (e.g. 5 units) are permitted to be added and persisted in the cart.
   - The cart UI explicitly indicates remaining quantities needed per Product ID.
   - Server-side validation strictly blocks order creation and payment initiation whenever any physical product in the cart fails the 10-unit minimum.
   - Variants of the same Product ID aggregate together. Different products never aggregate.
3. **Candidate Architecture Verification:** Treat Payload Ecommerce as an unproven candidate until all mandatory POC scenarios pass.
4. **Immutable Snapshots:** Line items in placed orders freeze product variant title, SKU, base price, separate customization/printing fees, printing notes, and artwork asset references at the exact moment of checkout.
5. **Payment State Separation:** Orders maintain independent, explicit dimensions:
   - Order Status (`draft`, `pending`, `confirmed`, `processing`, `completed`, `cancelled`)
   - Payment Status (`unpaid`, `pending_verification`, `paid`, `partially_refunded`, `refunded`, `failed`)
   - Fulfillment Status (`unfulfilled`, `partially_fulfilled`, `fulfilled`, `cancelled`)
6. **Payment Isolation & Private Asset Security:** Online gateway (Paymob) is formally deferred to Phase 2 (D-008). Phase 1 MVP launches with Cash on Delivery (COD) for physical merchandise and manual corporate Bank Transfer. Customer logos and assets are stored in a persistent private directory outside the cPanel web document root, accessible via short-lived signed URLs.
7. **No Automatic Phase Progression:** Implementation will pause at the conclusion of each phase to deliver verifiable evidence and await owner approval.

---

## 4. Architectural Boundaries

- **Single Application Monolith:** Next.js App Router containing both customer-facing frontend and Payload CMS v3 embedded admin under `/admin`.
- **Single Primary Database:** PostgreSQL 16+ serving both CMS collections and commerce records.
- **Native Extension Candidate:** Hypothesized extension of `@payloadcms/plugin-ecommerce` collections (`products`, `orders`, `carts`, `users`, `addresses`) to be verified in Phase 1 POC.
- **File Storage:** Persistent private filesystem directory outside `public_html` on cPanel, backed up alongside PostgreSQL; public marketing media access is controlled separately.
- **Payment & Settlement Boundary:** Standardized internal interface (`PaymentGatewayAdapter` / `SettlementService`) implemented for Cash on Delivery (COD) (with decoupled fulfillment and courier remittance states) and Manual Bank Transfer. Paymob adapter retained in a dormant state for Phase 2.
- **Accurate Records Over Premature Invoicing:** MVP focuses on pristine database order and transaction records. Automated PDF invoice generation is deferred unless legally required tax documents demand a specific format.
- **Inventory & Stock Management Strictly Excluded:** Stock counts, warehouse management, and inventory reservations are strictly out of scope for MVP (per D-018; do not invent stock numbers; do not assume made-to-order for everything; keep inventory deferred).

---

## 5. Decisions Matrix & Implementation Directives

| Decision ID | Topic | Classification | Implementation Directive |
|---|---|---|---|
| **D-005** | Payload Ecommerce Suitability | PREFERRED_PENDING_POC | Execute 12 POC scenarios in isolated sandbox; verify actual plugin extension capabilities |
| **D-007** | Dual Payment Methods (Phase 1) | **CONFIRMED** | Cash on Delivery (COD) for physical goods; Manual Bank Transfer for all orders |
| **D-008** | Online Payment Gateway (Paymob) | **DEFERRED** | Deferred to Phase 2; sandbox testing not blocking for launch; dormant modules retained |
| **D-009** | Minimum Order Quantity (MOQ) | **CONFIRMED** | 10 units per Product ID. Incomplete quantities allowed in cart; UI displays remaining needed; server strictly blocks checkout/order creation |
| **D-010** | Line-item artwork upload | **CONFIRMED** | Private local storage and immutable order link |
| **D-012** | Language Parity at Launch | OPEN | Audit existing site in Phase 0 to verify translations |
| **D-013** | Checkout Registration Flow | **CONFIRMED** | Direct inline account creation at checkout (customer sets password or uses magic link; NO temporary passwords) |
| **D-014** | Payment Schedule | **ASSUMPTION_PENDING_APPROVAL** | Working assumption: 100% full upfront payment for MVP, subject to final owner approval |
| **D-015** | Delivery Options | **CONFIRMED** | Shipping address capture or MWHEBA agency office pickup (pickup fee/terms subject to approval) |
| **D-016** | Invoicing & Tax Compliance | **CONFIRMED** | Maintain complete database financial records; flag legal tax requirements for separate review (No ETA / No PDF engine) |
| **D-017** | Customization Surcharges | **CONFIRMED** | Printing/engraving fees calculated and displayed separately from base product price |
| **D-018** | Inventory Tracking | **OUT_OF_SCOPE** | Stock management and inventory gating omitted from MVP; no assumptions regarding made-to-order |
| **D-019** | Automation / n8n | DEFERRED | Documented webhook extension points |
| **D-020** | Alternative Engine | DEFERRED | Fallback if Phase 1 POC fails |
| **D-021** | COD Scope & Restrictions | **CONFIRMED** | Restricted to physical goods; digital services & mixed carts prohibited from COD |
| **D-022** | COD Decoupling & Courier Remittance | **CONFIRMED** | Unpaid order fulfillment, explicit collection logging, courier remittance separation, idempotency |
| **D-023** | Branded Merchandise Proof Gate | **CONFIRMED** | Custom printed merchandise requires client proof approval before manufacturing |

---

## 6. Document Map

Detailed phase plans are located in the `plans/` directory:
- `plans/00-master-plan.md`: Master strategy, governance, and quality gates.
- `plans/01-discovery-and-audit.md`: Phase 0 Discovery, URL audit, and business requirements.
- `plans/02-commerce-feasibility-poc.md`: Phase 1 Blocking POC test harness with actual Paymob sandbox and cart/checkout MOQ validation.
- `plans/03-foundation.md`: Phase 2 Architecture setup, database schemas, CI/CD, and developer environment.
- `plans/04-design-system.md`: Phase 3 Calm, minimal corporate UI design system and token specification.
- `plans/05-cms-and-corporate-site.md`: Phase 4 Corporate content management, reusable blocks, and bilingual pages.
- `plans/06-commerce-and-b2b.md`: Phase 5 Catalog, line-item customizations, mixed carts, and B2B ordering.
- `plans/07-payments-and-billing.md`: Phase 6 Paymob gateway adapter, official HMAC webhooks, and bank transfer review.
- `plans/08-migration-and-seo.md`: Phase 7 Legacy content migration, asset mapping, and 301 redirect engine.
- `plans/09-security-testing-launch.md`: Phase 8 Hardening, load testing, disaster recovery, cutover, and transaction reconciliation.
- `plans/10-architecture-review.md`: Summary of findings, corrections, and Payload plugin alignment.
- `plans/11-decision-consistency-matrix.md`: Traceability matrix mapping confirmed decisions to implementation tasks.
- `plans/12-technical-risk-register.md`: Comprehensive risk assessment and mitigation register.

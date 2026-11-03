# MWHEBA 2.0 | Implementation Roadmap

## Mandatory planning output
Create `plans/00-master-plan.md` plus one detailed plan per phase listed below. Each phase must be decomposed into independently reviewable tickets with acceptance criteria and estimated complexity. Keep planning separate from implementation.

## Phase 0: Discovery and live-site audit
- Inventory current MWHEBA pages, content, forms, languages, assets and URL patterns.
- Capture business requirements, stakeholders, workflows and unanswered decisions.
- Identify existing repository code and hosting constraints.
- Deliver: audit, sitemap, prioritized backlog, risk register and URL inventory.
- Gate: owner approves scope and MVP boundaries.

## Phase 1: Blocking ecommerce feasibility POC
- Minimal isolated local sandbox, no production data.
- Validate native ecommerce plugin features and extension APIs.
- Exercise 11 Silver mugs with attached logo + 1 fixed-price service.
- Enforce MOQ 10 server-side; verify line-item metadata survives checkout.
- Prove Cash on Delivery (COD) decoupled lifecycle, collection idempotency, courier remittance reconciliation, and manual bank transfer pending flow (online gateway deferred to Phase 2 per D-008).
- Evaluate refunds, mixed fulfillment, data consistency, and admin usability (stock tracking excluded per D-018).
- Deliver: POC report, demo evidence, test matrix, gap/effort assessment, go/no-go.
- Gate: explicit owner approval of Payload Ecommerce suitability or documented pivot.

## Phase 2: Foundation
- Initialize approved app, dependency lock, PostgreSQL, local containers, environment templates.
- Establish TypeScript, lint, formatting, CI, migrations, RBAC baseline, logs, health checks.
- Deliver: reproducible local/staging setup.
- Gate: clean install/build/test and no secret leakage.

## Phase 3: Design system and UX
- Information architecture, wireframes, responsive component library.
- Arabic/English typography and RTL behavior.
- Corporate pages, product catalog, PDP, cart, checkout and account flows.
- Deliver: approved design tokens, templates and interaction specs.
- Gate: design and accessibility review.

## Phase 4: CMS and corporate website
- Reusable content blocks, navigation, localized pages, services, portfolio, blog, SEO.
- Lead forms with spam controls and notification routing.
- Deliver: editor-managed corporate website.
- Gate: editors can publish without code changes.

## Phase 5: Commerce and B2B
- Products, variants, categories, search/filtering, cart and checkout.
- MOQ, per-line-item artwork, company details, order snapshots.
- Fixed-price service packages and service brief flow.
- Deliver: end-to-end unpaid order scenarios.
- Gate: acceptance tests for physical, service and mixed carts.

## Phase 6: Payments and billing
- Implement Cash on Delivery (COD) settlement engine, courier remittance reconciliation, delivery refusal handling, pre-production proof approval gate, and bank transfer review flow (Paymob deferred to Phase 2 per D-008).
- Payment reconciliation, idempotency, refund audit logs and invoice integration boundary.
- Deliver: verified end-to-end payment and cash settlement scenarios.
- Gate: finance/security approval, no duplicate charge, zero cash collection leakage, and no false-paid status.

## Phase 7: Content and SEO migration
- Content import, media mapping, bilingual URL map, redirects, canonical/hreflang.
- Deliver: migration scripts and SEO QA report.
- Gate: redirect and content parity tests.

## Phase 8: Security, performance and launch
- E2E, load, security, backup/restore, operational runbooks and staging UAT.
- Production release with rollback and monitoring.
- Deliver: launch checklist, incident playbook, handover documentation.
- Gate: owner sign-off and tested rollback.

## Ticket template
For each ticket:
- ID and title
- Business outcome
- Dependencies
- Scope / out of scope
- Implementation approach
- Files/modules impacted
- Database changes
- Acceptance criteria
- Test cases
- Security/SEO implications
- Estimate and risk
- Rollback
- Owner approval required? yes/no

## Prioritization
P0 = blocks commercial correctness, security, or POC.
P1 = required for launch.
P2 = valuable enhancement.
P3 = post-launch opportunity.

## Execution policy
Never start the next phase automatically. After each approved phase, report evidence, deviations, tests and next-phase prerequisites.

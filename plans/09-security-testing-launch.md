# MWHEBA 2.0 | Phase 8: Security, Testing and Launch Plan

**Phase:** Phase 8  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Goal:** Conduct exhaustive end-to-end testing, security penetration auditing, load benchmarking, backup/restoration disaster drills, staging User Acceptance Testing (UAT), production cutover execution, and establish operational incident runbooks with a **realistic production rollback and transaction-reconciliation strategy**.

---

## 1. Overview & Context

Phase 8 is the final quality and deployment gate before opening MWHEBA 2.0 to corporate clients and search crawlers. No code is deployed to production without completing the rigorous validation layers mandated in `QUALITY_GATES.md` (Unit, Integration, E2E, Security, Regression, and Operational drills).

Crucially, **DNS switching alone is not a valid rollback strategy**. DNS propagation delays vary unpredictably across regional Egyptian ISPs and corporate resolvers regardless of TTL settings. If a rollback occurs after new orders or payments have been processed on the new platform, a naive DNS reversal causes catastrophic data desynchronization (customers charged on Paymob without records in the legacy site). A complete rollback strategy must include read-only cutover states, live Paymob transaction polling, data export, and customer outreach protocols.

- **Dependencies:** Completion and owner approval of Phases 0 through 7.
- **Scope:**
  - Automated End-to-End (E2E) testing of complete user journeys (browse -> customize -> cart -> checkout -> payment -> fulfillment).
  - Explicit testing of final MOQ rules: cart persistence of incomplete quantities, variant aggregation (5 Black + 5 White = Valid), under-MOQ checkout blockage (9 units), and cross-product isolation (5 of A + 5 of B = Blocked at checkout).
  - Security and hardening audit (OWASP Top 10, upload abuse, privilege escalation, webhook spoofing, rate limiting, and dependency vulnerability scans).
  - Performance & Core Web Vitals benchmarking under simulated corporate user traffic.
  - Disaster recovery drills: PostgreSQL automated backup and point-in-time recovery test.
  - Production deployment runbook with DNS cutover, SSL provisioning, compliant smoke test, and a **comprehensive transaction-reconciliation rollback protocol**.
  - Post-launch monitoring, error tracking, and administrative handover documentation.
- **Out of Scope:**
  - Ongoing post-launch marketing campaigns.
  - Unscheduled changes to production during live traffic.

---

## 2. Work Breakdown & Concrete Tasks

### Ticket REL-01: End-to-End Acceptance Test Automation
- **ID & Title:** REL-01: End-to-End Test Suite Automation
- **Business Outcome:** Proven, repeatable verification that all critical user journeys work seamlessly across desktop and mobile devices.
- **Dependencies:** All previous functional tickets.
- **Scope:**
  - Implement Playwright test suite in `tests/e2e/`:
    1. **E2E-01 (Corporate Lead):** Visitor navigates to `/ar/services/branding`, fills out lead form with Arabic text, submits, verifies thank-you message and database record.
    2. **E2E-02 (Cart Persistence & Variant Aggregation Purchase):**
       - Step 1: Buyer adds 5 Black mugs of `Product A` to empty cart. Verifies cart persists 5 units and UI displays "5 more units required".
       - Step 2: Buyer updates quantity to 6, then 4, verifying cart state updates cleanly.
       - Step 3: Buyer adds 6 White mugs of `Product A` (total 10 units: 4 Black + 6 White mugs of Product A). Verifies cart UI enables checkout and displays separate printing fee.
    3. **E2E-03 (Checkout MOQ Enforcement & Cross-Product Isolation):**
       - **Test 3A (Below MOQ Checkout Block):** Cart has 9 units of Product A. Buyer attempts to proceed to checkout or triggers checkout API directly -> Verifies server rejects order creation with HTTP 422.
       - **Test 3B (Cross-Product Isolation):** Buyer adds 5 units of `Product A` + 5 units of `Product B`. Both persist in cart. Buyer attempts checkout -> Verifies server strictly blocks checkout because neither product independently satisfies the 10-unit minimum for its Product ID.
    4. **E2E-04 (Mixed Cart Checkout):** Adds Brand Identity Service (qty 1) to cart containing 10 mugs; completes checkout with Paymob test card; asserts order status transitions to `confirmed` and payment status to `paid` through multi-assertion verification.
    5. **E2E-05 (Bank Transfer Review):** Places order via bank transfer; uploads fake receipt; logs into `/admin` as finance officer; reviews submission and approves; asserts order transitions to `paid`.
    6. **E2E-06 (Bilingual Switching):** Toggles between Arabic and English across all pages; checks layout direction (`rtl`/`ltr`) and URL structure.
    7. **E2E-07 (Payment Security, Multi-Assertion & Webhook Concurrency):**
       - Simulates tampered payment amount in callback (e.g. 10 EGP instead of order total) -> asserts order remains unpaid and state is frozen as `amount_mismatch`.
       - Simulates duplicate webhook delivery and retry after simulated downtime -> asserts exactly 1 state transition and idempotent HTTP 200 responses.
       - Simulates customer redirecting before webhook arrives -> asserts browser view renders "Verifying..." without prematurely marking paid.
    8. **E2E-08 (4-Tier Legacy URL Status Audit):** Automated crawler visits all 54 legacy URLs, asserting HTTP 200 for `PRESERVE`, HTTP 301 for `REDIRECT_301` to clean non-trailing-slash targets, and HTTP 410 for `GONE_410`.
- **Out of Scope:** Testing third-party banking internal networks.
- **Implementation Approach:** Playwright test runner executing against staging environment.
- **Files/Modules Impacted:** `tests/e2e/`, `playwright.config.ts`.
- **Database Changes:** Ephemeral test database fixtures.
- **Acceptance Criteria:**
  - 100% of E2E tests pass reliably in headless CI runner without flakiness.
- **Test Cases:** Run `npm run test:e2e` in CI pipeline.
- **Security/SEO Implications:** Validates complete transaction pipeline before real money is accepted.
- **Estimate & Risk:** 2.5 days. Medium risk.
- **Rollback:** Block release until failing scenarios are resolved.
- **Owner Approval Required:** Yes.

---

### Ticket REL-02: Security Audit & Penetration Hardening
- **ID & Title:** REL-02: Security Audit, Upload Sanitization & Privilege Hardening
- **Business Outcome:** Total immunity against common web exploits, data theft, customer PII exposure, and malicious file execution.
- **Dependencies:** REL-01.
- **Scope:**
  - Input & File Upload Hardening:
    - Attempt uploading polyglot files (e.g., PHP/JS scripts wrapped inside an image header); verify server rejection.
    - Assert that uploaded files are served with `Content-Disposition: attachment` or strict sandbox headers preventing script execution in browser context.
  - Authorization & Access Control:
    - Test horizontal privilege escalation: Customer A attempts to view or download Customer B's order snapshot and artwork; assert HTTP 403.
    - Test vertical privilege escalation: Customer attempts to mutate order status via direct API post; assert HTTP 403.
  - Webhook Hardening:
    - Send forged Paymob webhook payloads with mismatched HMAC or manipulated fields; assert immediate HTTP 401 rejection and zero state mutation.
  - Rate Limiting & DoS Protection:
    - Stress-test lead forms and checkout endpoints with 100 rapid requests; assert HTTP 429 Too Many Requests response.
  - Dependency Audit:
    - Run `npm audit` and vulnerability scanners; eliminate all moderate, high, and critical CVEs.
- **Out of Scope:** Physical datacenter penetration testing.
- **Implementation Approach:** Automated security testing scripts and manual penetration attempts.
- **Files/Modules Impacted:** `src/middleware.ts`, `src/lib/rateLimit.ts`, `src/modules/customization/lib/fileValidation.ts`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Zero critical or high vulnerabilities in security audit.
  - Strict Content Security Policy (CSP), HSTS, and X-Content-Type-Options headers active on all responses.
- **Test Cases:** Automated penetration test script asserting 401/403/429 responses to simulated attacks.
- **Security/SEO Implications:** Essential brand protection for an established agency.
- **Estimate & Risk:** 2 days. High strategic importance.
- **Rollback:** Revert and patch identified vulnerabilities immediately.
- **Owner Approval Required:** Yes (Mandatory Owner Gate).

---

### Ticket REL-03: Performance Optimization & Core Web Vitals Benchmark
- **ID & Title:** REL-03: Performance Benchmarking & Caching Optimization
- **Business Outcome:** Ultra-fast page loads on mobile 4G networks across Egypt, maximizing user conversion and search engine quality scores.
- **Dependencies:** REL-01.
- **Scope:**
  - Execute Google Lighthouse and Core Web Vitals audits across key pages (Home, PDP, PLP, Case Study, Checkout).
  - Verify performance metrics meet target budgets:
    - LCP <= 2.0s
    - INP <= 100ms
    - CLS <= 0.05
  - Optimize caching strategies: Next.js Cache, ISR tags for catalog and content collections, and static CDN asset caching (`stale-while-revalidate`).
  - Optimize image rendering: AVIF/WebP responsive sizes, proper `sizes` attributes, and lazy loading below the fold.
- **Out of Scope:** Edge computing outside standard Cloudflare/CDN routing.
- **Implementation Approach:** Lighthouse CLI and PageSpeed Insights API run on staging.
- **Files/Modules Impacted:** `next.config.mjs`, `src/app/`, `src/shared/ui/`.
- **Database Changes:** Database index tuning based on slow query logs (`EXPLAIN ANALYZE`).
- **Acceptance Criteria:**
  - Lighthouse Performance score >= 90 on desktop and >= 80 on mobile.
  - Zero layout shifts during page loading (CLS < 0.05).
- **Test Cases:** Automated Lighthouse CI runs against staging pages.
- **Security/SEO Implications:** Direct ranking factor in Google search algorithm.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert caching configurations.
- **Owner Approval Required:** No.

---

### Ticket REL-04: Disaster Recovery Drill & Database Backup Runbook
- **ID & Title:** REL-04: Automated Backups & Disaster Recovery Drill
- **Business Outcome:** Proven disaster recovery capability with verifiable RPO <= 1 hour and RTO <= 30 minutes demonstrated via empirical staging restoration drill.
- **Dependencies:** FND-02.
- **Scope:**
  - Configure automated daily PostgreSQL logical backups (`pg_dump`) and off-site backup copies where supported by the host.
  - Configure daily backup copies of the private artwork and media directory and test restoration with the database snapshot.
  - Execute mandatory Disaster Recovery Drill:
    1. Spin up clean PostgreSQL instance.
    2. Restore database from latest backup snapshot.
    3. Mount restored database to staging application container.
    4. Verify 100% data integrity (users, products, placed orders, uploaded artwork links).
    5. Document recovery duration (Recovery Time Objective: < 30 minutes; Recovery Point Objective: < 1 hour).
  - Document Disaster Recovery Runbook: `docs/ops/disaster-recovery.md`.
- **Out of Scope:** Multi-region active-active database clustering.
- **Implementation Approach:** Automated shell scripts executed via cron or managed cloud backup service.
- **Files/Modules Impacted:** `src/scripts/ops/backup.sh`, `src/scripts/ops/restore.sh`, `docs/ops/disaster-recovery.md`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Complete database successfully restored in staging drill in under 15 minutes with zero lost records.
  - Backup scripts alert on failure via Slack or email.
- **Test Cases:** Intentionally trigger simulated restore and compare row counts across all tables.
- **Security/SEO Implications:** Backups are encrypted at rest with AES-256.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** N/A.
- **Owner Approval Required:** Yes.

---

### Ticket REL-05: Production Cutover, Realistic Rollback & Transaction Reconciliation
- **ID & Title:** REL-05: Cutover Protocol, Smoke Test & Transaction Reconciliation Runbook
- **Business Outcome:** Controlled, zero-downtime cutover with verified smoke tests respecting business rules, and a tested transaction reconciliation strategy if rollback is triggered.
- **Dependencies:** REL-01 through REL-04, Phase 7 complete.
- **Scope:**
  - Pre-Cutover Preparation:
    - Put legacy WordPress site in **maintenance / read-only mode** (disabling contact form submissions) to freeze legacy data.
    - Perform final incremental content sync to PostgreSQL.
    - Configure the persistent private upload directory outside `public_html`; Paymob credentials remain deferred to Phase 2.
    - Lower DNS TTL to 300 seconds 48 hours prior to launch.
  - Cutover Execution:
    1. Switch DNS records to point to the new production Next.js/Payload server.
    2. Verify SSL certificate issuance and 4-tier URL status routing (asserting HTTP 200 for PRESERVE, 301 for REDIRECT_301, 410 for GONE_410) with zero redirect chains.
    3. Run automated health check `/api/health`.
    4. **Compliant Smoke Test:** Execute 1 live end-to-end smoke test on an authorized internal testing SKU that **strictly respects the 10-unit Product ID MOQ** at an authorized testing amount agreed upon with the owner, followed by an immediate refund.
  - **Realistic Rollback & Transaction Reconciliation Protocol:**
    - If a critical platform failure occurs within the cutover window:
      1. **Freeze New Orders:** Place new Next.js platform into maintenance mode (returning friendly maintenance banner to prevent new transactions).
      2. **Capture In-Flight Paymob Transactions:** Query Paymob dashboard API for all successful charges initiated during the cutover window. Reconcile transaction IDs against the PostgreSQL `orders` table.
      3. **Export New Leads & Inquiries:** Export any newly submitted lead forms or customer accounts from PostgreSQL to CSV for agency sales follow-up.
      4. **DNS Reversion:** Revert DNS records to legacy server IP (noting that regional ISP DNS caching may delay global propagation, making manual outreach mandatory).
      5. **Manual Customer Outreach:** For any paid order completed during the cutover window, notify customer and order operations manually with full transaction evidence.
- **Out of Scope:** Real-time multi-master database replication back to legacy WordPress.
- **Implementation Approach:** Documented, rehearsed cutover runbook in `docs/ops/cutover-and-reconciliation.md`.
- **Files/Modules Impacted:** `docs/ops/cutover-and-reconciliation.md`, `docs/ops/rollback-runbook.md`.
- **Database Changes:** Production database goes live.
- **Acceptance Criteria:**
  - Smoke test executed with 10 units conforming strictly to Product ID MOQ rules without hardcoded arbitrary amounts.
  - Rollback runbook explicitly details step-by-step transaction reconciliation procedures.
  - Zero lost customer payments or unaccounted charges in any scenario.
- **Test Cases:** Dry run of cutover checklist and transaction reconciliation script in staging.
- **Security/SEO Implications:** Full production cutover.
- **Estimate & Risk:** 2.5 days. Critical strategic importance.
- **Rollback:** Execute documented reconciliation and DNS reversion runbook.
- **Owner Approval Required:** Yes (Mandatory Owner Cutover Sign-off).

---

## 3. Post-Launch Operational Handover
- Deliver administrative handover guide `docs/handover/admin-guide.md` covering:
  - Publishing blog posts and landing pages.
  - Managing physical products, variants, and service packages.
  - Processing placed orders, reviewing uploaded vector logos, and marking fulfillment.
  - Verifying bank transfers and reviewing Paymob transaction records.
- Establish weekly maintenance schedule for dependency updates and security patches.

---

## 4. Phase Exit & Final Project Launch Gate
1. All quality gates in `QUALITY_GATES.md` satisfied.
2. Formal Owner Gate Sign-off: "Production Cutover Approved. Go Live."

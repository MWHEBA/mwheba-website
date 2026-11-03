# MWHEBA 2.0 | Technical & Operational Risk Register

**Document:** `plans/12-technical-risk-register.md`  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Purpose:** Rank, monitor, and mitigate all identified architectural, financial, operational, and security risks across the project lifecycle.

---

## 1. Risk Evaluation Matrix

Risks are scored on **Severity** (1–5) and **Likelihood** (1–5), resulting in a **Risk Priority Number (RPN = Severity × Likelihood)**.

- **High Priority (RPN >= 15):** Requires mandatory architectural safeguards and blocking quality gates.
- **Medium Priority (RPN 8–14):** Requires automated testing and operational runbooks.
- **Low Priority (RPN <= 7):** Standard development precautions.

---

## 2. Ranked Technical & Operational Risk Register

| Rank | Risk ID | Category | Risk Description | Severity (1-5) | Likelihood (1-5) | RPN | Mitigation Strategy | Monitoring & Contingency |
|---|---|---|---|---|---|---|---|---|
| **1** | **RSK-01** | Architecture | **Payload Ecommerce Plugin Extension Limits:** Candidate plugin cannot natively accommodate line-item artwork snapshots, cart resilience, or custom fee lines without brittle monkey-patching. | 5 | 3 | **15** | Isolate testing strictly in **Phase 1 POC (blocking gate)** before building corporate pages. If plugin fails, pivot immediately to custom PostgreSQL commerce models or Medusa. | Formal POC evaluation report with go/no-go recommendation by ticket POC-TSK-05. |
| **2** | **RSK-02** | Financial | **COD Cash Collection Leakage & Courier Reconciliation Delay:** Courier fails to remit collected funds, or duplicate collection calls corrupt accounting balances. (Paymob online gateway deferred to Phase 2 per D-008). | 5 | 2 | **10** | Implement **two-stage collection accounting** (`collected_by_courier` vs `remitted_to_company`), explicit courier tracking references, idempotent collection API with PostgreSQL locks, and weekly aging audit reports in `/admin`. | Automated ledger audits flagging unreconciled collections > 7 days. |
| **3** | **RSK-02B** | Operational / Cost | **Custom Branded Merchandise Refusal at Delivery:** Client refuses delivery of custom printed goods, causing unrecoverable manufacturing costs. | 4 | 3 | **12** | Enforce **mandatory pre-production proof approval gate (`proof_approved`)** by client and agency before orders can transition to `in_production`; require phone/WhatsApp confirmation before dispatch. | Audit trail tracking proof approval timestamps and confirmation signatures. |
| **3** | **RSK-03** | Operational | **Production Rollback Data Desynchronization:** Reverting DNS to legacy site after live launch orphans orders placed and paid on the new platform due to regional ISP caching delays. | 5 | 3 | **15** | Implement **multi-stage cutover & reconciliation runbook (REL-05)**: legacy site placed in read-only mode; automated script queries Paymob API for all charges in cutover window; lead/order export before DNS reversion. | Reconciliation script tested in staging; rollback rehearsal executed prior to go-live. |
| **4** | **RSK-04** | Security | **Malicious File Upload via Customization Dropzone:** Attacker uploads executable malware or polyglot files disguised as company logos (`.svg`, `.pdf`, `.png`). | 5 | 2 | **10** | Inspect magic bytes (file signatures) server-side; restrict max file size to 50MB; store files outside `public_html` with no public execution; serve via short-lived signed URLs with `Content-Disposition: attachment`. | Automated security integration tests in REL-02 attempting polyglot uploads. |
| **5** | **RSK-05** | SEO | **Legacy URL 404 Spikes & Rank Degradation:** Google indexes broken links or drops keyword rankings due to missing 301 redirects during domain cutover. | 4 | 2 | **8** | Crawl 100% of live URLs in **Phase 0 (AUD-01)**; implement high-performance edge redirect map in Next.js middleware (MIG-03); execute pre-launch crawler verifying zero 404s. | Google Search Console coverage monitoring active for 72 hours post-launch. |
| **6** | **RSK-06** | Operational | **Bank Transfer Slip Forgery:** Customer uploads fake transfer receipt or photoshopped payment slip to bypass checkout. | 4 | 2 | **8** | Orders with bank transfer initialize strictly in `pending_verification`; receipt upload alone **never marks order paid**; verification requires authorized finance officer entering bank reconciliation code. | Audit log records finance officer ID and bank reference on every approval. |
| **7** | **RSK-07** | Performance | **Slow Mobile Performance on 4G Egyptian Networks:** High asset payload or unoptimized images slow mobile checkout conversions. | 3 | 2 | **6** | Flat color design system (zero heavy gradient libraries); responsive WebP/AVIF image generation; server-rendered components with minimal client JS; strict Core Web Vitals budget (LCP <= 2.0s). | Automated Lighthouse CI checks running on every staging pull request. |
| **8** | **RSK-08** | Infrastructure | **PostgreSQL Connection Exhaustion under Concurrency:** Spikes in checkout traffic saturate PostgreSQL connection limits. | 4 | 1 | **4** | Configure connection pooling (PgBouncer) and tune `@payloadcms/db-postgres` pool size; cache static CMS blocks via Next.js ISR. | Health check endpoint `/api/health` monitors active database connection count. |

---

## 3. Risk Governance & Escalation
- Any discovery during implementation that increases an RPN score above 14 will immediately trigger an **Architecture Review Pause**.
- Work will not proceed past Phase 1 until **RSK-01 (Payload Ecommerce Plugin Limits)** is formally retired through pass/fail evidence in `docs/poc/feasibility-report.md`.

# MWHEBA 2.0 | Master Execution Plan & Architecture Governance

> **Document Status:** Authoritative Master Plan & Execution Ledger  
> **Architecture Stack:** Next.js `16.4.5` (App Router + Turbopack) / Payload CMS `3.91.0` / PostgreSQL 16+  
> **Target Host:** CloudLinux / cPanel (Apache + Phusion Passenger) / Node.js 24.13.0+ LTS  
> **Status:** Local Implementation & Verification COMPLETED (Phases 0–8); Staging & Cutover Pending Server Window  

---

## 1. Project Roadmap & Phase Completion Ledger

```
[Phase 0: Discovery & Audit]            ──► COMPLETED (54 URLs, 4-tier redirect matrix)
[Phase 1: Commerce Feasibility POC]     ──► COMPLETED & APPROVED (Track 1A Adopted, Track 1B Rejected)
[Phase 2: Foundation & Infrastructure]  ──► COMPLETED (PostgreSQL monolith, RBAC, migrations)
[Phase 3: Design System & UX]           ──► COMPLETED & APPROVED (Minimal corporate, flat, RTL/LTR)
[Phase 4: CMS & Corporate Website]      ──► COMPLETED (Dynamic builder, blog, portfolio, inquiries)
[Phase 5: Commerce & B2B Engine]        ──► COMPLETED (MOQ 10, line artwork, service intake, snapshots)
[Phase 6: Payments & Billing]           ──► COMPLETED (Decoupled COD, courier remittance, bank review)
[Phase 7: Content & SEO Migration]      ──► COMPLETED (5 authentic assets, 66 redirect tests, Schema)
[Phase 8: Security & Testing]           ──► COMPLETED LOCALLY (Next 16.4.5, sharp 0.35.5, 439 tests)
```

### Milestone Summary:

| Phase | Core Objective | Key Deliverables & Enforcements | Verification & Proof | Status |
|---|---|---|---|---|
| **Phase 0** | Legacy Audit & Inventory | 54 legacy URLs cataloged, 4-tier action matrix, asset provenance. | `docs/audit/LEGACY_AUDIT_SUMMARY.md`, `05-redirect-map.csv` | **COMPLETED** |
| **Phase 1** | Commerce Feasibility POC | Evaluated candidate stacks; rejected plugin; approved custom Payload collections. | 12/12 blocking scenarios passed; `docs/poc/feasibility-report.md` | **COMPLETED** |
| **Phase 2** | Monolith Foundation | Next.js App Router, Payload embedded at `/admin`, PostgreSQL migrations, RBAC. | `tests/rbac.test.ts`, clean CI installation direct from lockfile | **COMPLETED** |
| **Phase 3** | Design System & UX | Calm corporate styling, CSS variables in `:root`, flat colors, zero gradients, RTL/LTR. | `tests/components.test.tsx`, `tests/commerceTemplates.test.tsx` | **COMPLETED** |
| **Phase 4** | CMS & Corporate Site | Dynamic corporate pages, portfolio, blog, honeypot lead forms, transactional emails. | `tests/cms*.test.tsx` (all passing) | **COMPLETED** |
| **Phase 5** | B2B Commerce Engine | Mixed-variant MOQ 10, private line-item artwork, separate printing fees, snapshots. | `tests/b2b*.test.ts` (all passing) | **COMPLETED** |
| **Phase 6** | Payments & Billing | Decoupled COD fulfillment/payment, idempotent remittance, manual bank verification. | `tests/pay*.test.ts` (all passing) | **COMPLETED** |
| **Phase 7** | Content & SEO Migration | Ingested services/posts/portfolio, 66 automated redirect tests, JSON-LD Schema. | `tests/mig*.test.ts` (all passing) | **COMPLETED** |
| **Phase 8** | Security & Launch Hardening | Next 16 upgrade (0 Next CVEs), sharp 0.35.5, local backup/restore drill in 1.68s. | 30 test files / 439 tests passed, Turbopack build passed | **COMPLETED LOCALLY** |

---

## 2. Architectural Boundaries & Non-Negotiable Directives

1. **Server-Authoritative Enforcement:** Client-side prices, discounts, and MOQ calculations are never trusted. All calculations are executed on the server.
2. **Product ID-Level MOQ Enforcement:** Minimum 10 units per Product ID. Variants of the same product (colors, sizes) count together. Cross-product pooling is strictly rejected. Sub-MOQ quantities persist in the cart with clear shortage guidance; order placement is blocked until met.
3. **Immutable Order Snapshots:** When an order is placed, line items freeze product variant titles, SKU, base unit price, separate printing fee, printing notes, and artwork references. Subsequent catalog or price edits never alter past orders.
4. **Decoupled COD Lifecycle:** Advancing fulfillment status (`shipped`, `delivered`) strictly preserves `paymentStatus: unpaid`. Marking an order paid requires an explicit cash collection event recorded with a receipt reference.
5. **Private Asset Isolation:** Sensitive user artwork and bank transfer deposit slips are stored in a private directory outside the web root, accessible only via time-limited HMAC-signed URLs.
6. **No ETA E-Invoicing / No PDF Generator in MVP:** Accurate database financial records and audit ledgers are maintained. Physical invoices are deferred for accountant review.
7. **Zero Browser Automation:** Browser testing is strictly reserved for manual verification by the human project owner.

---

## 3. Decision Traceability Summary (ADRs D-001 to D-023)

- **D-001 to D-004:** Full rebuild as a single monolith with Next.js, Payload CMS, and PostgreSQL. Confirmed and delivered.
- **D-005 to D-006:** Evaluated Payload Ecommerce; custom collections adopted on PostgreSQL. Confirmed and delivered.
- **D-007 to D-008:** Phase 1 launches with COD and manual bank transfer. Paymob online card gateway deferred to Phase 2 (adapter kept dormant).
- **D-009:** MOQ is 10 units per Product ID with variant aggregation. Confirmed and enforced.
- **D-010 to D-011:** Line-item vector artwork upload; mixed cart (physical goods + digital services) supported. Confirmed and delivered.
- **D-013:** Inline user registration during checkout without temporary passwords. Confirmed and delivered.
- **D-015:** Both courier shipping and MWHEBA Agency office pickup supported. Confirmed and delivered.
- **D-016 to D-017:** Separate printing fee line calculation; automated PDF invoices omitted for MVP. Confirmed and delivered.
- **D-018:** Stock counts and warehouse management omitted for MVP. Confirmed and delivered.
- **D-021 to D-023:** Decoupled COD; pre-production proof approval gate for customized merchandise. Confirmed and delivered.

---

## 4. Technical Risk Mitigation Summary (RSK-01 to RSK-08)

| Risk ID | Description | Resolution Strategy | Active Defense |
|---|---|---|---|
| **RSK-01** | Payload Ecommerce Plugin Limitations | Replaced candidate plugin with custom Payload collections. | Tested in `tests/b2b*.test.ts`. |
| **RSK-02** | Cart MOQ Bypass at Checkout | Server-side validation gate rejects orders with $<10$ units. | Enforced in Server Actions & API routes. |
| **RSK-03** | COD Premature Paid State Mutation | Independent status dimensions; transition hooks block direct manual mutation. | Tested in `tests/pay01CodEngine.test.ts`. |
| **RSK-04** | Bank Transfer Concurrency Race | Row locking (`FOR UPDATE`) serializes verification attempts. | Tested in `tests/pay03BankTransfer.test.ts`. |
| **RSK-05** | Production Data Loss | Local backup & restore scripts (`backup.ps1`, `backup.sh`). | Tested in DR drill; Contabo VM snapshot required. |
| **RSK-06** | SEO Link Equity Loss | 4-tier action matrix and master redirect compiler (`redirects.json`). | 66 automated tests in `tests/mig03RedirectMatrix.test.ts`. |
| **RSK-07** | Sensitive Artwork Exposure | Storage outside web root; time-limited HMAC signed URL tokens. | Tested in `tests/b2bArtworkAssets.test.ts`. |
| **RSK-08** | Supply-Chain Vulnerabilities | Upgraded to Next 16.4.5; sharp 0.35.5; undici/dompurify/postcss overrides. | Verified in `docs/ops/production-dependencies-audit.md`. |

---

## 5. Pre-Launch Hosting & Operational Gates

The following operational gates remain open for the production deployment window:
1. **Contabo VM Snapshot:** Owner takes VM backup before server maintenance.
2. **Server OS & Node 24 Upgrade:** Update CloudLinux and ensure Node.js 24.13.0+ LTS is active.
3. **Phusion Passenger Staging Deploy:** Test live PostgreSQL socket connectivity and upload directory permissions.
4. **Owner Visual UX Inspection:** Manual walkthrough in a real browser.
5. **Real SMTP Configuration:** Supply production SMTP credentials for transactional emails.
6. **Accountant VAT Sign-Off:** Confirm applicable B2B tax rate.
7. **Official Bank Details:** Supply official IBAN and account holder details for bank transfer instructions.

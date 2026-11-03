# MWHEBA 2.0 | Phase 0: Discovery and Live-Site Audit Plan

**Phase:** Phase 0  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Goal:** Establish an authoritative audit of the live `https://mwheba.com/` website, document existing content hierarchies, catalog assets, identify SEO URL patterns and technical redirects, capture stakeholder requirements, and finalize operational logistics prior to codebase initialization.

---

## 1. Overview & Context

Before developing new schemas or migrating assets, we must systematically audit the existing `mwheba.com` live site. This minimizes organic search transition risks, ensures existing customer inquiries or service descriptions are not lost, identifies active analytics/pixels, and aligns technical implementation with true operational capacity.

- **Dependencies:** Approval of `plans/00-master-plan.md`.
- **Phase 0 Prerequisites (Exact requirements before starting):**
  - Owner approval of `plans/00-master-plan.md` and this Phase 0 plan.
  - Read-only access or sitemap URL of `https://mwheba.com/`.
  - Designated MWHEBA stakeholder for the 1-hour alignment interview (AUD-04).
  - Existing Google Analytics / GTM measurement IDs or dashboard read-only access.
- **Scope:**
  - Crawling and cataloging all published URLs, language alternates, canonical tags, and meta descriptions on `https://mwheba.com/`.
  - Auditing existing contact forms, tracking scripts (Google Analytics, GTM, Meta Pixel), and third-party embeds.
  - Cataloging legacy media assets (images, logos, PDF brochures).
  - Clarifying remaining operational details (launch language parity, governorate shipping rates, payment schedule confirmation, pickup terms) with the project owner.
  - Formulating a risk register and 301 redirect inventory mapping.
- **Out of Scope:**
  - Writing code or automated scrapers that overload the live production server.
  - Making changes to the live DNS, hosting server, or WordPress/legacy backend.
  - Migrating content into Payload (deferred to Phase 7).

---

## 2. Work Breakdown & Concrete Tasks

### Ticket AUD-01: Live Website Crawl, Content Inventory & Sitemap Extraction
- **ID & Title:** AUD-01: Live Website Crawl & URL Mapping
- **Business Outcome:** Comprehensive inventory of currently discoverable public URLs and documented GSC access requirements to map 301 redirects and preserve organic search signals.
- **Dependencies:** None.
- **Scope:**
  - Enumerate all public URLs across both Arabic and English sections of `https://mwheba.com/`.
  - Extract page hierarchy: Home, About Us, Services, Portfolio/Projects, Blog/Articles, Contact, and any hidden landing pages.
  - Record metadata per URL: HTTP status, canonical tag, hreflang tags, title tag, meta description, and primary H1.
- **Out of Scope:** Scraping password-protected admin pages.
- **Implementation Approach:** Perform non-intrusive sitemap extraction (`sitemap.xml`, `robots.txt`) and polite web inspection. Compile into `docs/audit/02-url-inventory.csv`.
- **Files/Modules Impacted:** `docs/audit/02-url-inventory.csv`, `docs/audit/01-website-inventory.md`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - 100% of publicly discoverable URLs cataloged with response codes and canonical targets.
  - Identification of whether the legacy site uses subdirectories (`/ar/`, `/en/`) or subdomains for localization.
- **Test Cases:**
  - Verify every URL in the generated inventory responds with a valid HTTP status code.
  - Check for orphan pages or broken internal links on the live site.
- **Security/SEO Implications:** Measurable mitigation of post-launch 404 spikes and preservation of link equity through 1:1 redirect planning.
- **Estimate & Risk:** 1.5 days. Low risk (read-only inspection).
- **Rollback:** Delete generated audit Markdown/CSV files.
- **Owner Approval Required:** Yes (to confirm URL inventory completeness).

---

### Ticket AUD-02: Lead Forms, Integrations & Third-Party Audit
- **ID & Title:** AUD-02: Forms, Integrations, and Tracking Audit
- **Business Outcome:** Ensure full continuity and verification of active marketing pixels, GTM tags, and lead capture routing in the new platform.
- **Dependencies:** AUD-01.
- **Scope:**
  - Inspect all existing contact and inquiry forms on `mwheba.com`.
  - Identify destination emails, CRM integrations, or webhook handlers receiving lead submissions.
  - Document all active analytics and marketing tags (e.g., GTM-XXXX, GA4 measurement IDs, Meta Pixel, Hotjar).
- **Out of Scope:** Reconfiguring existing Google Analytics properties or modifying third-party dashboards.
- **Implementation Approach:** Inspect page source, network payloads on form submission, and review tracking containers. Document findings in `docs/audit/integrations-audit.md`.
- **Files/Modules Impacted:** `docs/audit/integrations-audit.md`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Every form input field (name, phone, company, service requested, budget, message) is cataloged.
  - Verification of whether email notifications are sent via SMTP, Brevo, SendGrid, or direct server mail.
  - Complete list of tracking IDs recorded for migration into the Next.js header management system.
- **Test Cases:**
  - Test submission on staging/live form to trace exact email delivery and thank-you page redirects.
- **Security/SEO Implications:** Ensures privacy compliance regarding cookies and tracking scripts.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** N/A.
- **Owner Approval Required:** Yes.

---

### Ticket AUD-03: Media & Creative Asset Audit
- **ID & Title:** AUD-03: Media and Branding Asset Catalog
- **Business Outcome:** Identification and preservation of high-resolution brand assets, client logos, portfolio photography, and product imagery.
- **Dependencies:** AUD-01.
- **Scope:**
  - Inventory existing media libraries: project portfolio images, client logos, branding banners, and downloadable agency profiles/brochures.
  - Check image formats, typical dimensions, and compressions used.
  - Note presence of legacy PDF downloads (e.g., company profile, service catalogs).
- **Out of Scope:** Downloading raw design project source files without owner request.
- **Implementation Approach:** Compile asset index into `docs/audit/asset-inventory.md`.
- **Files/Modules Impacted:** `docs/audit/asset-inventory.md`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Document storage sizes and formats.
  - Establish a clean folder structure for private filesystem storage on cPanel.
- **Test Cases:**
  - Validate that critical brand assets (MWHEBA logos, vector marks) exist in high-resolution vector (SVG) or lossless format.
- **Security/SEO Implications:** Image file names and alt attributes analyzed for image SEO preservation.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** N/A.
- **Owner Approval Required:** No.

---

### Ticket AUD-04: Business Alignment & Logistics Workshop
- **ID & Title:** AUD-04: Stakeholder Interview & Operational Alignment
- **Business Outcome:** Finalize operational shipping rates, pickup terms, payment schedule confirmation, and language parity prior to Phase 1 POC and Phase 2 Foundation.
- **Dependencies:** None.
- **Scope:**
  - Formal review with MWHEBA management covering:
    1. **Launch Language Parity (D-012):** Confirm if Arabic and English must have 100% 1:1 page parity on day 1, or if primary launch focus is Arabic with key English corporate pages.
    2. **Shipping & Pickup Rate Structure (D-015):** Confirm governorate-based delivery fee schedules and confirm pickup policy/terms.
    3. **Payment Schedule Assumption (D-014):** Formally approve 100% full upfront payment assumption or specify deposit rules.
    4. **Paymob Sandbox Credentials:** Secure official sandbox test credentials (API Key, Secret Key, HMAC Secret, and Integration IDs) for Phase 1.
    5. **Legal Tax Document Review:** Review any legally required physical/tax documentation needed for corporate clients to ensure database fields capture required company information.
- **Out of Scope:** Re-opening already confirmed decisions (MOQ of 10 per Product ID with variant aggregation, Paymob choice, separate printing fee, no ETA e-invoicing, seamless registration).
- **Implementation Approach:** Structured Q&A documented in `docs/audit/business-decisions-log.md` and reflected in `DECISIONS.md`.
- **Files/Modules Impacted:** `DECISIONS.md`, `docs/audit/business-decisions-log.md`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Paymob sandbox credentials ready for Phase 1 testing.
  - Shipping rate schedules established for governorates and pickup terms confirmed.
  - Payment schedule assumption formally signed off.
- **Test Cases:** N/A.
- **Security/SEO Implications:** None.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Revert `DECISIONS.md`.
- **Owner Approval Required:** Yes (Mandatory Owner Gate).

---

## 3. Completed Audit Reconciliation & Evidence Summary

Phase 0 discovery execution has completed with empirical findings documented across `docs/audit/00` through `09`:
- **Verified Findings (`Verified`):**
  - Exactly 54 currently discoverable public URLs cataloged across English root and Arabic subdirectories (`docs/audit/02-url-inventory.csv`).
  - Exactly 166 media attachments cataloged (112 PNG, 49 JPEG, 2 WebP, 3 MP4 videos, 0 PDFs).
  - 6 primary service offerings with authentic bilingual copywriting; 22 client brand logos.
  - Global Google Tag Manager container `GTM-KJ9CRZC` active across all pages.
  - Public WooCommerce storefront contains only 6 demo template products and 1 test package; checkout DOM lacks active payment gateway fields.
- **Unverified Proposals & Assumptions (`Assumption / Proposal Pending Decision`):**
  - Proposed governorate shipping rates (60/80/90/120 EGP) and free office pickup terms (D-015) remain non-binding proposals pending owner decision.
  - 100% upfront payment assumption (D-014) remains a working assumption pending owner sign-off.
- **Missing Privileged-Access Checks (`Requires Authenticated Verification / Requires Access`):**
  - Authenticated inspection of WooCommerce database tables (`wp_posts`, `wp_users`) to confirm whether historical customer accounts or orders exist.
  - Export of historical Google Search Console indexed URLs, queries, and backlink data.
  - Paymob sandbox developer credentials for Phase 1 testing.

---

## 4. Phase Exit & Owner Approval Gate
1. Complete URL inventory file `docs/audit/02-url-inventory.csv` committed and reviewed.
2. Complete audit documentation package `docs/audit/00` through `09` delivered and reviewed.
3. Paymob sandbox credentials acquired.
4. Formal Owner Gate Sign-off: "Discovery & Audit Complete. Proceed to Phase 1 POC."

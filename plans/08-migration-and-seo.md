# MWHEBA 2.0 | Phase 7: Content and SEO Migration Plan

**Phase:** Phase 7  
**Status:** Pending Owner Approval  
**Mode:** PLAN ONLY  
**Goal:** Migrate legacy content, case studies, blog articles, and media from `https://mwheba.com/` into Payload CMS v3, establish high-performance 301 permanent redirects for all legacy URLs, and verify measurable technical SEO compliance (valid canonical URLs, bidirectional hreflang tags, zero unhandled 404 responses on mapped legacy routes, valid OpenGraph previews, and Google Search Console readiness).

---

## 1. Overview & Context

MWHEBA has built organic authority, inbound backlinks, and search indexing over years of operation. Transitioning to a new modern architecture must systematically mitigate crawl errors and organic search disruption. 100% of currently discovered legacy URLs identified during Phase 0 discovery must either be preserved or mapped to a permanent HTTP 301 redirect with zero unhandled 404 errors on mapped routes. Furthermore, historical case studies and blog posts must be cleanly imported and formatted to match the new calm, minimal design standards.

- **Dependencies:** Approval of Phase 0 Discovery (`plans/01-discovery-and-audit.md`), Phase 4 CMS (`plans/05-cms-and-corporate-site.md`), and Phase 5 Commerce (`plans/06-commerce-and-b2b.md`).
- **Scope:**
  - Automated content extraction and transformation pipeline from legacy site export (WordPress/JSON/CSV).
  - Media asset ingestion into managed cPanel filesystem storage with responsive WebP/AVIF generation.
  - Comprehensive HTTP 301 Permanent Redirect Engine implemented at Next.js edge/middleware layer.
  - Bilingual URL structure and hreflang tag alignment (`/ar/...` and `/en/...`).
  - Schema.org structured data injection across all migrated pages (Organization, LocalBusiness, Service, Article).
  - SEO QA audit verifying zero broken internal links, valid canonicals, and sitemap accuracy.
- **Out of Scope:**
  - Migrating obsolete or duplicate test pages (pruned during Phase 0 audit).
  - Purchasing external SEO backlink services.

---

## 2. Work Breakdown & Concrete Tasks

### Ticket MIG-01: Content Transformation & Ingestion Pipeline
- **ID & Title:** MIG-01: Legacy Content Extraction & Payload Ingestion Scripts
- **Business Outcome:** Historical agency case studies, articles, and service descriptions are imported into Payload CMS without manual data entry.
- **Dependencies:** AUD-01, CMS-01.
- **Scope:**
  - Develop migration scripts in `src/scripts/migration/`:
    - `importPosts.ts`: Parses legacy blog posts, converts HTML body into Payload Lexical rich-text AST, extracts author and published date.
    - `importPortfolio.ts`: Parses portfolio items, extracts deliverables, client tags, and galleries.
    - `importServices.ts`: Imports core agency service pages.
  - Implement idempotent script execution: running scripts multiple times updates existing records based on legacy ID/slug rather than creating duplicates.
  - Validate text encoding (ensuring flawless Arabic UTF-8 characters without corruption).
- **Out of Scope:** Importing old user accounts or expired contact form entries.
- **Implementation Approach:** Node.js TypeScript CLI scripts utilizing Payload Local API directly against PostgreSQL.
- **Files/Modules Impacted:** `src/scripts/migration/importPosts.ts`, `src/scripts/migration/importPortfolio.ts`, `package.json`.
- **Database Changes:** Batch inserts into `blog_posts`, `portfolio_projects`, and `pages`.
- **Acceptance Criteria:**
  - 100% of approved historical articles and portfolio items imported with correct Arabic and English content.
  - Zero character encoding corruptions in Arabic titles or bodies.
- **Test Cases:** Run import on staging; spot check 20 random legacy articles against live site content for text fidelity.
- **Security/SEO Implications:** Preserves keyword indexing and historical publish dates.
- **Estimate & Risk:** 2.5 days. Medium risk (handling messy legacy HTML markup).
- **Rollback:** Database backup restore or truncate imported collections via script.
- **Owner Approval Required:** Yes (to approve content selection and pruning).

---

### Ticket MIG-02: Media Asset Migration & Filesystem Pipeline
- **ID & Title:** MIG-02: Media Asset Download, Optimization & Filesystem Ingestion
- **Business Outcome:** Fast loading speeds, modernized image formats, and complete independence from legacy server hosting.
- **Dependencies:** AUD-03, FND-02.
- **Scope:**
  - Script `src/scripts/migration/importMedia.ts`:
    - Downloads images referenced in legacy content.
    - Stores files in a persistent filesystem directory under structured paths (`/media/uploads/YYYY/MM/...`).
    - Generates Payload `Media` records with alt text and dimensions.
    - Updates image URLs inside imported RichText content to reference controlled application media endpoints.
- **Out of Scope:** Manual retouching of legacy photography.
- **Implementation Approach:** Concurrent batch stream with Sharp image processing for metadata extraction.
- **Files/Modules Impacted:** `src/scripts/migration/importMedia.ts`, `src/modules/content/collections/Media.ts`.
- **Database Changes:** Inserts into `media` collection.
- **Acceptance Criteria:**
  - All referenced images in migrated articles and case studies resolve properly without 404s.
  - Assets served via CDN with caching headers (`Cache-Control: public, max-age=31536000, immutable`).
- **Test Cases:** Automated crawl checking for broken image tags across all migrated pages.
- **Security/SEO Implications:** Image alt attributes preserved for Google Image SEO.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Restore the prior file directory backup and re-run the migration.
- **Owner Approval Required:** No.

---

### Ticket MIG-03: Edge Redirect Engine & 4-Tier URL Status Governance
- **ID & Title:** MIG-03: Edge Routing Engine & 4-Tier Legacy URL Status Matrix
- **Business Outcome:** Discovered legacy URLs are governed according to the verified 4-tier action matrix (`docs/audit/05-redirect-map.csv`), preserving link equity, dropping demo junk cleanly, and ensuring zero unhandled 404 responses.
- **Dependencies:** AUD-01, MIG-01.
- **Scope:**
  - Compile master redirect and status dictionary `src/config/redirects.json` based on `docs/audit/05-redirect-map.csv`.
  - Implement edge routing and status rules in Next.js middleware or `next.config.mjs` strictly respecting the 4 status tiers:
    1. **`PRESERVE` (HTTP 200 OK):** Domain root (`https://mwheba.com/`) and system endpoints (`https://mwheba.com/robots.txt`) serve directly with HTTP 200 without self-redirects.
    2. **`REDIRECT_301` (HTTP 301 Moved Permanently):** Active corporate and service routes, legacy Arabic slugs, core commerce entrypoints, and trailing-slash normalization (`/ar/` $\rightarrow$ `/ar`). Targets are strictly clean non-trailing-slash paths (`trailingSlash: false`), resolving in a single 301 hop with zero intermediate redirect chains or loops. Target URLs respond with HTTP 200.
    3. **`GONE_410` (HTTP 410 Gone):** 10 legacy theme demo products and dummy test posts are served with HTTP 410 Gone to signal search crawlers to remove them permanently from search indices (unless GSC backlink audit justifies a 301 fallback).
    4. **`REQUIRES_REVIEW`:** Handled per confirmed owner mapping.
  - Implement dynamic fallback redirect collection in Payload admin allowing marketing to add instant redirects in the future.
- **Out of Scope:** Client-side JavaScript redirects (`<meta http-equiv="refresh">` is prohibited; HTTP 301/410 only).
- **Implementation Approach:** High-performance hash lookup in Next.js middleware before route evaluation.
- **Files/Modules Impacted:** `src/middleware.ts`, `src/config/redirects.json`, `next.config.mjs`.
- **Database Changes:** Optional `redirects` collection in Postgres for marketing overrides.
- **Acceptance Criteria:**
  - Automated test script queries all 54 discovered URLs and asserts exact status codes matching `docs/audit/05-redirect-map.csv`:
    - `PRESERVE` routes return HTTP 200.
    - `REDIRECT_301` routes return HTTP 301, assert `Location` header is the clean target without trailing slash, assert target returns HTTP 200, and assert zero redirect chains.
    - `GONE_410` routes return HTTP 410 Gone.
  - Zero unhandled 404 responses across all mapped routes.
- **Test Cases:** Automated test suite querying all 54 inventory endpoints and asserting exact HTTP status codes (200, 301, 410) and target response fidelity.
- **Security/SEO Implications:** The single most critical SEO requirement during a domain rebuild; prevents 404 spikes and cleans indexation.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert redirect map.
- **Owner Approval Required:** Yes (Mandatory Owner Gate to verify URL targets).

---

### Ticket MIG-04: Technical SEO Audit & Search Engine Readiness
- **ID & Title:** MIG-04: SEO QA, Structured Data Validation & Hreflang Verification
- **Business Outcome:** Measurable technical SEO foundation meeting Core Web Vitals thresholds (LCP < 2.5s, CLS < 0.1, INP < 200ms), 100% valid schema.org structured data, and bidirectional hreflang implementation.
- **Dependencies:** MIG-01, MIG-03, CMS-06.
- **Scope:**
  - Verify bilingual hreflang tags across all pages:
    - `<link rel="alternate" hreflang="ar-EG" href="https://mwheba.com/ar/..." />`
    - `<link rel="alternate" hreflang="en" href="https://mwheba.com/en/..." />`
    - `<link rel="alternate" hreflang="x-default" href="https://mwheba.com/ar/..." />`
  - Verify Canonical URLs point to authoritative URLs.
  - Inject JSON-LD Schema (Organization, LocalBusiness, Product, Article).
  - Perform automated crawl of staging site simulating Googlebot.
  - Produce comprehensive SEO QA Report: `docs/seo/migration-qa-report.md`.
- **Out of Scope:** Post-launch rank tracking (Phase 8).
- **Implementation Approach:** Schema.org JSON-LD generation utility and Playwright crawler for validation.
- **Files/Modules Impacted:** `src/shared/lib/schemaGenerator.ts`, `docs/seo/migration-qa-report.md`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Google Rich Results test returns 0 errors for Organization, Product, and Article schemas.
  - Staging crawl reveals 0 broken internal links, 0 missing alt tags, and 0 duplicate title tags.
- **Test Cases:** Run automated SEO validator against all migrated staging routes.
- **Security/SEO Implications:** Establishes measurable technical search parity with old website (0% missing canonicals, 100% valid XML sitemap coverage, 0 broken internal links on staging crawl).
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** N/A.
- **Owner Approval Required:** Yes.

---

## 3. Risks & Mitigation
- **Risk:** Crawlers indexing staging site before production cutover.  
  *Mitigation:** Staging site is strictly password-protected with HTTP Basic Auth and configured with `X-Robots-Tag: noindex, nofollow`.
- **Risk:** High memory usage during large batch image processing.  
  *Mitigation:* Process media sequentially in controlled concurrency batches of 5 items.

---

## 4. Phase Exit & Owner Approval Gate
1. All approved legacy content and media imported into Payload CMS.
2. 100% of discovered legacy URLs mapped and verified against the 4-tier status matrix (2 PRESERVE, 41 REDIRECT_301, 10 GONE_410, 1 REQUIRES_REVIEW).
3. Automated crawl shows zero 404 errors or broken assets across mapped routes.
4. Formal SEO QA report signed off.
5. Formal Owner Gate Sign-off: "Phase 7 Migration Approved. Proceed to Phase 8 Security, Testing & Launch."

# MWHEBA 2.0 | SEO Baseline & Technical Audit

**Document ID:** AUD-DOC-04  
**Phase:** Phase 0 (Discovery & Live-Site Audit)  
**Status:** Completed — Pending Owner Approval  
**Audit Target:** `https://mwheba.com/`  

---

## 1. Executive Summary: SEO Health

The live `mwheba.com` website exhibits significant technical SEO deficiencies across its currently discovered public footprint (54 URLs). Note that this inventory reflects discoverable URLs from public sitemaps and API endpoints; the complete historical and indexed URL set may contain legacy parameterized links or archived landing pages, which strictly requires validation against Google Search Console data and server access logs.

While existing URLs respond with valid HTTP 200 codes and self-referencing canonicals, critical internationalization tags (`hreflang`), on-page heading hierarchies (`H1`), and unique meta descriptions are largely absent.

Transitioning to Next.js 15+ in MWHEBA 2.0 presents an immediate opportunity for dramatic organic search visibility gains by automating structured metadata, OpenGraph tags, semantic HTML landmarks, and valid bidirectional hreflang links.

---

## 2. Technical SEO Audit Breakdown

### A. Internationalization & Hreflang Tags (`Verified`)
- **Empirical Finding:** Probing of both English root pages (`https://mwheba.com/`, `https://mwheba.com/about/`) and Arabic subpages (`https://mwheba.com/ar/`, `https://mwheba.com/ar/عن-موهبة/`) revealed **zero** `<link rel="alternate" hreflang="...">` tags in the HTML `<head>`.
- **SEO Impact:** Search engines (Google, Bing) cannot programmatically associate the English service page with its Arabic counterpart. This risks cross-language ranking collisions, duplicate content penalties, or serving the wrong language to MENA users.
- **MWHEBA 2.0 Mandate:** Next.js dynamic metadata must generate bidirectional `hreflang="ar"`, `hreflang="en"`, and `hreflang="x-default"` tags on every indexed page.

### B. Heading Structure & Semantic H1s (`Verified`)
- **Empirical Finding:** Across all 35 corporate pages inspected, only **two** pages possessed semantic `<h1>` tags:
  1. Homepage: `<h1>Intelligent Brands Start Here</h1>` / `<h1>العلامات التجارية المبتكرة تبدأ من هنا</h1>`
  2. Shop Page: `<h1>Shop</h1>`
- **Root Cause:** Elementor visual builder defaults to styling arbitrary `<h2>`, `<h3>`, or `<div>` elements with large display typography without binding a semantic `<h1>` heading.
- **MWHEBA 2.0 Mandate:** Every route rendered in MWHEBA 2.0 must enforce a single, keyword-optimized `<h1>` containing the primary service or corporate proposition.

### C. Meta Descriptions & Page Titles (`Verified`)
- **Empirical Finding:**
  - The Homepage possesses a tailored meta description:
    > *"MWHEBA Agency delivers branding, web development, digital marketing, printing, and media production to help your brand grow globally."*
  - **All inner pages** (`/about/`, `/services/web-development/`, `/services/printing/`, `/contact-us/`, etc.) have **NO meta description tag** (`<meta name="description">` is absent).
- **SEO Impact:** Search engines dynamically scrape random snippets of text or navigation links for search engine results pages (SERPs), resulting in sub-optimal click-through rates (CTR).
- **MWHEBA 2.0 Mandate:** Payload CMS collections (`pages`, `services`, `products`, `case-studies`) must enforce required `metaTitle` and `metaDescription` fields with character count indicators.

### D. Canonical Tag Implementation & Arabic Investigation (`Verified`)
- **Empirical Finding:** Re-auditing with single-encoded UTF-8 paths confirmed that the live WordPress site implements self-referencing canonical tags correctly on all pages, including Arabic pages (e.g., `<link rel="canonical" href="https://mwheba.com/ar/خدماتنا/تطوير-المواقع/" />` and `<link rel="canonical" href="https://mwheba.com/services/brand-identity/" />`).
- **Anomalous Crawler Artifact Resolved:** An earlier crawl script anomaly where 14 Arabic pages reflected the English homepage canonical was traced to crawler double-percent-encoding (`%25d8...`), which triggered a WordPress fallback redirect. Re-audit with verified single-encoding confirmed 100% self-referencing canonical integrity.
- **Trailing Slash Behavior:** The live server strictly enforces trailing slashes on directory URLs (`/services/` rather than `/services`).
- **MWHEBA 2.0 Mandate:** Next.js `next.config.mjs` must enforce `trailingSlash: true` or strict 308 redirects to preserve canonical consistency with legacy indexing.

---

## 3. Crawlability & Indexation Controls

### A. Robots.txt Inspection (`Verified`)
```text
User-agent: *
Disallow: /wp-content/uploads/wc-logs/
Disallow: /wp-content/uploads/woocommerce_transient_files/
Disallow: /wp-content/uploads/woocommerce_uploads/
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://mwheba.com/sitemaps.xml
```
- **Observations:** The directives are standard for WordPress/WooCommerce. Public upload assets are allowed, while internal WooCommerce log directories are properly blocked.
- **MWHEBA 2.0 Target:** The new `app/robots.ts` will restrict `/api/`, `/admin/`, `/checkout/`, and private S3 buckets while exposing public routes and the dynamic `sitemap.xml`.

### B. XML Sitemap Structure (`Verified`)
- The sitemap index `https://mwheba.com/sitemaps.xml` links to:
  - `post-sitemap1.xml` (contains 3 dummy posts)
  - `page-sitemap1.xml` (contains 32 pages)
  - `portfolio_category-sitemap1.xml` (contains 6 category archives)
- **Gap:** WooCommerce products (`/product/...`) are completely missing from the sitemap index, proving the store was never properly configured for search engines.

---

## 4. Proposed 301 Redirection & Migration Strategy

To protect historical link equity and prevent 404 error spikes upon launching MWHEBA 2.0, a **proposed 301 redirection matrix** has been formulated in `docs/audit/05-redirect-map.csv`. This matrix is a **proposed draft** based on the currently discovered inventory and remains subject to formal validation against historical Google Search Console indexed URLs and server access log evidence before Phase 7 execution.

### Redirection Rules Framework & Action Classifications
1. **`PRESERVE` (Status 200):** Domain root (`https://mwheba.com/`) and native system endpoint (`https://mwheba.com/robots.txt`) are preserved natively without self-redirects.
2. **`REDIRECT_301` (Status 301):**
   - **Trailing-Slash Normalization:** Legacy Arabic homepage (`https://mwheba.com/ar/` $\rightarrow$ `https://mwheba.com/ar`). In Next.js, default routing enforces `trailingSlash: false`. All targets in `05-redirect-map.csv` are explicitly normalized to non-trailing-slash URLs. By redirecting legacy URLs with trailing slashes directly to clean Next.js targets, requests resolve in a single 301 hop with zero intermediate redirects.
   - **Active English Corporate Pages:** Legacy pages (e.g. `/services/web-development/` $\rightarrow$ `/en/services/web-development`).
   - **Arabic Corporate Pages with Percent-Encoded Slugs:** (e.g. `/ar/خدماتنا/تطوير-المواقع/` $\rightarrow$ `/ar/services/web-development`).
   - **Core WooCommerce Legacy Entrypoints:** (`/shop/`, `/cart/`, `/checkout/`, `/my-account/` $\rightarrow$ `/en/...`).
   - **Legacy Sitemaps Index:** (`/sitemaps.xml` $\rightarrow$ `/sitemap.xml`).
3. **`GONE_410` (Status 410):** Theme demo products (`vintage-typewriter`, etc.) and default test posts (`hello-world`, `test-blog`) are assigned HTTP 410 Gone to cleanly de-index demo clutter, with an optional 301 fallback to parent hubs if GSC shows incoming backlinks.
4. **`REQUIRES_REVIEW` (Status 301 / Review):** Unconfigured service test (`social-media-managemnt-package`) flagged for owner decision on whether to map to digital marketing packages or retire.

---

## 5. SEO Requirements Dependent on Owner Access (`Requires Access`)

The following historical SEO baselines cannot be verified through public inspection and require authenticated access from the project owner:
1. **Google Search Console (GSC):**
   - Access to performance reports (total clicks, impressions, average position over past 12 months) to identify top organic search queries for MWHEBA.
   - Index Coverage / Page Indexing report to verify which specific URLs Google has indexed.
2. **Backlink Profile (Ahrefs / Moz / Semrush / GSC Links):**
   - Verification of external backlinks pointing to `mwheba.com` to guarantee high-authority incoming links are preserved.
3. **Google Business Profile (GBP):**
   - Confirmation of Alexandria local business listing URLs and contact phone numbers.

---
*For the complete granular 301 mapping table, refer to `docs/audit/05-redirect-map.csv`.*

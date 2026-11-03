# MWHEBA 2.0 | Discovery & Live-Site Audit: Executive Summary

**Document ID:** AUD-DOC-00  
**Phase:** Phase 0 (Discovery & Live-Site Audit)  
**Status:** Completed — Pending Owner Approval  
**Audit Date:** November 2026  
**Audited Target:** `https://mwheba.com/` (Public Production Environment)  

---

## 1. Executive Overview

This document synthesizes the empirical discovery and live-site audit conducted on `https://mwheba.com/`. The audit was executed via polite, non-intrusive crawling of public endpoints, WordPress REST API introspection (`/wp-json/wp/v2/`), sitemap XML parsing, header evaluation, and DOM analysis. No production data, databases, hosting infrastructure, or DNS records were modified.

The findings establish the empirical technical baseline required to execute MWHEBA 2.0 without organic traffic loss, asset degradation, or marketing breakage.

---

## 2. Key Audit Findings & Discoveries

| Investigation Area | Empirical Finding | Classification | Impact on MWHEBA 2.0 |
|---|---|---|---|
| **Underlying CMS & Stack** | WordPress 6.x + WooCommerce + Elementor Pro + ElementsKit + LiteSpeed Cache on Apache/LiteSpeed web server. | `Verified` | Confirms current platform is a standard WordPress monolithic build with visual builder overhead and fragment cache. |
| **URL Inventory & Hierarchy** | 54 currently discovered public URLs: 35 Pages, 3 Blog Posts, 1 Portfolio CPT, 7 WooCommerce Products, 6 Portfolio Taxonomies, 2 System files. | `Verified` | Represents the currently discovered public inventory. Complete historical or indexed URL set requires validation against Google Search Console and server access logs. |
| **Bilingual Architecture** | English root paths (`/services/...`, `/about/`) and Arabic subdirectories (`/ar/...`, `/ar/خدماتنا/...`) with percent-encoded Arabic permalinks. **Zero `<link rel="alternate" hreflang="...">` tags detected on live site.** | `Verified` | Critical SEO vulnerability in live site. MWHEBA 2.0 must introduce proper Next.js i18n routing (`/ar` and `/en`) with bidirectional `hreflang` headers. |
| **Legacy E-Commerce Status** | Public catalog exposes 7 products: 6 theme demo products (e.g., *Vintage Typewriter*) + 1 test package (*Social Media Managemnt Package*). Checkout DOM lacks active payment gateway fields. | `Verified` (Public Storefront) / `Requires Access` (Backend DB) | Public storefront is unconfigured demo data. Whether historical orders, customer accounts, or offline transaction logs exist in the WordPress backend cannot be determined from public inspection and strictly Requires Authenticated Verification. |
| **Agency Content & Services** | 6 primary service offerings with authentic agency copywriting: Web Development, UI/UX Design, Printing, Media Production, Digital Marketing, and Brand Identity. 22 client brand logos identified. | `Verified` | Core service copy and client logos are high-quality migration assets to be ported into Payload CMS collections. |
| **Portfolio & Case Studies** | Live portfolio page (`/our-projects/` and `/ar/مشاريعنا/`) contains 0 project images; single CPT entry is dummy `test`. | `Verified` | No legacy portfolio case studies exist to migrate. Project showcase requires net-new content creation in Phase 5. |
| **Media Library** | 166 total media attachments (112 PNG, 49 JPEG, 2 WebP, 3 MP4 video backgrounds). 0 legacy PDFs. WebP generated via WP Smush plugin. | `Verified` | Clean media catalog (~166 items). S3 migration can be executed via an automated batch upload script in Phase 7. |
| **Tracking & Analytics** | Single Google Tag Manager container `GTM-KJ9CRZC` deployed globally in `<head>`. Elementor Pro form handler on `/contact-us/`. No raw Meta Pixel or GA4 tags hardcoded in HTML. | `Verified` (Container Presence) / `Requires Access` (Tags/Triggers) | Transferring the GTM container alone does NOT guarantee tracking continuity. Because Next.js uses a React client/server architecture rather than WordPress DOM elements, full tracking continuity requires authenticated GTM container inspection, GA4/Meta Pixel verification, defining a new dataLayer event contract, and event-level testing. |
| **SEO Meta Baseline** | Homepage has custom meta description and H1. Inner pages have valid self-referencing canonicals and real titles, but lack meta descriptions and semantic H1 headers (Elementor template pattern). | `Verified` | Technical SEO on live site has clear on-page gaps; MWHEBA 2.0 will provide immediate organic ranking uplift through automated Next.js metadata and semantic H1 generation. |

---

## 3. Evidence Classification Summary

All audit findings in this dossier adhere strictly to a 3-tier classification:
- **`Verified`**: Directly extracted from live HTTP headers, HTML DOM, public REST endpoints (`/wp-json/`), or sitemap XML. Supported by reproducible logs.
- **`Inferred`**: Reasoned deduction based on industry standard architectures and correlated signals (e.g., GTM managing GA4/Meta Pixel internally).
- **`Requires Access`**: Blocked from verification without authenticated credentials (e.g., GTM container triggers, Paymob production merchant dashboard, DNS zone file).

---

## 4. Phase 0 Deliverable Index

The full Phase 0 audit dossier comprises nine structured documents under `docs/audit/`:
1. `docs/audit/00-executive-summary.md` (This document)
2. `docs/audit/01-website-inventory.md` (Detailed structural breakdown of the 54 discovered URLs)
3. `docs/audit/02-url-inventory.csv` (Complete CSV inventory with status, titles, descriptions, H1s, canonicals)
4. `docs/audit/03-content-and-media-audit.md` (Analysis of copy, 166 media assets, videos, client logos)
5. `docs/audit/04-seo-baseline.md` (Current SEO performance, missing hreflang/H1/meta gaps, URL structure)
6. `docs/audit/05-redirect-map.csv` (Proposed 301 redirection matrix from currently discovered URLs to MWHEBA 2.0 routes; draft pending GSC validation)
7. `docs/audit/06-marketing-integrations.md` (Inspection of GTM-KJ9CRZC, forms, lead workflows)
8. `docs/audit/07-business-gaps.md` (Operational logistics alignment: shipping rate proposals, Paymob keys, tax docs)
9. `docs/audit/08-phase-1-readiness.md` (Technical prerequisites and conditional GO / NO-GO recommendation for Phase 1 POC)

---

## 5. Strategic Recommendation & Next Steps

1. **Approval Gate:** The discovery phase has successfully identified the public site structure. The public storefront consists purely of placeholder demo entries and unconfigured checkout; confirmation of whether any backend customer accounts or orders exist Requires Authenticated Verification before declaring zero legacy data risk.
2. **Phase 1 Feasibility POC:** Ready to proceed to Phase 1 POC immediately upon project owner approval of this audit dossier and provision of Paymob sandbox test credentials.

---
*Awaiting explicit owner approval before proceeding to Phase 1 POC.*

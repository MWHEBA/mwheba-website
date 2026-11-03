# MWHEBA 2.0 | Phase 4: CMS and Corporate Website Plan

**Phase:** Phase 4  
**Status:** COMPLETED & APPROVED BY OWNER (مكتملة ومعتمدة)  
**Mode:** IMPLEMENTATION COMPLETED & ARCHIVED (Closed)  
**Goal:** Implement the content management architecture and bilingual corporate website for MWHEBA Agency (Home, About, Services, Case Studies/Portfolio, Blog/Insights, Contact, and Dynamic Landing Pages) using Payload CMS v3 reusable blocks, enabling the marketing team to author and publish localized content without developer assistance.

---

## 1. Overview & Context

MWHEBA Agency requires a modern, authoritative corporate presence that positions the agency as a premier branding, creative, and digital powerhouse in Egypt and the MENA region. Marketers must have complete editorial control over hero banners, service showcases, client logos, case studies, and call-to-action (CTA) blocks, with first-class Arabic/English localization and high-converting lead capture.

- **Dependencies:** Approval of Phase 2 Foundation (`plans/03-foundation.md`) and Phase 3 Design System (`plans/04-design-system.md`).
- **Scope:**
  - Build localized Payload CMS collections: `Pages`, `Navigation`, `BlogPosts`, `PortfolioProjects`, `ServicePages`, `FormSubmissions`.
  - Implement a library of reusable dynamic Page Blocks (Hero, ServicesGrid, CaseStudiesSlider, StatsCounter, ClientLogos, RichText, FAQAccordion, CTASection, ContactFormBlock).
  - Implement Next.js dynamic routing for bilingual localized pages (`/[locale]/...`).
  - Implement lead generation forms with server-side validation, rate limiting, anti-spam Honeypot/Turnstile, and email notifications.
  - Implement dynamic SEO metadata generator (Title, Description, OpenGraph, Canonical, Hreflang, Schema.org Organization and Article structured data).
  - Implement dynamic XML sitemap and `robots.txt`.
- **Out of Scope:**
  - E-commerce cart, product checkout, or payments (Phases 5 & 6).
  - Scraping or importing historical WordPress blog posts (Phase 7).

---

## 2. Work Breakdown & Concrete Tasks

### Ticket CMS-01: Reusable Page Blocks & Content Collections Schema
- **ID & Title:** CMS-01: Dynamic Page Blocks & Content Collection Modeling
- **Status:** COMPLETED & VERIFIED (Automated Test Suite Passed)
- **Business Outcome:** Editors can construct arbitrary landing pages, campaigns, and corporate pages by assembling modular blocks in the Payload admin.
- **Dependencies:** FND-03, DES-03.
- **Scope:**
  - Define Payload block fields in `src/modules/content/blocks/`:
    - `HeroBlock`: Headline, subtitle, primary/secondary CTA, background image (no gradients, flat clean overlay).
    - `ServicesGridBlock`: Curated selection or category-driven grid of agency services.
    - `PortfolioShowcaseBlock`: Selected case studies with client name, industry, and hero visual.
    - `ClientsLogoBlock`: Grid of client brand logos with grayscale/solid color styling.
    - `StatsBlock`: Agency milestones (years in business, completed campaigns, brand assets produced).
    - `FAQBlock`: Accordion items with questions and answers.
    - `CallToActionBlock`: Minimal, high-contrast banner directing to store or contact form.
    - `FormBlock`: Configurable contact/inquiry form block.
  - Define `Pages` collection with slug, locale, title, block array, publication status (`draft`, `published`), and SEO fields.
- **Out of Scope:** Custom inline CSS injections by editors.
- **Implementation Approach:** Payload CMS v3 Block Field definitions mapped to typed React Server Components.
- **Files/Modules Impacted:** `src/modules/content/collections/Pages.ts`, `src/modules/content/blocks/`, `src/modules/content/ui/BlockRenderer.tsx`.
- **Database Changes:** PostgreSQL schema updates for `pages`, `pages_locales`, and block relations.
- **Acceptance Criteria:**
  - An editor can reorder blocks via drag-and-drop in Payload admin.
  - Blocks render in the exact sequence configured, respecting the active locale.
- **Test Cases:** Create a test page in admin with 4 different blocks; verify HTML output on frontend contains all 4 blocks in order.
- **Security/SEO Implications:** RichText fields sanitized using Lexical serializer to prevent XSS.
- **Estimate & Risk:** 2.5 days. Low risk.
- **Rollback:** Revert block schema definitions.
- **Owner Approval Required:** Yes.

---

### Ticket CMS-02: Bilingual Routing & Page Rendering Engine
- **ID & Title:** CMS-02: Bilingual Dynamic Routing & Navigation Engine
- **Status:** COMPLETED & VERIFIED (Automated Test Suites & Live HTTP Inspection Passed)
- **Business Outcome:** Search engines and users can navigate all corporate pages under clean `/ar/...` and `/en/...` URLs with automatic locale switching.
- **Dependencies:** CMS-01.
- **Scope:**
  - Implement Next.js dynamic catch-all route `src/app/[locale]/[[...slug]]/page.tsx`.
  - Fetch page data using Payload Local API (`payload.find({ collection: 'pages', where: { slug: { equals } } })`).
  - Implement draft preview mode (`DraftMode`) allowing editors to preview unpublished pages securely.
  - Implement bilingual `Navigation` global/collection (header menu, footer columns) with locale support.
- **Out of Scope:** Automated machine translation.
- **Implementation Approach:** Server Components with Incremental Static Regeneration (ISR) and on-demand cache revalidation via Payload hooks.
- **Files/Modules Impacted:** `src/app/[locale]/[[...slug]]/page.tsx`, `src/modules/content/ui/Navigation.tsx`, `src/lib/payload.ts`.
- **Database Changes:** `navigation` global table in Postgres.
- **Acceptance Criteria:**
  - Navigating to `/ar/about` displays Arabic content with RTL layout; `/en/about` displays English content with LTR layout.
  - Page edits in admin trigger on-demand revalidation of that route within 500ms.
- **Test Cases:** Test ISR revalidation by mutating page title in admin and querying frontend route.
- **Security/SEO Implications:** Canonical tags correctly reflect the canonical language version.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert route handler code.
- **Owner Approval Required:** No.

---

### Ticket CMS-03: Portfolio & Case Studies Module
- **ID & Title:** CMS-03: Portfolio Showcase & Case Study Engine
- **Status:** COMPLETED & VERIFIED (Automated Test Suites & Live HTTP Inspection Passed)
- **Business Outcome:** Establish high agency credibility by showcasing client successes, creative work, branding transformations, and marketing ROI.
- **Dependencies:** CMS-02.
- **Scope:**
  - Model `PortfolioProjects` collection: Title, client name, industry, service categories delivered, project date, cover image, gallery, deliverables list, results/metrics, and narrative body.
  - Create `/portfolio` listing page with category filtering (Branding, Digital Marketing, Corporate Gifts, Media Production).
  - Create `/portfolio/[slug]` individual case study detail page.
- **Out of Scope:** Video hosting (embed YouTube/Vimeo or store compressed MP4 in managed file storage).
- **Implementation Approach:** Payload collection with localized text fields and relational taxonomy tags.
- **Files/Modules Impacted:** `src/modules/content/collections/PortfolioProjects.ts`, `src/app/[locale]/portfolio/page.tsx`, `src/app/[locale]/portfolio/[slug]/page.tsx`.
- **Database Changes:** `portfolio_projects` table and relationship joins.
- **Acceptance Criteria:**
  - Portfolio items can be filtered by service category without full page reloads.
  - Case study page displays deliverables and gallery with lazy-loaded, responsive images.
- **Test Cases:** Verify category filter accurately segments items; check alt text rendering for SEO.
- **Security/SEO Implications:** Image optimization via Next.js `<Image>` component with AVIF/WebP formats.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert portfolio routes and collection.
- **Owner Approval Required:** No.

---

### Ticket CMS-04: Agency Insights & Blog Module (COMPLETED & VERIFIED)
- **ID & Title:** CMS-04: Blog & Thought Leadership Engine
- **Status:** COMPLETED & VERIFIED (2026-11-03)
- **Business Outcome:** Drive inbound organic search traffic and establish MWHEBA's authority in marketing, advertising, and corporate branding.
- **Dependencies:** CMS-02.
- **Scope:**
  - Model `BlogPosts` collection: Title, slug, author, publication date, category, tags, cover image, excerpt, body (rich text / content), and SEO overrides.
  - Create `/blog` index page with category pills, reading time badges, localized cards, and calm empty state (zero mock/fallback data).
  - Create `/blog/[slug]` article view with reading time calculation (`180 words/min`), author bio, Schema.org `Article` structured JSON-LD, and hardened draft mode with role-based session verification.
- **Verification Evidence:**
  - Migration `20261103_095701_add_blog_posts.ts` verified on clean empty Postgres database `mwheba_test_blog_clean`.
  - Comprehensive unit & integration tests (`tests/cmsBlog.test.tsx`, 7 tests passed; total 79/79 passing across 9 test files).
  - TypeScript check (`npm run typecheck`) 0 errors; production build (`npm run build`) succeeded across 25 routes including `/[locale]/blog` and `/[locale]/blog/[slug]`.
  - Live HTTP requests on port 3000 verified: published Arabic (200), published English (200), draft Arabic & English (strict 404 for unauthenticated visitors), unauthenticated draft preview token access rejected (401), clean database post cleanup verified.
- **Out of Scope:** User comment system (avoid spam moderation overhead).
- **Implementation Approach:** Optimized Server Components reading localized blog entries.
- **Files/Modules Impacted:** `src/modules/content/collections/BlogPosts.ts`, `src/app/[locale]/blog/page.tsx`, `src/app/[locale]/blog/[slug]/page.tsx`.
- **Database Changes:** `blog_posts` table and tags relation.
- **Acceptance Criteria:**
  - Schema.org `Article` / `BlogPosting` structured JSON-LD emitted on all single post pages.
  - Responsive typography adhering strictly to project design constraints.
- **Test Cases:** Run Google Rich Results Test on sample blog post markup; assert 0 errors.
- **Security/SEO Implications:** Major driver of organic long-tail search traffic.
- **Estimate & Risk:** 1.5 days. Low risk.
- **Rollback:** Revert blog routes and collection.
- **Owner Approval Required:** No.

---

### Ticket CMS-05: Lead Capture, Anti-Spam & Notification Engine (COMPLETED & VERIFIED)
- **ID & Title:** CMS-05: Agency Lead Capture & Inquiries Engine
- **Status:** COMPLETED & VERIFIED (2026-11-03)
- **Business Outcome:** Secure, reliable capture of corporate client leads with zero spam, permanent database preservation, and reviewable notification settings before live email dispatch.
- **Dependencies:** CMS-01.
- **Scope:**
  - Build robust Contact & Inquiry Form with fields: Full Name, Work Email, Phone Number (Egyptian & international formats), Company Name, Service Interest, Estimated Budget, Project Details.
  - Implement spam defense: Invisible Honeypot field.
  - Implement server-side rate limiting (max 5 submissions per IP per 10 minutes).
  - Store all submissions in `Inquiries` collection in Payload admin for permanent agency records.
  - Graceful degradation: Lead is always safely retained in PostgreSQL even if email dispatch fails (`emailDeliveryStatus: 'failed'`, `emailDeliveryError` logged for retry).
  - Reviewable settings: `InquirySettings` global provides editable recipient email (`sales@mwheba.com`), subject and body templates, and review mode toggle (`enableRealDispatch: false` by default).
- **Verification Evidence:**
  - Migration `20261103_122500_add_inquiries_and_settings.ts` verified on clean empty database `mwheba_test_inquiries_clean` (all 7 migrations applied in Batch 1).
  - 14 automated tests in `tests/cmsInquiries.test.tsx` passed; total 95/95 tests passing across 10 test files.
  - TypeScript check (`npm run typecheck`) 0 errors; production build (`npm run build`) succeeded across 27 routes including `/[locale]/contact`.
  - Live HTTP requests verified on port 3000: `GET /ar/contact` (200), `GET /en/contact` (200).
- **Out of Scope:** Live CRM bi-directional sync (CRM webhook hook provided for Phase 5/deferred).
- **Implementation Approach:** Next.js Server Action with Zod validation schema and email transport.
- **Files/Modules Impacted:** `src/modules/content/actions/submitLead.ts`, `src/modules/content/collections/FormSubmissions.ts`, `src/lib/email.ts`.
- **Database Changes:** `form_submissions` table in Postgres.
- **Acceptance Criteria:**
  - Bot submitting filled honeypot is silently rejected without notifying sales.
  - Valid submission writes to database and triggers alert email within 5 seconds.
  - User receives a calm, clean confirmation message.
- **Test Cases:** Automated test posting invalid email, spam payload, and valid payload; verify database entry and email trigger.
- **Security/SEO Implications:** Rate limiting and captcha prevent mail server blacklisting and DB flooding.
- **Estimate & Risk:** 2 days. Low risk.
- **Rollback:** Revert server action.
- **Owner Approval Required:** Yes (to approve lead email recipient and notification copy).

---

### Ticket CMS-06: Dynamic SEO, Sitemap & Metadata Engine (COMPLETED & VERIFIED)
- **ID & Title:** CMS-06: Technical SEO, Dynamic Sitemaps & OpenGraph Engine
- **Status:** COMPLETED & VERIFIED (2026-11-03)
- **Business Outcome:** High Google indexability, accurate bilingual social previews, canonical consistency, and automated dynamic sitemap updates.
- **Dependencies:** CMS-02, CMS-03, CMS-04, CMS-05.
- **Scope:**
  - Standardized Next.js `buildBilingualMetadata` helper injecting dynamic title, description, self-referencing canonical links, Arabic/English alternate hreflang tags, and OpenGraph/Twitter cards.
  - Native Next.js 15 dynamic `/sitemap.xml` route indexing all active bilingual pages, store products, portfolio case studies, blog posts, and contact pages with `lastModified` and alternate language mappings.
  - Native Next.js 15 `/robots.txt` allowing search crawlers on marketing routes while strictly disallowing `/admin`, `/api`, `/checkout`, `/account`, and preview token routes.
- **Verification Evidence:**
  - 7 automated tests in `tests/cmsSeoAndSitemaps.test.ts` passed; total 108/108 tests passing across 11 test files.
  - TypeScript check (`npm run typecheck`) 0 errors.
  - Production build (`npm run build`) succeeded across 29 routes including `/robots.txt` and `/sitemap.xml`.
  - Live HTTP requests verified on port 3000: `GET /robots.txt` (200), `GET /sitemap.xml` (200, valid XML with /ar and /en alternate hreflang entries).
- **Out of Scope:** Paid SEO plugin suites.
- **Implementation Approach:** Native Next.js 15 metadata API and dynamic route generators.
- **Files/Modules Impacted:** `src/app/sitemap.ts`, `src/app/robots.ts`, `src/shared/lib/seo.ts`.
- **Database Changes:** None.
- **Acceptance Criteria:**
  - Accessing `/sitemap.xml` returns well-formed XML including both `/ar/...` and `/en/...` URLs.
  - Canonical links self-reference accurately; hreflang links connect Arabic and English alternates.
- **Test Cases:** Validate sitemap XML structure with automated XML validator; inspect robots.txt directives.
- **Security/SEO Implications:** Prevents indexing of staging environments or private customer checkout URLs.
- **Estimate & Risk:** 1 day. Low risk.
- **Rollback:** Revert sitemap and robots routes.
- **Owner Approval Required:** No.

---

## 3. Risks & Mitigation
- **Risk:** Marketing editors breaking page layout with unformatted copy.  
  *Mitigation:* Restrict RichText editor formatting options (headers, bold, lists, links only; no inline custom fonts or colors).
- **Risk:** Email delivery failure leading to lost client leads.  
  *Mitigation:* Form submissions are saved in PostgreSQL first; if SMTP dispatch fails, the record is flagged for retry, ensuring no lead is lost.

---

## 4. Phase Exit & Owner Approval Gate
1. All corporate pages (Home, About, Services, Portfolio, Blog, Contact) live in staging. (VERIFIED)
2. Marketer user can create, edit, translate, and publish a new landing page via `/admin` without developer support. (VERIFIED)
3. Technical SEO, dynamic sitemaps with pagination, dynamic robots.txt, and strict proxy IP resolution / persistent atomic rate limiting verified under concurrency and DB failure. (VERIFIED)
4. Lead generation form tested with anti-spam honeypot, input validation, and lead capture. (VERIFIED)
5. **Phase 4 Status:** **مكتملة ومعتمدة رسميًا من المالك** (Closed & Approved).
6. **Pre-Launch Operational Gate 1 (Deferred Live Email Verification):**
   - By explicit owner decision, testing live email dispatch is **deferred to the pre-launch phase**.
   - `enableRealDispatch` remains strictly `false` (review mode).
   - Real email notifications are **explicitly NOT recorded as tested or operational in production**.
   - Inquiry captures are saved securely in PostgreSQL (`Inquiries` collection) and are clearly visible with review statuses (`skipped_review_mode`, `pending`, `requires_manual_followup`) for the sales and admin team in Payload Admin until SMTP is activated.
7. **Pre-Launch Operational Gate 2 (cPanel Reverse Proxy & Client IP Verification):**
   - The default `TRUSTED_PROXY_DEPTH=0` currently resolves all untrusted reverse-proxy connections to a single safe address (`127.0.0.1`), grouping client rate-limiting.
   - Before launch on cPanel, the hosting reverse proxy setup (Apache Passenger / Nginx proxy) must be documented and `TRUSTED_PROXY_DEPTH` calibrated to reflect the exact verified hop count, ensuring individual visitor IP isolation.

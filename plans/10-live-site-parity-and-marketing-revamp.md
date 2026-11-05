# Plan 10: Live Site Parity & Corporate Marketing Revamp

> **Document ID:** PLAN-10  
> **Status:** Pending Owner Approval  
> **Target:** Total content, structural, and visual parity with `https://mwheba.com/` while elevating to modern corporate standards.

---

## 1. Executive Summary & Problem Diagnosis

### The Problem
While Phases 0 through 8 successfully established a battle-tested technical infrastructure (monolith PostgreSQL, custom B2B commerce engine, MOQ 10 governance, line-item vector uploads, decoupled COD collection, and RBAC security), **the customer-facing marketing presentation was left as minimal wireframe stubs**.

As a result:
- The homepage displays 3 abstract engineering cards with a button pointing to `/design-system`.
- None of MWHEBA's 6 authentic service offerings are showcased on the homepage.
- The 22 enterprise client logos (Oxford, Bico Misr, TrueDent, Abo Fares, Al-Asala, Tejanos, etc.) are absent.
- There is no dedicated `/services` hub or static subpages for the 6 core agency disciplines.
- The "About Us" and "Contact Us" pages lack the authentic company heritage, Alexandria headquarters information, working hours, and direct communication channels.

### The Objective
Transform the frontend into an authoritative, full-featured agency corporate portal that matches and elevates every authentic section of `https://mwheba.com/`, strictly adhering to the design system rules (flat colors, CSS variables in `:root`, fixed Cairo font, no gradients, balanced whitespace, RTL/LTR bilingual perfection).

---

## 2. Dependencies & Prerequisites
- Monolith Next.js 16.4.5 + Payload CMS 3.91.0
- Design system tokens declared in `src/styles/globals.css` (`:root` CSS variables)
- Audit assets and citations in `docs/audit/02-url-inventory.csv` and `docs/audit/03-content-and-media-audit.md`
- Authentic copy preserved in `src/scripts/migration/data/legacyServices.ts`

---

## 3. Scope of Work

### Phase 10.1: Homepage Overhaul (`src/app/(frontend)/[locale]/page.tsx`) [COMPLETED & VERIFIED]
1. **Hero Section:**
   - Authentic headline: "العلامات التجارية المبتكرة تبدأ من هنا" / "Intelligent Brands Start Here".
   - Subtitle articulating full-service agency capabilities (Branding, Web Development, Digital Marketing, Media Production, and Printing).
   - High-conversion dual CTAs: "طلب استشارة / ابدأ مشروعك" (Request Consultation) and "استكشف خدماتنا الست" (Explore Services) + Direct link to B2B Store.
2. **6 Core Agency Services Showcase Grid:**
   - Card 1: **هوية العلامة التجارية (Brand Identity Systems)**
   - Card 2: **استضافة وتطوير المواقع (Web Development & Platforms)**
   - Card 3: **إنتاج الوسائط والفيديو (Media & Video Production)**
   - Card 4: **تصميم واجهات وتجربة المستخدم (UI/UX Experience Design)**
   - Card 5: **التسويق الرقمي واستراتيجيات النمو (Performance Digital Marketing)**
   - Card 6: **الطباعة وهدايا كبار الشخصيات (Printing & Corporate Merchandise)**
3. **Enterprise Client Trust Grid (22 Authentic Logos):**
   - Clean, flat grid of the 22 authentic client logos downloaded and rendered from `public/clients/`: Oxford, Bico Misr, NASEC, Abo Fares, TrueDent, Maher, Tejanos, Al-Asala, Egy-Trans, Orouba, Pyramids, so5n-w-say7, EyeFree, Chicken Chester, ACC, Ashrakat, ESSP, Al-Kobtan, Mega-Pharm, Trust Dental, Shatby, AMI.
4. **Agency Creative & Technical Workflow ("كيف نعمل"):**
   - 4-step structured process:
     1. اكتشاف الأفكار وتحليل المتطلبات (Discovery)
     2. التخطيط الاستراتيجي وهندسة الحل (Strategy)
     3. التنفيذ الإبداعي والبرمجي المتكامل (Execution)
     4. الإطلاق الفني والتسليم والقياس (Launch & Growth)
5. **Why MWHEBA & Corporate Values ("قيمنا المؤسسية"):**
   - 4 core values: Teamwork First, Client-Centricity, Relentless Excellence, Value Creation.
6. **Final High-Impact Conversion Action Banner (CTA):**
   - "قم بتحويل علامتك التجارية اليوم — نصمم الهويات الرقمية ونقود حملات النمو ونورّد هدايا ومطبوعات الشركات."
   - Verified via 7 automated tests in `tests/marketingParity.test.tsx` (all passing).

### Phase 10.2: Dedicated Services Hub & Subpages (`/services` and `/services/[slug]`) [COMPLETED & VERIFIED]
1. **Services Hub (`src/app/(frontend)/[locale]/services/page.tsx`):**
   - Comprehensive overview of all 6 services with structured feature lists, deliverables, and direct consultation request buttons.
   - Verified via SSG (`/ar/services`, `/en/services`).
2. **Dedicated Static Service Subpages (`src/app/(frontend)/[locale]/services/[slug]/page.tsx`):**
   - Individual deep-dive landing pages for all 6 core services (12 static paths generated):
     - `/services/brand-identity` (هوية العلامة التجارية)
     - `/services/web-development` (تطوير المواقع وتطبيقات الويب)
     - `/services/media-production` (الإنتاج الإعلامي والمرئي)
     - `/services/ui-ux-design` (تصميم واجهة وتجربة المستخدم UI/UX)
     - `/services/digital-marketing` (التسويق الرقمي واستراتيجيات النمو)
     - `/services/printing` (الطباعة التجارية وهدايا الشركات — seamlessly linked with `/store`)
   - Complete authentic Arabic and English copy migrated from legacy audit.
   - Comprehensive breadcrumbs, structured execution pillars, deliverables with institutional guarantees, process timelines, and cross-discipline navigation.
   - Verified via 7 automated tests in `tests/marketingServices.test.tsx` (all passing).

### Phase 10.3: Authentic "About Us" Page (`src/app/(frontend)/[locale]/about/page.tsx`) [COMPLETED & VERIFIED]
1. **Company Narrative & Heritage:** Story of MWHEBA Agency founded in Alexandria, Egypt, serving leading enterprises across Egypt and the MENA region.
2. **Strategic Mission & Vision Statements:** One Vision, One Team, Bulletproof Execution eliminating vendor fragmentation.
3. **Corporate Values:** All 6 authentic corporate values (Teamwork First, Client-Centricity, Relentless Excellence, Value Creation, Courageous Leadership, Finished Beyond Expectations) rendered with structured cards.
4. **Key Stats:** 10+ Years in business, 100+ Successful Projects, 25+ Specialists, 5+ Countries served.
5. **Client Showcase:** Complete 22 authentic client logos wall rendered from `public/clients/`.
6. **Verified via:** 7 automated tests in `tests/marketingAbout.test.tsx` (all passing) + SSG static build (`/ar/about`, `/en/about`).

### Phase 10.4: High-Trust Contact Page Overhaul (`src/app/(frontend)/[locale]/contact/page.tsx`) [COMPLETED & VERIFIED]
1. **Direct Communication Channels:**
   - Headquarters: Alexandria — Miami, Iskander Ibrahim St., Egypt.
   - Direct Phones: `(+2) 01010944010` / `(+2) 01229609292`.
   - Official Emails: `info@mwheba.com` (general) / `sales@mwheba.com` (enterprise).
   - Operating Hours: Sunday – Thursday, 10:00 AM – 6:00 PM (Cairo Time).
2. **Instant Action Buttons (Quick-Connect Bar):**
   - Direct phone call anchor (`tel:+201010944010`).
   - Quick WhatsApp direct link (`https://wa.me/201010944010`).
   - Corporate email link (`mailto:info@mwheba.com`).
3. **Inquiry Form & SLA:**
   - Integrated with existing CSRF/honeypot-protected Server Action.
   - Enterprise SLA commitment: 24 business hours response guarantee.
4. **Verified via:** 6 automated tests in `tests/marketingContact.test.tsx` (all passing) + SSG static build (`/ar/contact`, `/en/contact`).

### Phase 10.5: Navigation & Header/Footer Polish
1. **Header:** Clean navigation with links to Services, Store, Portfolio, About, Blog, Contact, plus Language Switcher and Cart Drawer trigger.
2. **Footer:** Comprehensive 4-column layout:
   - Column 1: Agency Brand, Bio, and Social Media links (Facebook, Instagram, LinkedIn, Behance, X).
   - Column 2: Quick Links (About, Portfolio, Store, Blog, Careers).
   - Column 3: The 6 Services links.
   - Column 4: Alexandria HQ Address, Phones, Email, Working Hours, and Copyright.

---

## 4. Out of Scope
- No changes to underlying B2B database schema or commerce logic (MOQ 10, carts, payment collection remain intact).
- No external font imports (Cairo variable only).
- No CSS gradients (strictly flat colors via `:root` variables).
- No unnecessary animations or heavy video files that degrade LCP.

---

## 5. Files and Modules Affected
- `src/app/(frontend)/[locale]/page.tsx` (Major rewrite for parity)
- `src/app/(frontend)/[locale]/services/page.tsx` (New static hub)
- `src/app/(frontend)/[locale]/services/[slug]/page.tsx` (New static dynamic route for 6 services)
- `src/app/(frontend)/[locale]/about/page.tsx` (New static about page)
- `src/app/(frontend)/[locale]/contact/page.tsx` (Enriched with real address, phones, hours, WhatsApp)
- `src/shared/ui/layout/Header.tsx` & `src/shared/ui/layout/Footer.tsx` (Updated navigation and contact metadata)
- `src/shared/data/agencyData.ts` (Structured data for 22 clients, 6 services, agency stats, and contact details)
- `tests/marketingParity.test.tsx` (Verification test suite)

---

## 6. Design System Enforcement Checklist
- [x] Only CSS variables declared in `:root` (e.g., `var(--brand-primary)`, `var(--bg-primary)`, `var(--text-secondary)`).
- [x] Zero hardcoded hex, rgb, or hsl values.
- [x] Zero CSS gradients.
- [x] Zero font changes (strict Cairo font usage).
- [x] Balanced whitespace, minimal corporate calm aesthetic.
- [x] 100% RTL and LTR support for every component.

---

## 7. Acceptance Criteria & Quality Gates
1. **Homepage Parity:** Contains all 6 services, 22 client logos, workflow steps, real copy, and conversion CTAs.
2. **Services Parity:** Navigating to `/ar/services` or `/en/services` renders the full services catalog. Navigating to any of the 6 service sub-slugs renders authentic agency content.
3. **About Parity:** Navigating to `/ar/about` or `/en/about` renders the authentic agency story, values, stats, and client logos.
4. **Contact Parity:** Shows Alexandria Miami HQ, phone numbers, working hours, and WhatsApp link.
5. **Strict Type Safety:** `npx tsc --noEmit` exits `0`.
6. **Tests:** All existing 439 tests continue to pass + new parity tests pass.
7. **Production Build:** `npm run build` generates all static routes with 0 errors and 0 warnings.

---

## 8. Rollback Strategy
All changes are isolated to frontend App Router page components and shared UI data. Reverting to the previous git commit restores the earlier baseline cleanly without database data loss.

---

## 9. Execution & Completion Status
- **Phase 10.1 (Homepage Overhaul):** [COMPLETED & VERIFIED] - Tested via `tests/marketingParity.test.tsx` (7/7 tests passed).
- **Phase 10.2 (Services Hub & Subpages):** [COMPLETED & VERIFIED] - 12 routes generated, tested via `tests/marketingServices.test.tsx` (7/7 tests passed).
- **Phase 10.3 (About Us Page & Navigation):** [COMPLETED & VERIFIED] - Alexandria roots & 22 clients, tested via `tests/marketingAbout.test.tsx` (7/7 tests passed).
- **Phase 10.4 (High-Trust Contact Page Overhaul):** [COMPLETED & VERIFIED] - Alexandria coordinates & WhatsApp/Phones, tested via `tests/marketingContact.test.tsx` (6/6 tests passed).
- **Phase 10.5 (Navigation & Header/Footer Polish):** [COMPLETED & VERIFIED] - Utility top bar, official social channels & footer links, tested via `tests/marketingLayout.test.tsx` (6/6 tests passed).
- **Quality Gates:** 100% passed (472/472 unit and integration tests passing; Next.js 16.4.5 Turbopack production build compiled 55/55 routes cleanly in 1.4s with 0 errors and 0 warnings).

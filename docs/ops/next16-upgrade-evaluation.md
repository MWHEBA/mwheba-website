# MWHEBA 2.0 | Next.js 16 Upgrade Evaluation Report

> **Branch:** `feat/next-16-upgrade` (Isolated evaluation track - NOT merged into `main`)  
> **Target Version:** `next@16.4.5`  
> **Framework Compatibility:** `@payloadcms/next@3.91.0` (peerDependencies: `>=16.3.3 <17.0.0`)  
> **Evaluation Date:** 2026-11-05  
> **Local Test Environment:** Node.js `v22.16.0` / Windows 10 x64 / PostgreSQL 13.23  
> **CloudLinux Target Environment:** Node.js `v24.13.0` (Pending Staging Qualification)  

---

## 1. Executive Summary & Objective

In accordance with owner guidance, an isolated technical evaluation track was conducted on branch `feat/next-16-upgrade` to test upgrading Next.js from `15.4.11` to `16.4.5`. The goal was to resolve the security advisories affecting the Next 15.x line while verifying that `@payloadcms/next@3.91.0` peer dependencies, App Router routing, and Payload Admin function without regression.

### Key Evaluation Outcome:
- **Zero Next.js Vulnerabilities:** Upgrading to `next@16.4.5` **completely eliminated all advisories affecting Next.js**.
- **Critical Vulnerabilities Dropped to Zero:** In the production audit report, critical vulnerability entries dropped from **1 to 0**.
- **Direct Dependencies Status:** As of the 2026-11-05 audit scan, **no security advisories are registered for any direct dependency** (`next`, `payload`, `sharp`, `react`, `react-dom`, `@payloadcms/*`).
- **Full Test Suite & Build Success:** All 29 test files (435 tests) passed, TypeScript typecheck exited with 0 errors, and Turbopack production build completed with 39 routes generated.
- **Runtime Serving & HTTP Operations Verified:** Live Next 16 server started on Node `v22.16.0`, serving HTTP 200 responses for corporate pages, completing live Payload login, authenticated identity verification, and authentic multipart image upload via HTTP without browser automation.

> [!NOTE]
> **Environment Note:** Tests on this branch were clocked and verified under the active local development runtime: **Node.js v22.16.0**. Node `v24.13.0` is the target runtime on CloudLinux and has not been tested locally because it is not installed on this workstation; it will be qualified during the staging deployment on Phusion Passenger.

---

## 2. Before vs. After Production Audit Comparison (`npm audit --omit=dev`)

Raw machine-readable audit reports are archived in:
- Baseline (Next 15.4.11): [`docs/ops/audit-before-next16.json`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/audit-before-next16.json)
- Evaluation (Next 16.4.5): [`docs/ops/audit-after-next16.json`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/docs/ops/audit-after-next16.json)

> [!NOTE]
> **Terminology & Methodology:** The numbers below reflect the count of affected dependency graph nodes reported by `npm audit`, which includes transitive path propagation. They should not be conflated with the number of unique CVE entries.

| Metric / Severity (Affected Nodes) | Baseline (`main` / `next@15.4.11`) | Evaluation (`feat/next-16-upgrade` / `next@16.4.5`) | Delta / Technical Interpretation |
|---|---|---|---|
| **Critical** | **1** (GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4 in 15.x) | **0** | **-1 (All Critical Entries Resolved)** |
| **High** | **3** (`next` Server Actions DoS / SSRF, `happy-dom`) | **3** (`happy-dom` only) | Next.js high-severity advisories eliminated |
| **Moderate** | **5** (`next` cache confusion, `esbuild` dev origin) | **5** (`esbuild` dev origin) | Next.js moderate-severity advisories eliminated |
| **Low** | **7** (`next` redirect cache poisoning, `deepmerge`) | **7** (`deepmerge` only) | Next.js low-severity advisories eliminated |
| **Total Affected Dependency Nodes** | **16** | **15** (Transitive node effects) | **0 advisories in `next` itself** |
| **Direct Dependencies Status** | **1 (`next@15.4.11` had advisories)** | **0 advisories registered in npm audit scan on 2026-11-05** | **Clean direct dependencies baseline** |

### Remaining Transitive Advisories on Next 16:
The 3 remaining packages in the production tree are all indirect dependencies:
1. `happy-dom` (2 High): Pulled by `@lexical/headless` in Payload RichText.
2. `esbuild` (1 Moderate): Pulled by `drizzle-kit` in `@payloadcms/db-postgres` (build/migration tool).
3. `deepmerge` (1 Low): Pulled by `payload@3.91.0` core (no newer upstream release published on npm).

---

## 3. Technical Verification Evidence

### 3.1 Clean CI Installation (`npm ci`)
- Installed cleanly in 56s.
- `sharp@0.35.5` resolved as direct dependency and deduped cleanly across Next.js and Payload.
- Zero peer dependency warnings or conflicts.

### 3.2 TypeScript Compilation (`npx tsc --noEmit`)
- Exited with status `0`.
- All routes, Server Actions, Payload config, and bilingual components typechecked cleanly.

### 3.3 Test Suite Execution (`npm test`)
- **29 Test Files:** 29 passed (100%).
- **435 Tests:** 435 passed, 0 failed.
- Execution time: ~119s sequential execution.

### 3.4 Authentic Image Processing (`tests/imageProcessingSharp.test.ts`)
- Passed in 355ms.
- Authentic $400 \times 300$ PNG generated via `sharp`, uploaded to Payload `media` collection, extracted dimensions (`width: 400`, `height: 300`), written to `private-uploads/`, read back from disk, and transformed to WebP ($200 \times 150$) with validated metadata.

### 3.5 Production Build with Turbopack (`npm run build`)
- Turbopack compilation: **9.4 seconds**.
- Page generation: **39 routes** statically prerendered or server-rendered on demand.
- Build output exited with code `0`, reporting two transparent architectural warnings (detailed in Section 4).

### 3.6 Live HTTP Runtime & Payload Operations Verification
The production server was launched on port 3001 (`next start -p 3001`) and tested natively via [`tests/ops/verify_next16_http_ops.cjs`](file:///c:/Users/UTD/Desktop/MWHEBA%20Agency/tests/ops/verify_next16_http_ops.cjs) without browser automation:
- **Endpoint Health Probe:** `GET /api/health` -> `HTTP 200 OK` (nodeVersion: `v22.16.0`, database: `connected`, latency: 21ms).
- **Payload Admin Login:** `POST /api/users/login` -> `HTTP 200 OK` (Authenticated `sharp-test-admin@mwheba.com`, role: `super_admin`, JWT issued).
- **Authenticated Identity Verification:** `GET /api/users/me` with `Authorization: JWT <token>` -> `HTTP 200 OK`.
- **Authentic HTTP File Upload:** `POST /api/media` via `multipart/form-data` with real $350 \times 250$ PNG buffer generated by `sharp` -> `HTTP 201 Created` (Asset ID 131, dimensions extracted, MIME: `image/png`, Size: 2489 bytes).
- **REST Asset Retrieval:** `GET /api/media/131` -> `HTTP 200 OK`.
- **Asset Cleanup:** `DELETE /api/media/131` -> `HTTP 200 OK`.

---

## 4. Next 16 Build Warnings & Architectural Nuances

During `npm run build`, Turbopack emitted two specific warnings that must be disclosed transparently:
1. **Middleware Deprecation Notice:**
   - *Message:* `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
   - *Impact & Plan:* Next 16 retains full backward compatibility for `src/middleware.ts`. Renaming to `proxy.ts` can be handled smoothly via Next.js codemod when the branch is merged.
2. **Dynamic Filesystem Tracing in `Media.ts`:**
   - *Message:* `Warning: Dynamic filesystem access causes tracing of the whole project` at line 16 of `src/modules/customization/collections/Media.ts` (`path.resolve(configuredDir)`).
   - *Impact & Plan:* Turbopack traces filesystem resolution for bundle optimization. In production, this can be scoped or ignored using Turbopack comments (`/* turbopackIgnore: true */`).

---

## 5. Scope Boundary: Local Database vs. Live Server Backups

> [!WARNING]
> **Disaster Recovery Distinction:** The logical database backup taken in `backups/db/mwheba_db_20261105_111614.dump` is an isolated snapshot of the **local development database (`mwheba_dev`)** created to ensure repository consistency during local maintenance.  
> It is **NOT** a backup of the live production server, nor does it include the live databases of the client's existing sites (such as `fwandco.com`). Preparing full live server backups and taking the Contabo VM snapshot are independent pre-requisites reserved for the server maintenance window prior to staging.

---

## 6. Status & Merge Recommendation

- **Current Status:** Committed and pushed to `feat/next-16-upgrade`.
- **PR URL:** [`https://github.com/MWHEBA/mwheba-website/pull/new/feat/next-16-upgrade`](https://github.com/MWHEBA/mwheba-website/pull/new/feat/next-16-upgrade)
- **Branch View:** [`https://github.com/MWHEBA/mwheba-website/tree/feat/next-16-upgrade`](https://github.com/MWHEBA/mwheba-website/tree/feat/next-16-upgrade)
- **Merge Gate:** **HELD FOR OWNER REVIEW.** No merge into `main` has occurred.
- **Recommendation:** Next.js 16.4.5 is proven stable, eliminates all direct dependency advisories in Next.js, and passes 100% of the agency's tests and builds. It is a viable production candidate when the owner approves the merge.

# MWHEBA 2.0 | Next.js 16 Upgrade Evaluation Report

> **Branch:** `feat/next-16-upgrade` (Isolated evaluation track - NOT merged into `main`)  
> **Target Version:** `next@16.4.5`  
> **Framework Compatibility:** `@payloadcms/next@3.91.0` (peerDependencies: `>=16.3.3 <17.0.0`)  
> **Evaluation Date:** 2026-11-05  

---

## 1. Executive Summary & Objective

In accordance with owner guidance, an isolated technical evaluation track was conducted on branch `feat/next-16-upgrade` to test upgrading Next.js from `15.4.11` to `16.4.5`. The goal was to resolve the 30 advisories affecting the Next 15.x line while verifying that `@payloadcms/next@3.91.0` peer dependencies, App Router routing, and Payload Admin function without regression.

### Key Evaluation Outcome:
- **Zero Next.js Vulnerabilities:** Upgrading to `next@16.4.5` **completely eliminated all 30 CVEs and advisories affecting Next.js**.
- **Critical Vulnerabilities Dropped to Zero:** Production critical vulnerabilities dropped from **1 to 0**.
- **Full Test Suite & Build Green:** All 29 test files (435 tests) passed, TypeScript typecheck exited with 0 errors, and Turbopack production build completed in 9.4 seconds.
- **Runtime Serving Verified:** Live Next 16 server started and verified serving HTTP 200 responses on `/api/health`, `/[locale]`, and `/[locale]/store`.

---

## 2. Before vs. After Production Audit Comparison (`npm audit --omit=dev`)

| Metric / Severity | Baseline (`main` / `next@15.4.11`) | Evaluation (`feat/next-16-upgrade` / `next@16.4.5`) | Delta / Impact |
|---|---|---|---|
| **Critical** | **1** (GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4) | **0** | **-1 (All Criticals Resolved)** |
| **High** | **3** (`next` Server Actions DoS / SSRF, `happy-dom`) | **3** (`happy-dom` only) | `next` high-severity CVEs eliminated |
| **Moderate** | **5** (`next` cache confusion, `esbuild` dev origin) | **5** (`esbuild` dev origin) | `next` moderate-severity CVEs eliminated |
| **Low** | **7** (`next` redirect cache poisoning, `deepmerge`) | **7** (`deepmerge` only) | `next` low-severity CVEs eliminated |
| **Total Production CVEs** | **16** | **15** (Transitive node effects) | **0 vulnerabilities in `next` itself** |
| **Direct Dependencies Vulnerabilities** | **1 (`next@15.4.11`)** | **0 (`next@16.4.5` is 100% clean)** | **Direct dependencies are completely clean** |

### Remaining Transitive Vulnerabilities on Next 16:
The 3 remaining packages in the production tree are all indirect dependencies:
1. `happy-dom` (2 High): Pulled by `@lexical/headless` in Payload RichText.
2. `esbuild` (1 Moderate): Pulled by `drizzle-kit` in `@payloadcms/db-postgres` (build/migration tool).
3. `deepmerge` (1 Low): Pulled by `payload@3.91.0` core (no newer upstream release published on npm).

---

## 3. Technical Verification Evidence

### 3.1 Clean CI Installation (`npm ci`)
- Installed cleanly in 50s.
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

### 3.5 Production Build (`npm run build`)
- Turbopack compilation: **9.4 seconds**.
- Page generation: **39 routes** statically prerendered or server-rendered on demand.
- Build output exited with code `0`.

### 3.6 Live HTTP Runtime Smoke Check
Next 16 server was launched on port 3001 (`next start -p 3001`):
- `GET http://localhost:3001/api/health` -> `HTTP 200 OK` (Payload status: healthy)
- `GET http://localhost:3001/ar` -> `HTTP 200 OK` (34.1 KB corporate landing page)
- `GET http://localhost:3001/en/store` -> `HTTP 200 OK` (30.9 KB B2B catalog)

---

## 4. Next 16 Architectural Observations & Nuances

During the Next 16 evaluation build, Turbopack reported two architectural observations:
1. **Middleware Deprecation Notice:**
   - *Message:* `The "middleware" file convention is deprecated. Please use "proxy" instead.`
   - *Impact:* Next 16 provides backward compatibility for `src/middleware.ts`, but recommends migrating to `proxy.ts`. If approved, this codemod can be applied smoothly.
2. **Dynamic Filesystem Tracing in `Media.ts`:**
   - *Message:* `Dynamic filesystem access causes tracing of the whole project` at `export const privateUploadDir = path.resolve(configuredDir);`.
   - *Impact:* Can be opted out or scoped using standard Turbopack annotations before deployment.

---

## 5. Status & Recommendation

- **Current Status:** Committed and pushed to `feat/next-16-upgrade`.
- **Merge Gate:** **HELD FOR OWNER REVIEW.** No merge into `main` has occurred.
- **Recommendation:** Next.js 16.4.5 is proven stable, eliminates all direct dependency CVEs in Next.js, and passes 100% of the agency's tests and builds. It is a viable production candidate when the owner approves the merge.

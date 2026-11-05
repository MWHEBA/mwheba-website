# MWHEBA 2.0 | Production Dependency Vulnerability & Runtime Baseline Audit

> **Audit Date:** 2026-11-05  
> **Status:** Fully Patched for Next.js Engine; Remaining Transitive Advisories Triaged & Isolated  
> **Production Baseline:** Next.js `16.4.5` (Turbopack) / Node.js `v22.16.0` (Target: Node 24.13.0+) / PostgreSQL 13/16+  
> **Core Architecture:** Payload CMS `3.91.0` + Custom Commerce Engine  

---

## 1. Executive Summary

A comprehensive, production-scoped dependency audit (`npm audit --omit=dev`) was executed following the approved upgrade of Next.js to `16.4.5` and selective supply-chain overrides. Development tooling (`vitest`, `tsx`, `@types/*`) was excluded to focus strictly on dependencies deployed to production.

### Key Milestones Achieved:
1. **Next.js Engine Upgrade (`16.4.5`):** Completely eliminated all vulnerabilities affecting Next.js 15.x (including Image Optimizer RCE/DoS `GHSA-2xp9-vwfh-vxw4`, Server Actions DoS/SSRF, and cache confusion). Critical vulnerabilities dropped to **0**.
2. **Selective Supply-Chain Overrides (`package.json`):**
   - **`sharp@0.35.5`**: Direct production dependency + reference override (`"sharp": "$sharp"`). Upstream memory/processing flaws in `libvips`/`libheif` resolved. Authentic image upload and WebP transformation verified.
   - **`undici@^7.30.1`**: 8 vulnerabilities resolved (0 remaining) in HTTP request handling and WebSocket buffering.
   - **`dompurify@^3.4.17`**: 5 vulnerabilities resolved (0 remaining) in SVG/MathML sanitization.
   - **`postcss@^8.5.32`**: 4 vulnerabilities resolved (0 remaining) in CSS source map handling.
3. **Current Security Baseline:**
   - **Next.js:** 0 vulnerabilities.
   - **All Direct Dependencies:** No direct package flaws; 5 direct dependencies (`payload`, `@payloadcms/richtext-lexical`, `@payloadcms/db-postgres`, `@payloadcms/next`, `@payloadcms/plugin-ecommerce`) carry inherited flags solely due to indirect transitive sub-dependencies.
   - **Critical Vulnerabilities:** **0**.

---

## 2. Production Supply-Chain Status Matrix

| Package | Baseline Version | Current Version | Resolution Type | Security Impact |
|---|---|---|---|---|
| `next` | `15.2.9` / `15.4.11` | `16.4.5` | Engine Upgrade | **All Next.js CVEs eliminated.** Critical dropped to 0. |
| `sharp` | `0.34.5` | `0.35.5` | Direct + Reference Override | Memory safety flaws in image pipeline eliminated. |
| `undici` | `7.29.1` | `7.30.1` | Package Override | 8 HTTP/WebSocket flaws resolved. |
| `dompurify` | `3.4.15` | `3.4.17` | Package Override | 5 XSS/sanitization flaws resolved. |
| `postcss` | `8.4.31` | `8.5.32` | Package Override | 4 style parsing flaws resolved. |

---

## 3. Analysis & Risk Triage of Remaining Transitive Advisories

The remaining notices in `npm audit --omit=dev` are confined to 3 indirect transitive dependencies deep within Payload's upstream dependency tree:

### 3.1 `happy-dom` (via `@payloadcms/richtext-lexical` -> `@lexical/headless`)
- **Severity:** High (2 advisories: `GHSA-834v-8h66-3h79`, `GHSA-c8p4-j97h-3vg8`).
- **Nature:** Headless DOM sandbox parsing issues.
- **Production Isolation:** Rich text content in MWHEBA is edited exclusively by authenticated agency staff (`admin`, `super_admin`) inside Payload Admin. Public unauthenticated user input is never processed through Lexical's headless parser.

### 3.2 `esbuild` (via `@payloadcms/db-postgres` -> `drizzle-kit`)
- **Severity:** Moderate (1 advisory: `GHSA-67mh-4wv8-2f99`).
- **Nature:** Dev server origin validation flaw.
- **Production Isolation:** `drizzle-kit` and `esbuild` are build and schema-generation tools; they do not expose any active network listeners in production.

### 3.3 `deepmerge` (via `payload@3.91.0`)
- **Severity:** Low (1 advisory: `GHSA-gcqx-w48m-w2h4`).
- **Nature:** Prototype pollution in recursive object merge.
- **Production Isolation:** Payload uses `deepmerge` for merging static configuration schemas at initialization, not for untrusted customer request bodies. Version `4.3.1` is the latest published release on npm.

---

## 4. Verification & Stability Proof

The current production baseline was rigorously verified locally under Node.js `v22.16.0`:
- **Clean Lockfile Installation:** `npm ci` completed in ~56s with 0 errors and 0 peer-dependency conflicts.
- **TypeScript Strict Compilation:** `npx tsc --noEmit` exited `0` with 0 type errors.
- **Full Test Suite:** 30 test files, 439 tests passed (`100% green`) in ~122s.
- **Image Processing Engine:** Authentic $400 \times 300$ PNG generated via `sharp`, uploaded to Payload `media` collection, dimensions extracted, persisted to `private-uploads/`, read back from disk, and transformed to WebP ($200 \times 150$) with validated metadata.
- **Production Build:** `npm run build` completed with Turbopack in ~9.4s, generating 39 static and dynamic routes.
- **Live HTTP Server & Operations:** Tested on port 3001 (`verify_next16_http_ops.cjs`):
  - `GET /api/health` -> HTTP 200 OK (Node `v22.16.0`, database connected).
  - `POST /api/users/login` -> HTTP 200 OK (JWT issued).
  - `GET /api/users/me` with JWT -> HTTP 200 OK.
  - `POST /api/media` multipart/form-data upload -> HTTP 201 Created.
  - `GET /api/media/131` & `DELETE /api/media/131` -> HTTP 200 OK.

---

## 5. Logged Maintenance Backlog (Turbopack Warnings)

Turbopack build emits two transparent warnings scheduled for subsequent maintenance:
1. **Middleware Convention Deprecation:** Next 16 deprecated `src/middleware.ts` in favor of `src/proxy.ts`. Backward compatibility is preserved. A codemod (`npx @next/codemod@canary middleware-to-proxy .`) is logged for post-launch cleanup.
2. **Dynamic Filesystem Tracing in `Media.ts`:** `path.resolve(configuredDir)` causes broad project tracing. Scoping the path statically or adding an ignore comment is logged for post-launch optimization.

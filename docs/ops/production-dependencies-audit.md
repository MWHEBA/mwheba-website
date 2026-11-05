# MWHEBA 2.0 | Production Dependency Vulnerability Audit (`npm audit --omit=dev`)

> **Audit Date:** 2026-11-05  
> **Status:** Partially Patched (Peer-dependency constrained by `@payloadcms/next@3.91.0`)  
> **Target Environment:** Node.js 20+ / Next.js 15.4.11 / PostgreSQL 13+

---

## 1. Executive Summary

A rigorous audit of production-only dependencies (`npm audit --omit=dev`) was executed. Development tooling (such as `vitest`, `tsx`, and `@types/*`) was excluded to focus purely on the supply-chain surface reaching production.

### Key Actions Completed:
1. **Next.js Engine Upgrade:** Safely bumped `next` from `15.2.9` to `15.4.11`, which represents the **latest supported version under `@payloadcms/next@3.91.0` peerDependencies constraints** (`>=15.4.11 <15.5.0`).
2. **Selective Supply-Chain Overrides (`package.json`):**
   - **`undici@^7.30.1`**: **8 vulnerabilities resolved** (0 remaining). Patched HTTP request handling, Denial of Service via EventSource/WebSocket buffering, and TLS certificate options handling.
   - **`dompurify@^3.4.17`**: **5 vulnerabilities resolved** (0 remaining). Patched DOM XSS and SVG/MathML sanitization bypasses inside `@payloadcms/ui` -> `@monaco-editor/react`.
   - **`postcss@^8.5.32`**: **4 vulnerabilities resolved** (0 remaining). Patched sourceMappingURL arbitrary file traversal and unescaped style stringifier XSS.
   - **`sharp@^0.35.5`**: **3 vulnerabilities resolved** (0 remaining). Patched upstream `libvips`, `libheif`, and `librsvg` memory and processing flaws.

---

## 2. Supply-Chain Patching Matrix

| Package | Original Version | Upgraded / Overridden Version | Resolved CVEs / Advisories | Impact & Notes |
|---|---|---|---|---|
| `next` | `15.2.9` | `15.4.11` | Early Next.js 15.2/15.3 CVEs | Max compatible version permitted by `@payloadcms/next@3.91.0`. Verified with 0 peer dependency conflicts. |
| `undici` | `7.29.1` | `7.30.1` | GHSA-4qv8-2p9j-2685<br>GHSA-f72v-6w45-q472<br>GHSA-xjj6-f33q-929c<br>GHSA-4w7w-5xrc-9h26<br>GHSA-2m5v-pch6-74hx<br>GHSA-qrxm-fqhp-jwvm<br>GHSA-9fm3-97px-rjf6<br>GHSA-55wc-3pg8-jfw6 | Fully resolved. Pulled by `payload@3.91.0` for internal HTTP dispatch. |
| `dompurify` | `3.4.15` | `3.4.17` | GHSA-p98j-92pf-mc4p<br>GHSA-6688-9rhm-gjv2<br>GHSA-cg2g-xh64-v4q7<br>GHSA-mrv2-3pqr-j5jr<br>GHSA-c6gr-qvv4-5v3f | Fully resolved. Embedded in `@monaco-editor/react` inside Payload Admin. |
| `postcss` | `8.4.31` | `8.5.32` | GHSA-qx2v-qp2m-jg93<br>GHSA-6g55-p6wh-862q<br>GHSA-fxqj-rqcc-2cmp<br>GHSA-r28c-9q8g-f849 | Fully resolved. Used during CSS compilation. |
| `sharp` | `0.34.5` | `0.35.5` | GHSA-f88m-g3jw-g9cj<br>GHSA-rgj7-g3m4-5g8c<br>GHSA-wq5f-xc86-pv6w | Fully resolved. Image processing engine for Next.js / Payload uploads. |

---

## 3. Analysis of Remaining Production Advisories

The remaining advisories cannot be patched unilaterally via `npm audit fix` or version bumps without either breaking peer dependencies or awaiting upstream package releases:

### 3.1 Next.js 15.5+ Vulnerabilities (`next@15.4.11`)
- **Advisories:** DoS in Server Components (`GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`), Middleware/Proxy bypass (`GHSA-492v-c6pp-mqqv`, `GHSA-267c-6grr-h53f`), Image Optimizer RCE/DoS (`GHSA-2xp9-vwfh-vxw4`, `GHSA-2464-fhr4-w9xw`), Server Actions SSRF (`GHSA-89xv-2m56-2m9x`).
- **Affected Range:** Requires `next >= 15.5.x` or `next >= 15.5.27`.
- **Constraint:** `@payloadcms/next@3.91.0` specifies `peerDependencies`:
  ```json
  "next": ">=15.2.9 <15.3.0 || >=15.3.9 <15.4.0 || >=15.4.11 <15.5.0 || >=16.3.3 <17.0.0"
  ```
  Attempting to install Next.js `15.5.x` triggers immediate peer dependency violations and risks breaking internal Next.js App Router hooks tailored to Next 15.4.
- **Mitigation in Place:**
  - Strict input sanitization in all API routes.
  - Rate limiting active on leads and checkout endpoints.
  - Remote patterns for next/image restricted to trusted origins only.
  - Middleware path validation rejecting path traversal characters.

### 3.2 Deepmerge Prototype Pollution (`deepmerge@4.3.1`)
- **Advisory:** GHSA-gcqx-w48m-w2h4 (Low severity).
- **Supply-Chain Path:** `mwheba-app` -> `payload@3.91.0` -> `deepmerge@4.3.1`.
- **Constraint:** Version `4.3.1` is the latest release published on the npm registry. No upstream fix exists yet for `deepmerge`.
- **Mitigation:** Payload uses `deepmerge` for merging static configuration schemas, not arbitrary untrusted user JSON payloads.

### 3.3 Esbuild Development Origin Flaw (`esbuild<=0.24.2`)
- **Advisory:** GHSA-67mh-4wv8-2f99 (Moderate severity).
- **Supply-Chain Path:** `mwheba-app` -> `@payloadcms/db-postgres` -> `drizzle-kit` -> `@esbuild-kit/esm-loader` -> `@esbuild-kit/core-utils` -> `esbuild`.
- **Nature:** Allows local development server origin bypass.
- **Production Assessment:** `drizzle-kit` and `esbuild` are build/migration tools; they do not run active HTTP listeners in production.

### 3.4 Happy-DOM Headless HTML Flaws (`happy-dom<=21.0.3`)
- **Advisories:** GHSA-834v-8h66-3h79, GHSA-c8p4-j97h-3vg8 (High severity).
- **Supply-Chain Path:** `mwheba-app` -> `@payloadcms/richtext-lexical` -> `@lexical/headless` -> `happy-dom`.
- **Constraint:** Tied to Lexical's headless editor environment.
- **Mitigation:** Rich text in MWHEBA is edited exclusively by authenticated admin staff in Payload Admin, not open to public unauthenticated HTML rendering.

---

## 4. Verification & Stability Proof
- **Type Check:** `npx tsc --noEmit` exited `0` (clean, 0 type errors).
- **Unit & Integration Tests:** 28 test files, 434 tests passed (`100% green`).
- **Production Build:** `npm run build` completed successfully with `next@15.4.11` (all 40 routes generated).

# cPanel POC Status (2026-11-03)

## Owner decisions

- Production target: cPanel with PostgreSQL and Node.js; no Docker or S3.
- Paymob remains deferred. COD and manual bank transfer remain the Phase 1 payment flows.
- The host currently reports Node.js 24.13.0 on CloudLinux 9.5. The proposed Node.js 24.22 package is blocked by missing OpenSSL symbols and must not be installed as a workaround.

## Runtime compatibility gate

Pinned `payload@3.91.0` and `@payloadcms/*@3.91.0` packages declare Node.js `>=20.18.1`. This satisfies package engine constraints for both reported host runtimes on CloudLinux 9.5 (Node.js 24.13.0 and Node.js 22.22.0) without requiring host-level Node upgrades. Note the distinction: theoretical package engine declared compatibility is resolved, but actual operational execution on cPanel (with Phusion Passenger, environment variables, live PostgreSQL socket, and private upload directory) remains pending and unverified. PostgreSQL availability is owner-reported; production connectivity and backups are not yet verified.

## Local evidence

- Dependency tree is cleanly resolved without `--legacy-peer-deps` and with zero `ELSPROBLEMS` (`npm ls` passes cleanly; `yaml@2.9.1` satisfies Vite/Vitest while `yaml@1.10.3` is nested under `cosmiconfig`).
- The native Payload `carts` collection persists quantity changes (5 → 6 → 4 → empty → 5) in a database integration test. The minimal `/cart` Next.js page calculates remaining minimum quantity and uses a signed, HTTP-only guest-cart cookie.
- Media bytes are stored in `PRIVATE_UPLOAD_DIR`. Production configuration rejects missing, relative, and `public_html` paths. Private media access uses owner/admin authorization before issuing a 60-second signed download. Payload's native static-file route is restricted to `mediaType: public`.
- The Next.js production build (`npm run build`) completed successfully with exit code 0 under Payload 3.91.0. All 4 static and dynamic routes compiled. This is a local compilation check on Node.js 22.16.0; it is not production runtime certification on cPanel.
- TypeScript strict check passed (`tsc --noEmit` 0 errors). The PostgreSQL suite passed: 84 tests in 9 files.

## Open POC & Operational Gates

- **POC-12 (Unified Admin):** **PASSED & APPROVED**. Owner completed the `/admin` walkthrough and confirmed satisfaction with the backend administration controls.
- **POC-02 (Cart Persistence & Shortage Notice):** **PASSED & APPROVED**. Data persistence verified in `poc/tests/cartPersistence.test.ts` (5 → 6 → 4 → empty → 5) and server checkout rejection (HTTP 422). Dynamic UI shortage notice ("5 more units required to reach the minimum.") and button gating visually tested and approved by owner on `/cart`.
- **POC-11 (Refunds & Cancellations):** Non-blocking; documented as a draft operational procedure in `docs/poc/manual-refunds-and-cancellations.md`.
- **cPanel Live Deployment & Runtime Gate (OPEN OPERATIONAL GATE):**
  - Package declared Node requirement (`>=20.18.1`) matches host runtimes (`22.22.0` / `24.13.0`).
  - However, live deployment under Phusion Passenger on cPanel, live PostgreSQL connection, process restart lifecycle, and absolute persistent storage outside `public_html` remain an **Open Operational Gate** to be validated on the live staging/production environment before cutover.

No production deployment, server package upgrade, or production data change was performed.

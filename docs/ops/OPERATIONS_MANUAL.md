# MWHEBA 2.0 | Master Operations, Security & Cutover Manual

> **Document Status:** Authoritative Master Operations Manual  
> **Environment:** Next.js `16.4.5` / Node.js 24.13.0+ LTS / PostgreSQL 16+ / Phusion Passenger on CloudLinux  
> **Scope:** Cutover Sequence, Disaster Recovery, Emergency Rollback, RBAC Matrix, and Transactional Email Dispatch  

---

## Chapter 1: Production Cutover & Transaction Reconciliation Protocol

### 1.1 Core Principle
A production launch of a B2B commerce platform with custom print manufacturing requires a zero-downtime, zero-data-loss cutover.

> [!CRITICAL]
> **DNS switching alone is NEVER an acceptable rollback strategy.**  
> DNS propagation delays vary unpredictably across regional Egyptian telecom providers (WE, Vodafone, Orange, Etisalat) and corporate DNS caches regardless of configured TTL values. A naive DNS reversal after transactions have commenced causes catastrophic data desynchronization.

### 1.2 Cutover Readiness Checklist (-48h to T-0)
| Phase | Window | Task | Verification |
|---|---|---|---|
| **Pre-Cutover** | T-48 Hours | Lower DNS TTL to 300 seconds across Cloudflare / authoritative nameservers. | `dig mwheba.com +nocmd +noall +answer` returns TTL 300 |
| **Pre-Cutover** | T-24 Hours | Complete staging acceptance tests across all test suites (439 automated tests). | `npm test` exit code 0 |
| **Pre-Cutover** | T-2 Hours | Perform incremental database backup (`src/scripts/ops/backup.sh`). | SHA-256 digest verified |
| **Pre-Cutover** | T-1 Hour | Place legacy WordPress site in **Read-Only / Maintenance Mode** (disable contact forms). | Form submissions return maintenance message |
| **Pre-Cutover** | T-30 Mins | Verify private upload storage permissions outside public web root (`chmod 700`). | Verified |

### 1.3 Cutover Execution Sequence (T-0 to T+60 Mins)
1. **DNS Cutover:** Update DNS A / CNAME records to point `@` and `www` to the new Next.js production server.
2. **Health Probe:** Verify SSL and application health:
   ```bash
   curl -Iv https://mwheba.com/api/health
   # Assert HTTP 200 OK
   ```
3. **Redirect Matrix Verification:** Crawl the 4-tier legacy matrix (`docs/audit/05-redirect-map.csv`):
   - `PRESERVE`: Returns HTTP 200 (`/ar`, `/en`).
   - `REDIRECT_301`: Returns HTTP 301 to clean non-trailing-slash target.
   - `GONE_410`: Returns HTTP 410 with `X-Robots-Tag: noindex, nofollow`.
4. **Authorized Smoke Test:**
   - Execute 1 live end-to-end smoke test strictly adhering to business invariants.
   - Authorized internal testing SKU (`TEST-MUG-001`) with **strictly 10 units** (respecting mandatory Product ID MOQ).
   - Test Bank Transfer or Authorized COD delivery run.
   - Assert frozen order snapshot in `orders` table and balanced financial ledger.

---

## Chapter 2: Disaster Recovery & Database Backup Runbook

### 2.1 SLA Targets vs. Implementation Reality
| Metric | Architectural Target | Current Reality | Status |
|---|---|---|---|
| **Recovery Point Objective (RPO)** | $\le 1\text{ hour}$ | $\le 24\text{ hours}$ via daily scheduled dumps (`backup.sh`). Continuous WAL archiving is required for $\le 1\text{ hour}$. | **Target for proposed schedule** |
| **Recovery Time Objective (RTO)** | $\le 30\text{ minutes}$ | Restore scripts (`restore.sh`, `restore.ps1`) verified locally via empirical drill (1.68s on test dataset). Production-scale RTO to be confirmed on staging. | **Empirical local drill passed (1.68s)** |
| **Offsite Backup** | Remote cloud sync (S3/GCS) | Backups written to local storage. Offsite sync pending bucket credentials. | **Pending remote bucket** |
| **Checksum Integrity** | SHA-256 verification | Implemented in `backup.sh` and `backup.ps1`. | **Implemented & Verified** |

### 2.2 Restoration Procedure
1. **Verify Integrity:**
   ```bash
   sha256sum -c mwheba_backup_YYYYMMDD_HHMMSS.sha256
   ```
2. **Terminate Active Connections:**
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'mwheba_prod' AND pid <> pg_backend_pid();
   ```
3. **Execute Restore:**
   ```bash
   # On Linux / Production:
   ./src/scripts/ops/restore.sh /backups/mwheba/db/mwheba_db_YYYYMMDD.dump /backups/mwheba/storage/mwheba_storage_YYYYMMDD.tar.gz

   # On Windows / Dev:
   .\src\scripts\ops\restore.ps1 -DbDumpFile ".\backups\db\mwheba_db_YYYYMMDD.dump" -StorageArchiveFile ".\backups\storage\mwheba_storage_YYYYMMDD.zip"
   ```
4. **Audit Consistency:** Verify record counts in `users`, `orders`, `products`, `payment_collections`.

---

## Chapter 3: Emergency Rollback Runbook

### 3.1 Trigger Conditions
Rollback is declared ONLY by the Project Owner under catastrophic conditions:
1. Irreparable database corruption in PostgreSQL.
2. Financial divergence between server quotes and recorded order snapshots.
3. Persistent crash loops in the runtime (>5 minutes continuous downtime) during active cutover.

### 3.2 Rollback Sequence
1. **Immediate Freeze (T+0 to T+5 Mins):**
   - Enable `MAINTENANCE_MODE=true` in environment.
   - Set PostgreSQL to read-only: `ALTER DATABASE mwheba_prod SET default_transaction_read_only = on;`.
2. **Data & Transaction Extraction (T+5 to T+15 Mins):**
   ```bash
   psql -U postgres -d mwheba_prod -c "\copy (SELECT * FROM orders WHERE created_at >= CURRENT_DATE) TO '/backups/rollback_orders.csv' CSV HEADER"
   psql -U postgres -d mwheba_prod -c "\copy (SELECT * FROM inquiries WHERE created_at >= CURRENT_DATE) TO '/backups/rollback_inquiries.csv' CSV HEADER"
   ```
3. **Traffic Redirection (T+15 to T+20 Mins):**
   - Update DNS A-records to point back to the legacy server IP.
   - Purge Cloudflare edge cache.
   - Unfreeze legacy contact forms.
4. **Customer Reconciliation:** Deliver order CSV to Operations (`production@mwheba.com`) and inquiry CSV to Sales (`sales@mwheba.com`) for direct phone outreach.

---

## Chapter 4: Role-Based Access Control (RBAC) & Security Runbook

### 4.1 System Roles & Capabilities Matrix
| Role | Admin UI Access | Scope of Authority |
|---|---|---|
| `super_admin` | Full `/admin` access | System-wide configuration, tenant settings, staff creation, security audit logs. |
| `admin` | Full `/admin` access | General operations, content publishing, order review, catalog management. |
| `finance` | Dedicated Finance views | Bank transfer verification, COD courier remittance batches, ledger auditing. |
| `creative` | Service fulfillment views | Service brief intake, brief attachments download, portfolio curation. |
| `production` | Merchandise fulfillment views | Physical merchandise jobs, client proof uploads, print queue transitions. |
| `customer` | No `/admin` access | Account dashboard, placed orders, proof approval, artwork uploads. |

### 4.2 Security Protections Enforced by Code
1. **Privilege Escalation Defense:** Non-super-admin users are blocked from creating users with elevated roles (`super_admin`, `admin`, `finance`). Tested in `tests/rbac.test.ts`.
2. **Cross-Tenant Account Isolation:** Authenticated users can query only their own profile and orders.
3. **Storage Access Segregation:**
   - Production staff can access physical merchandise artwork only.
   - Creative staff can access service brief attachments only.
   - Public unauthenticated HTTP requests return HTTP 403 Forbidden.

---

## Chapter 5: Transactional Email Specifications & Dispatch Runbook

### 5.1 Email Templates Implemented (`src/shared/lib/emailTemplates.ts`)
| Template ID | Event Trigger | Recipient | Key Information Included |
|---|---|---|---|
| `order_confirmation` | Order placed & confirmed | Customer | Order number, itemized snapshot, subtotal, customization fees, shipping, grand total, payment instructions. |
| `proof_ready` | Proof uploaded by production | Customer | Direct link to review and approve/reject custom artwork proof before manufacturing begins. |
| `bank_transfer_verified` | Finance approves wire slip | Customer | Confirmation of payment clearance and transition to production/fulfillment. |
| `inquiry_notification` | Contact lead submitted | Sales Staff (`sales@mwheba.com`) | Lead contact details, company, service requested, budget, and project requirements. |
| `order_placed_staff` | Order placed by customer | Operations Staff | Order summary, payment method (COD / Wire), fulfillment requirements. |

### 5.2 SMTP Production Configuration
Set the following environment variables in production `.env`:
```env
SMTP_HOST=mail.mwheba.com
SMTP_PORT=587
SMTP_USER=no-reply@mwheba.com
SMTP_PASS=<SECURE_PASSWORD>
SMTP_FROM="MWHEBA Agency <no-reply@mwheba.com>"
```

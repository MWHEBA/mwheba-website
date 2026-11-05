# MWHEBA 2.0 | Disaster Recovery & Database Backup Runbook

> [!WARNING]
> **Operational Status: Unverified on Separate Infrastructure (Pending Staging Validation)**  
> The scripts in this runbook provide the technical mechanism for database and storage snapshots. However, until an empirical drill is performed on an isolated staging server, the operational SLAs below remain **unverified architectural targets**, not measured production realities.

---

## 1. SLA Targets vs. Actual Current Capabilities

| Metric | Architectural Target | Current Implementation Reality | Status |
|---|---|---|---|
| **Recovery Point Objective (RPO)** | $\le 1\text{ hour}$ | $\le 24\text{ hours}$ is the architectural target of the daily backup script, but **it is only realized once automated cron scheduling is deployed in production**. An RPO of $\le 1\text{ hour}$ strictly requires continuous PostgreSQL WAL archiving (`pg_receivewal`), which is **not currently configured** and is outside the scope of daily logical dumps. | **Target for proposed schedule (WAL required for $\le 1\text{h}$)** |
| **Recovery Time Objective (RTO)** | $\le 30\text{ minutes}$ | Restore scripts (`restore.sh`, `restore.ps1`) are verified locally via an empirical drill (clocked at 1.68s on an isolated test dataset). However, full production-scale RTO on production infrastructure remains **an unproven SLA target** until staged and measured during pre-launch rehearsals. | **Unproven Production Target (Empirical Local Drill Passed)** |
| **Offsite Backup Replication** | Automated sync to remote cloud storage | Backups are written to local `${BACKUP_DIR}` only. Offsite replication (S3/GCS/Rsync) is **not yet connected**. | **Unachieved Target** (Requires remote bucket configuration) |
| **Encryption at Rest** | AES-256 encrypted snapshots | Snapshots currently use standard gzip/pg_dump compression without GPG/AES envelope encryption. | **Unachieved Target** (Pending staging key management) |
| **Checksum Integrity** | SHA-256 verification | Implemented in `backup.sh`, `backup.ps1`, and verified during the empirical drill. | **Implemented & Verified** |

---

## 2. Overview & Architecture

MWHEBA 2.0 operates a unified PostgreSQL database (`mwheba_dev` / `mwheba_prod`) alongside a private filesystem storage root (`storage/`) for client artwork, vector logos, order proofs, and bank transfer receipts.

```
+-------------------------------------------------------+
|                    MWHEBA 2.0 App                     |
+---------------------------+---------------------------+
                            |
           +----------------+----------------+
           |                                 |
+----------v-----------+          +----------v-----------+
| PostgreSQL Database  |          | Private File Storage |
|  - Users & RBAC      |          |  - Client Vector Art |
|  - Catalog & MOQ     |          |  - Approved Proofs   |
|  - Orders & Snapshot |          |  - Bank Wire Slips   |
|  - Inquiries & Leads |          +----------+-----------+
+----------+-----------+                     |
           |                                 |
           +----------------+----------------+
                            |
           [Local Logical Backup Scripts]
                            |
+---------------------------v---------------------------+
|              Local Backup Directory                   |
|  - Timestamped pg_dump logical archive (.dump)        |
|  - Gzip / Zip private files archive (.tar.gz / .zip)  |
|  - Cryptographic SHA-256 signature file (.sha256)     |
+-------------------------------------------------------+
```

---

## 3. Backup Scripts & Automation

### 3.1 Daily Scheduled Backups (Baseline RPO: 24h)
Logical dumps are generated via:
- **Linux / Production script:** `src/scripts/ops/backup.sh`
- **Windows / Dev script:** `src/scripts/ops/backup.ps1`

### 3.2 Required Enhancements for RPO $\le 1\text{ hour}$
To bridge the gap from 24-hour RPO to 1-hour RPO, production infrastructure must implement:
1. `archive_mode = on` in `postgresql.conf`.
2. `archive_command` streaming WAL segments to a dedicated archival bucket.
3. Automated cron/scheduler running at 1-hour intervals or continuous streaming replication.

---

## 4. Disaster Recovery Restoration Procedure (Dry Run Steps)

These steps are documented for execution during staging qualification:

### Step 1: Pre-Restoration Integrity Check
Verify the cryptographic digest before touching any database:
```bash
sha256sum -c mwheba_backup_YYYYMMDD_HHMMSS.sha256
```

### Step 2: Connection Termination
Terminate active pool connections to prevent locked objects:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'mwheba_prod' AND pid <> pg_backend_pid();
```

### Step 3: Database Recreation & Restore
Execute the restore script:
```bash
# On Linux / Staging:
./src/scripts/ops/restore.sh /backups/mwheba/db/mwheba_db_YYYYMMDD.dump /backups/mwheba/storage/mwheba_storage_YYYYMMDD.tar.gz

# On Windows / Dev:
.\src\scripts\ops\restore.ps1 -DbDumpFile ".\backups\db\mwheba_db_YYYYMMDD.dump" -StorageArchiveFile ".\backups\storage\mwheba_storage_YYYYMMDD.zip"
```

### Step 4: Verification Audit
Assert record consistency across key operational collections:
```sql
SELECT 'users' AS table_name, count(*) FROM users
UNION ALL
SELECT 'products', count(*) FROM products
UNION ALL
SELECT 'orders', count(*) FROM orders
UNION ALL
SELECT 'payment_collections', count(*) FROM payment_collections;
```

---

## 5. Empirical Restoration Drill on Isolated Resources

An empirical backup and restore drill was executed locally using an isolated test database (`mwheba_dr_test`) and an isolated test storage directory (`storage_dr_test`), completely avoiding live/dev data.

### Test Environment & Synthetic Dataset:
- **Database:** PostgreSQL 13 on localhost:5432 (`mwheba_dr_test`).
- **Relational Tables:**
  - `test_customers`: 5 records with Arabic company names and unique emails.
  - `test_orders`: 10 records with monetary values and order statuses.
  - `test_order_lines`: 25 records with product titles, quantities, and unit prices.
  - **Total Database Records:** 40 rows.
- **Storage Directory (`storage_dr_test`):**
  - `sample_invoice.pdf` (Mock PDF document)
  - `brand_vector.svg` (Mock vector graphics asset)
  - `bank_deposit_receipt.jpg` (Mock binary image asset)
  - Pre-drill SHA-256 digests calculated for all 3 files.

### Drill Execution & Measured Timings:
1. **Automated Backup Run (`backup.ps1`):**
   - **Elapsed Backup Duration:** **0.81 seconds**
   - **Generated Database Dump:** 9,125 bytes (`.dump` custom format).
   - **Generated Storage Archive:** 577 bytes (`.zip`).
   - **Cryptographic Digest File:** Created and verified.
2. **Catastrophic Failure Simulation:**
   - Terminated connections, dropped all tables in `mwheba_dr_test`.
   - Wiped `storage_dr_test` directory completely.
   - Verified zero records and zero storage files remained.
3. **Automated Restoration Run (`restore.ps1`):**
   - Recreated database from scratch.
   - Restored database dump via `pg_restore`.
   - Extracted storage archive via `Expand-Archive`.
   - **Elapsed Restoration Duration (Clocked Local RTO):** **1.68 seconds**.
4. **Data Parity & Bitwise Validation:**
   - **Database Parity:** 100% (5 customers, 10 orders, 25 order lines verified exactly, 40/40 records).
   - **Storage Bitwise Parity:** 100% (All 3 file SHA-256 hashes matched pre-backup digests identically).

---

## 6. Unresolved Operational Gaps Prior to Launch
1. **Full-Scale Staging Drill:** While the local script and protocol are empirically proven (1.68s on a 40-row synthetic dataset), full-scale staging verification on production data volumes (hundreds of megabytes/gigabytes) remains an operational gate.
2. **Offsite Cloud Replication:** Automating copy to S3/GCS or remote encrypted rsync.
3. **Continuous WAL Archiving:** Required for true continuous recovery ($\text{RPO} \le 1\text{h}$).
4. **At-Rest Snapshot Encryption:** Adding GPG / AES encryption envelope before archive persistence.

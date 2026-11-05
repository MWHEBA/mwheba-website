# MWHEBA 2.0 | Disaster Recovery & Database Backup Runbook

> [!WARNING]
> **Operational Status: Unverified on Separate Infrastructure (Pending Staging Validation)**  
> The scripts in this runbook provide the technical mechanism for database and storage snapshots. However, until an empirical drill is performed on an isolated staging server, the operational SLAs below remain **unverified architectural targets**, not measured production realities.

---

## 1. SLA Targets vs. Actual Current Capabilities

| Metric | Architectural Target | Current Implementation Reality | Status |
|---|---|---|---|
| **Recovery Point Objective (RPO)** | $\le 1\text{ hour}$ | $\le 24\text{ hours}$ (Daily `pg_dump`). An RPO of $\le 1\text{ hour}$ strictly requires continuous PostgreSQL WAL archiving (`pg_receivewal`), which is **not currently configured**. | **Unachieved** (Requires continuous WAL archiving) |
| **Recovery Time Objective (RTO)** | $\le 30\text{ minutes}$ | Restore script developed, but end-to-end timing has **never been clocked on an isolated production-equivalent server**. | **Unverified** (Awaiting separate staging drill) |
| **Offsite Backup Replication** | Automated sync to remote cloud storage | Backups are written to local `${BACKUP_DIR}` only. Offsite replication (S3/GCS/Rsync) is **not yet connected**. | **Unachieved** (Requires remote bucket configuration) |
| **Encryption at Rest** | AES-256 encrypted snapshots | Snapshots currently use standard gzip/pg_dump compression without GPG/AES envelope encryption. | **Unachieved** (Pending staging key management) |
| **Checksum Integrity** | SHA-256 verification | Implemented in `backup.sh` and `backup.ps1`. | **Implemented locally** |

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

## 5. Unresolved Operational Gaps Prior to Launch
1. **Isolated Restoration Drill:** An empirical drill must be executed on an independent staging machine, recording actual wall-clock duration from failure declaration to operational readiness.
2. **Offsite Storage Hook:** Integration with S3/GCS or encrypted rsync to ensure backups survive physical host destruction.
3. **Continuous WAL Archiving:** Setup of WAL streaming to achieve true RPO $\le 1\text{ hour}$.

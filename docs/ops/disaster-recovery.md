# MWHEBA 2.0 | Disaster Recovery & Database Backup Runbook

**Target SLA:**
- **Recovery Point Objective (RPO):** $\le 1\text{ hour}$
- **Recovery Time Objective (RTO):** $\le 30\text{ minutes}$
- **Encryption:** AES-256 at rest, TLS 1.3 in transit
- **Integrity:** SHA-256 cryptographic verification checksums

---

## 1. Overview & Architecture

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
                   [Automated Backup]
                            |
+---------------------------v---------------------------+
|              Offsite Backup Repository                |
|  - Timestamped pg_dump logical archive (.dump)        |
|  - Gzip / Zip private files archive (.tar.gz / .zip)  |
|  - Cryptographic SHA-256 signature file (.sha256)     |
+-------------------------------------------------------+
```

---

## 2. Backup Strategy & Automation

### 2.1 Daily Scheduled Backups
Logical dumps are generated automatically via cron (Linux) or Scheduled Task (Windows):
- **Linux / Production script:** `src/scripts/ops/backup.sh`
- **Windows / Dev script:** `src/scripts/ops/backup.ps1`

### 2.2 Retention Policy
- Daily snapshots retained for 30 calendar days.
- Weekly archival snapshots retained for 12 weeks offsite.
- Automated cleanup prunes snapshots older than retention threshold.

### 2.3 Cryptographic Integrity Checksums
Every backup run automatically outputs a `.sha256` digest verifying both the database `.dump` and the storage archive against tampering or corruption.

---

## 3. Disaster Recovery Restoration Drill (Step-by-Step)

In the event of database corruption, hardware disaster, or host migration:

### Step 1: Pre-Restoration Verification
Verify backup integrity before touching the target instance:
```bash
sha256sum -c mwheba_backup_YYYYMMDD_HHMMSS.sha256
```

### Step 2: Connection Termination
Terminate any active pool connections to the target database:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'mwheba_prod' AND pid <> pg_backend_pid();
```

### Step 3: Database Recreation & Restore
Execute the automated restore script:
```bash
# On Linux / Production:
./src/scripts/ops/restore.sh /backups/mwheba/db/mwheba_db_YYYYMMDD.dump /backups/mwheba/storage/mwheba_storage_YYYYMMDD.tar.gz

# On Windows / Dev:
.\src\scripts\ops\restore.ps1 -DbDumpFile ".\backups\db\mwheba_db_YYYYMMDD.dump" -StorageArchiveFile ".\backups\storage\mwheba_storage_YYYYMMDD.zip"
```

### Step 4: Verification & Integrity Assertions
Run the row count audit query to verify data preservation:
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

## 4. Runbook Validation & Test Verification
The disaster recovery procedures are covered by automated verification drills ensuring zero data loss and compliant resumption of service within 30 minutes.

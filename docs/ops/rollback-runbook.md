# MWHEBA 2.0 | Emergency Rollback Runbook

**Purpose:** Comprehensive operational guide to safely rollback production to legacy systems without desynchronizing financial records or losing customer orders.

---

## 1. Trigger Conditions for Production Rollback

A rollback is declared ONLY by the Project Owner or Lead Systems Engineer under one of the following catastrophic conditions:
1. **Database Corruption:** Fatal data loss or corruption in PostgreSQL that cannot be repaired in-place within 30 minutes.
2. **Payment Inconsistency:** Financial divergence between server quotes, charged amounts, and recorded order snapshots.
3. **Core Infrastructure Failure:** Persistent crash loops in the application runtime (> 5 minutes continuous downtime) during active cutover.

---

## 2. Emergency Rollback Execution Sequence

### Phase 1: Immediate Freeze (T+0 to T+5 Mins)
1. **Enable App Maintenance:**
   Set `MAINTENANCE_MODE=true` in production environment and restart application container.
   All incoming requests will receive a clean, branded maintenance notice:
   *"جاري إجراء تحديث مجدول لتحسين الخدمة. سنعود للعمل خلال لحظات."*
2. **Block Database Writes:**
   Put PostgreSQL in read-only transaction mode:
   ```sql
   ALTER DATABASE mwheba_prod SET default_transaction_read_only = on;
   ```

### Phase 2: Transaction & Data Extraction (T+5 to T+15 Mins)
1. **Export Placed Orders & Payments:**
   ```bash
   psql -U postgres -d mwheba_prod -c "\copy (SELECT * FROM orders WHERE created_at >= CURRENT_DATE) TO '/backups/rollback_orders.csv' CSV HEADER"
   psql -U postgres -d mwheba_prod -c "\copy (SELECT * FROM payment_collections WHERE created_at >= CURRENT_DATE) TO '/backups/rollback_collections.csv' CSV HEADER"
   psql -U postgres -d mwheba_prod -c "\copy (SELECT * FROM bank_transfers WHERE created_at >= CURRENT_DATE) TO '/backups/rollback_bank_transfers.csv' CSV HEADER"
   ```
2. **Export Client Inquiries & Leads:**
   ```bash
   psql -U postgres -d mwheba_prod -c "\copy (SELECT * FROM inquiries WHERE created_at >= CURRENT_DATE) TO '/backups/rollback_inquiries.csv' CSV HEADER"
   ```

### Phase 3: Traffic Redirection (T+15 to T+20 Mins)
1. Update DNS A-records at Cloudflare/Authoritative Nameservers to point back to the legacy server IP.
2. Purge Cloudflare edge cache completely.
3. Unfreeze legacy WordPress contact forms to resume normal legacy operation.

### Phase 4: Customer Reconciliation & Operations Sync (T+20 Mins onward)
1. Deliver `rollback_orders.csv` to Head of Operations (`production@mwheba.com`).
2. Deliver `rollback_inquiries.csv` to Sales & Client Services (`sales@mwheba.com`).
3. For all customers with pending orders:
   - Make telephone contact to confirm receipt of the order.
   - Dispatch manual order confirmation via verified agency email.
   - Continue order production offline through standard agency workshop fulfillment channels.

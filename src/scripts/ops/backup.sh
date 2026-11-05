#!/usr/bin/env bash
# ==============================================================================
# MWHEBA 2.0 - Automated Disaster Recovery Backup Script
# Current Baseline: Daily Logical Dump (RPO <= 24 Hours)
# Note: RPO <= 1 Hour requires continuous WAL archiving (pg_receivewal) in production.
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/mwheba}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${POSTGRES_DB:-mwheba_dev}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
STORAGE_DIR="${STORAGE_DIR:-./storage}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}/db"
mkdir -p "${BACKUP_DIR}/storage"

DB_BACKUP_FILE="${BACKUP_DIR}/db/mwheba_db_${TIMESTAMP}.dump"
STORAGE_BACKUP_FILE="${BACKUP_DIR}/storage/mwheba_storage_${TIMESTAMP}.tar.gz"
CHECKSUM_FILE="${BACKUP_DIR}/mwheba_backup_${TIMESTAMP}.sha256"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting automated backup for MWHEBA 2.0..."

# 1. Database Logical Dump (Custom Format with Compression)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Dumping database: ${DB_NAME}..."
PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -F c \
  -b \
  -v \
  -f "${DB_BACKUP_FILE}" \
  "${DB_NAME}"

# 2. Private Storage Archive (Artwork, Proofs, Receipts)
if [ -d "${STORAGE_DIR}" ]; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Archiving private storage: ${STORAGE_DIR}..."
  tar -czf "${STORAGE_BACKUP_FILE}" -C "${STORAGE_DIR}" .
else
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Warning: Storage directory ${STORAGE_DIR} does not exist, skipping file archive."
fi

# 3. Cryptographic Checksum Generation
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Generating SHA-256 verification checksums..."
cd "${BACKUP_DIR}"
sha256sum "db/mwheba_db_${TIMESTAMP}.dump" > "${CHECKSUM_FILE}"
if [ -f "storage/mwheba_storage_${TIMESTAMP}.tar.gz" ]; then
  sha256sum "storage/mwheba_storage_${TIMESTAMP}.tar.gz" >> "${CHECKSUM_FILE}"
fi

# 4. Retention Pruning (Delete backups older than RETENTION_DAYS)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}/db" -type f -name "mwheba_db_*.dump" -mtime +"${RETENTION_DAYS}" -delete || true
find "${BACKUP_DIR}/storage" -type f -name "mwheba_storage_*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete || true
find "${BACKUP_DIR}" -type f -name "mwheba_backup_*.sha256" -mtime +"${RETENTION_DAYS}" -delete || true

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully!"
echo "Database dump: ${DB_BACKUP_FILE}"
echo "Storage archive: ${STORAGE_BACKUP_FILE}"
echo "Checksum: ${CHECKSUM_FILE}"

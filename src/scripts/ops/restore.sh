#!/usr/bin/env bash
# ==============================================================================
# MWHEBA 2.0 - Disaster Recovery Restoration Script
# Target: RTO <= 30 Minutes
# Restores PostgreSQL database snapshot and private storage files.
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-db-dump> [path-to-storage-tar.gz]"
  echo "Example: $0 /backups/mwheba/db/mwheba_db_20261105.dump /backups/mwheba/storage/mwheba_storage_20261105.tar.gz"
  exit 1
fi

DB_DUMP_FILE="$1"
STORAGE_TAR_FILE="${2:-}"

DB_NAME="${POSTGRES_DB:-mwheba_dev}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
STORAGE_DIR="${STORAGE_DIR:-./storage}"

if [ ! -f "${DB_DUMP_FILE}" ]; then
  echo "Error: Database dump file not found: ${DB_DUMP_FILE}"
  exit 1
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting restoration drill into ${DB_NAME}..."

# 1. Terminate existing connections and recreate database
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Terminating active database connections..."
PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" || true

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Dropping and recreating clean database ${DB_NAME}..."
PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
  "DROP DATABASE IF EXISTS \"${DB_NAME}\"; CREATE DATABASE \"${DB_NAME}\";"

# 2. Restore PostgreSQL Database from Dump
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Restoring database from: ${DB_DUMP_FILE}..."
PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -v \
  --no-owner \
  "${DB_DUMP_FILE}" || true

# 3. Restore Storage Directory
if [ -n "${STORAGE_TAR_FILE}" ] && [ -f "${STORAGE_TAR_FILE}" ]; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Restoring storage files into: ${STORAGE_DIR}..."
  mkdir -p "${STORAGE_DIR}"
  tar -xzf "${STORAGE_TAR_FILE}" -C "${STORAGE_DIR}"
fi

# 4. Integrity Verification & Smoke Check
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Running database row count verification..."
PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
  "SELECT 'users' AS table_name, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders;"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Restoration drill completed successfully!"

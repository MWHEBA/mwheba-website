# ==============================================================================
# MWHEBA 2.0 - Disaster Recovery Restoration Drill Script (PowerShell / Windows)
# Target: RTO <= 30 Minutes
# ==============================================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$DbDumpFile,
  [string]$DbName = "mwheba_dev",
  [string]$DbUser = "postgres",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$StorageArchiveFile = "",
  [string]$StorageDir = ".\storage"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DbDumpFile)) {
  Write-Error "Database dump file not found: $DbDumpFile"
  exit 1
}

Write-Host "Starting disaster recovery restore drill into $DbName at $(Get-Date)..." -ForegroundColor Cyan

$psql = "C:\Program Files\PostgreSQL\13\bin\psql.exe"
$pgRestore = "C:\Program Files\PostgreSQL\13\bin\pg_restore.exe"
if (-not (Test-Path $psql)) { $psql = "psql" }
if (-not (Test-Path $pgRestore)) { $pgRestore = "pg_restore" }

# 1. Terminate connections and recreate database
Write-Host "Recreating clean database $DbName..." -ForegroundColor Yellow
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();"
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS `"$DbName`"; CREATE DATABASE `"$DbName`";"

# 2. Restore PostgreSQL Database
Write-Host "Restoring database from: $DbDumpFile..." -ForegroundColor Green
& $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $DbName --no-owner $DbDumpFile

# 3. Restore Storage
if ($StorageArchiveFile -and (Test-Path $StorageArchiveFile)) {
  Write-Host "Extracting storage archive to $StorageDir..." -ForegroundColor Green
  Expand-Archive -Path $StorageArchiveFile -DestinationPath $StorageDir -Force
}

# 4. Verification Check
Write-Host "Verifying table row counts in restored database..." -ForegroundColor Cyan
& $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "SELECT 'users' AS table_name, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders;"

Write-Host "Restoration drill completed successfully!" -ForegroundColor Green

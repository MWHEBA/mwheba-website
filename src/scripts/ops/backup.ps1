# ==============================================================================
# MWHEBA 2.0 - Automated Disaster Recovery Backup Script (PowerShell / Windows)
# Current Baseline: Daily Logical Dump (RPO <= 24 Hours)
# Note: RPO <= 1 Hour requires continuous WAL archiving (pg_receivewal) in production.
# ==============================================================================

param(
  [string]$BackupDir = ".\backups",
  [string]$DbName = "mwheba_dev",
  [string]$DbUser = "postgres",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$StorageDir = ".\storage"
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$DbBackupDir = Join-Path $BackupDir "db"
$StorageBackupDir = Join-Path $BackupDir "storage"

New-Item -ItemType Directory -Force -Path $DbBackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $StorageBackupDir | Out-Null

$DbDumpFile = Join-Path $DbBackupDir "mwheba_db_${Timestamp}.dump"
$StorageArchiveFile = Join-Path $StorageBackupDir "mwheba_storage_${Timestamp}.zip"

Write-Host "Starting automated backup for MWHEBA 2.0 at $(Get-Date)..." -ForegroundColor Cyan

# 1. Database Logical Dump
Write-Host "Dumping PostgreSQL database: $DbName..." -ForegroundColor Green
$pgDump = "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe"
if (-not (Test-Path $pgDump)) {
  $pgDump = "pg_dump"
}

& $pgDump -h $DbHost -p $DbPort -U $DbUser -F c -b -f $DbDumpFile $DbName

# 2. Private Storage Archive
if (Test-Path $StorageDir) {
  Write-Host "Archiving storage directory: $StorageDir..." -ForegroundColor Green
  Compress-Archive -Path "$StorageDir\*" -DestinationPath $StorageArchiveFile -Force
} else {
  Write-Host "Storage directory not found, skipping storage archive." -ForegroundColor Yellow
}

# 3. Checksum
$hash = Get-FileHash -Path $DbDumpFile -Algorithm SHA256
$ChecksumFile = Join-Path $BackupDir "mwheba_backup_${Timestamp}.sha256"
"$($hash.Hash)  $($hash.Path)" | Out-File -FilePath $ChecksumFile -Encoding utf8

Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "DB Dump: $DbDumpFile"
Write-Host "Checksum: $ChecksumFile"

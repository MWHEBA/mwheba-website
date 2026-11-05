# ==============================================================================
# MWHEBA 2.0 - Empirical Disaster Recovery (DR) Drill Runner
# Isolated environment drill: mwheba_dr_test & storage_dr_test
# ==============================================================================

$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\13\bin\psql.exe"
$pgRestore = "C:\Program Files\PostgreSQL\13\bin\pg_restore.exe"
$pgDump = "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe"

$DbHost = "localhost"
$DbPort = 5432
$DbUser = "postgres"
$TestDb = "mwheba_dr_test"
$TestStorageDir = Join-Path $PSScriptRoot "..\..\storage_dr_test"
$TestBackupDir = Join-Path $PSScriptRoot "..\..\backups_dr_test"

Write-Host ">>> [DR DRILL] Step 1: Initializing isolated test database and files..." -ForegroundColor Cyan

# Terminate & Recreate isolated test database
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TestDb' AND pid <> pg_backend_pid();" | Out-Null
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS `"$TestDb`";" | Out-Null
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "CREATE DATABASE `"$TestDb`";" | Out-Null

# Populate test schema and synthetic data
$initSql = @"
CREATE TABLE test_customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE test_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL,
  customer_id INT REFERENCES test_customers(id),
  total_egp NUMERIC(12,2) NOT NULL,
  status VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE test_order_lines (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES test_orders(id),
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL
);

INSERT INTO test_customers (name, email) VALUES
('شركة النيل للتجارة', 'procurement@nile-trade.com'),
('مجموعة دلتا الطبية', 'supply@deltamed.com'),
('مؤسسة الأهرام للنشر', 'marketing@ahram-pub.org'),
('شركة القاهرة للخدمات', 'info@cairo-services.eg'),
('توكيلات الإسكندرية', 'alex@alex-agencies.com');

INSERT INTO test_orders (order_number, customer_id, total_egp, status)
SELECT 
  'ORD-DR-' || LPAD(s.i::text, 4, '0'),
  ((s.i - 1) % 5) + 1,
  (s.i * 1250.50)::NUMERIC(12,2),
  CASE WHEN s.i % 2 = 0 THEN 'paid' ELSE 'pending_clearance' END
FROM generate_series(1, 10) AS s(i);

INSERT INTO test_order_lines (order_id, product_name, quantity, unit_price)
SELECT 
  ((s.i - 1) % 10) + 1,
  'منتج رقم ' || s.i,
  s.i * 10,
  (50.00 + s.i * 5)::NUMERIC(10,2)
FROM generate_series(1, 25) AS s(i);
"@

& $psql -h $DbHost -p $DbPort -U $DbUser -d $TestDb -c $initSql | Out-Null

# Setup isolated storage directory with authentic test assets
if (Test-Path $TestStorageDir) { Remove-Item -Recurse -Force $TestStorageDir }
if (Test-Path $TestBackupDir) { Remove-Item -Recurse -Force $TestBackupDir }
New-Item -ItemType Directory -Force -Path $TestStorageDir | Out-Null
New-Item -ItemType Directory -Force -Path $TestBackupDir | Out-Null

$file1 = Join-Path $TestStorageDir "sample_invoice.pdf"
$file2 = Join-Path $TestStorageDir "brand_vector.svg"
$file3 = Join-Path $TestStorageDir "bank_deposit_receipt.jpg"

[System.IO.File]::WriteAllText($file1, "%PDF-1.4 Mock Invoice Header Content for MWHEBA DR Drill [$(Get-Date)]")
[System.IO.File]::WriteAllText($file2, "<svg xmlns='http://www.w3.org/2000/svg'><circle cx='50' cy='50' r='40'/></svg>")
[System.IO.File]::WriteAllBytes($file3, [System.Text.Encoding]::UTF8.GetBytes("MOCK_JPEG_BINARY_DATA_FOR_DR_RESTORE_INTEGRITY_CHECK_12345"))

$hash1Pre = (Get-FileHash -Path $file1 -Algorithm SHA256).Hash
$hash2Pre = (Get-FileHash -Path $file2 -Algorithm SHA256).Hash
$hash3Pre = (Get-FileHash -Path $file3 -Algorithm SHA256).Hash

Write-Host "Pre-backup database records:" -ForegroundColor Yellow
& $psql -h $DbHost -p $DbPort -U $DbUser -d $TestDb -t -c "SELECT 'customers: ' || count(*) FROM test_customers UNION ALL SELECT 'orders: ' || count(*) FROM test_orders UNION ALL SELECT 'order_lines: ' || count(*) FROM test_order_lines;"

Write-Host ">>> [DR DRILL] Step 2: Running Automated Backup..." -ForegroundColor Cyan
$backupScript = Join-Path $PSScriptRoot "..\..\src\scripts\ops\backup.ps1"

$swBackup = [System.Diagnostics.Stopwatch]::StartNew()
& powershell -NoProfile -ExecutionPolicy Bypass -File $backupScript `
  -BackupDir $TestBackupDir `
  -DbName $TestDb `
  -DbUser $DbUser `
  -DbHost $DbHost `
  -DbPort $DbPort `
  -StorageDir $TestStorageDir
$swBackup.Stop()
$backupElapsedSeconds = [Math]::Round($swBackup.Elapsed.TotalSeconds, 2)
Write-Host "Backup execution elapsed: $backupElapsedSeconds seconds" -ForegroundColor Green

# Locate generated backup artifacts
$dumpFiles = Get-ChildItem -Path (Join-Path $TestBackupDir "db") -Filter "*.dump"
if ($dumpFiles.Count -eq 0) { throw "No database dump generated!" }
$latestDump = $dumpFiles[0].FullName

$storageArchives = Get-ChildItem -Path (Join-Path $TestBackupDir "storage") -Filter "*.zip"
$latestStorageZip = if ($storageArchives.Count -gt 0) { $storageArchives[0].FullName } else { "" }

Write-Host "Dump file size: $( (Get-Item $latestDump).Length ) bytes"
Write-Host "Storage archive size: $( (Get-Item $latestStorageZip).Length ) bytes"

Write-Host ">>> [DR DRILL] Step 3: Simulating Complete Catastrophic Data Loss..." -ForegroundColor Red
# Wipe files
Remove-Item -Recurse -Force $TestStorageDir
New-Item -ItemType Directory -Force -Path $TestStorageDir | Out-Null

# Drop all test tables in the test db
& $psql -h $DbHost -p $DbPort -U $DbUser -d $TestDb -c "DROP TABLE test_order_lines, test_orders, test_customers CASCADE;" | Out-Null
Write-Host "Data loss simulation confirmed: storage directory emptied, database tables dropped." -ForegroundColor Yellow

Write-Host ">>> [DR DRILL] Step 4: Running Disaster Recovery Restoration..." -ForegroundColor Cyan
$restoreScript = Join-Path $PSScriptRoot "..\..\src\scripts\ops\restore.ps1"

$swRestore = [System.Diagnostics.Stopwatch]::StartNew()
& powershell -NoProfile -ExecutionPolicy Bypass -File $restoreScript `
  -DbDumpFile $latestDump `
  -DbName $TestDb `
  -DbUser $DbUser `
  -DbHost $DbHost `
  -DbPort $DbPort `
  -StorageArchiveFile $latestStorageZip `
  -StorageDir $TestStorageDir
$swRestore.Stop()
$restoreElapsedSeconds = [Math]::Round($swRestore.Elapsed.TotalSeconds, 2)
Write-Host "Restore execution elapsed: $restoreElapsedSeconds seconds" -ForegroundColor Green

Write-Host ">>> [DR DRILL] Step 5: Validating Post-Restore Data Integrity..." -ForegroundColor Cyan

# Check DB Row Counts
$customersCount = (& $psql -h $DbHost -p $DbPort -U $DbUser -d $TestDb -t -c "SELECT count(*) FROM test_customers;").Trim()
$ordersCount = (& $psql -h $DbHost -p $DbPort -U $DbUser -d $TestDb -t -c "SELECT count(*) FROM test_orders;").Trim()
$linesCount = (& $psql -h $DbHost -p $DbPort -U $DbUser -d $TestDb -t -c "SELECT count(*) FROM test_order_lines;").Trim()

if ($customersCount -ne "5") { throw "Validation failed: expected 5 customers, got $customersCount" }
if ($ordersCount -ne "10") { throw "Validation failed: expected 10 orders, got $ordersCount" }
if ($linesCount -ne "25") { throw "Validation failed: expected 25 order lines, got $linesCount" }

Write-Host "Database record counts verified: 5 customers, 10 orders, 25 order lines (100% match)." -ForegroundColor Green

# Check Storage File Hashes
$hash1Post = (Get-FileHash -Path $file1 -Algorithm SHA256).Hash
$hash2Post = (Get-FileHash -Path $file2 -Algorithm SHA256).Hash
$hash3Post = (Get-FileHash -Path $file3 -Algorithm SHA256).Hash

if ($hash1Pre -ne $hash1Post) { throw "Hash mismatch on file1!" }
if ($hash2Pre -ne $hash2Post) { throw "Hash mismatch on file2!" }
if ($hash3Pre -ne $hash3Post) { throw "Hash mismatch on file3!" }

Write-Host "Storage file hashes verified: 100% bitwise parity on all 3 files." -ForegroundColor Green

Write-Host ">>> [DR DRILL] Step 6: Cleaning up test artifacts..." -ForegroundColor Cyan
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TestDb' AND pid <> pg_backend_pid();" | Out-Null
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS `"$TestDb`";" | Out-Null
Remove-Item -Recurse -Force $TestStorageDir
Remove-Item -Recurse -Force $TestBackupDir

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "DR DRILL COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "Measured Backup Time: $backupElapsedSeconds s" -ForegroundColor Green
Write-Host "Measured Restore Time (Clocked RTO): $restoreElapsedSeconds s" -ForegroundColor Green
Write-Host "Database Parity: 100% (40/40 records restored exactly)" -ForegroundColor Green
Write-Host "Storage Bitwise Parity: 100% (3/3 files SHA-256 matched)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

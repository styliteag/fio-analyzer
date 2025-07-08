-- Migration script to convert old single-table database to new dual-table schema
-- This script safely migrates from the old structure to the new latest/historical separation
-- 
-- Before running: BACKUP YOUR DATABASE!
-- Usage: sqlite3 your_database.db < migrate-to-dual-table.sql

BEGIN TRANSACTION;

-- Step 1: Create new historical tables (test_runs_all)
CREATE TABLE IF NOT EXISTS test_runs_all (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    test_date TEXT,
    drive_model TEXT NOT NULL,
    drive_type TEXT NOT NULL,
    test_name TEXT NOT NULL,
    block_size TEXT NOT NULL,  -- Changed to TEXT to match existing data
    read_write_pattern TEXT NOT NULL,
    queue_depth INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    fio_version TEXT,
    job_runtime INTEGER,
    rwmixread INTEGER,
    total_ios_read INTEGER,
    total_ios_write INTEGER,
    usr_cpu REAL,
    sys_cpu REAL,
    hostname TEXT,
    protocol TEXT,
    description TEXT,
    uploaded_file_path TEXT,
    -- Job options fields
    output_file TEXT,
    num_jobs INTEGER,
    direct INTEGER,
    test_size TEXT,
    sync INTEGER,
    iodepth INTEGER,
    -- Uniqueness tracking
    is_latest INTEGER DEFAULT 1
);

-- Step 2: Create new performance metrics historical table
CREATE TABLE IF NOT EXISTS performance_metrics_all (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    operation_type TEXT,
    FOREIGN KEY (test_run_id) REFERENCES test_runs_all (id)
);

-- Step 3: Create new latency percentiles historical table
CREATE TABLE IF NOT EXISTS latency_percentiles_all (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL,
    percentile REAL NOT NULL,
    latency_ns INTEGER NOT NULL,
    FOREIGN KEY (test_run_id) REFERENCES test_runs_all (id)
);

-- Step 4: Backup existing data by copying to historical tables
-- Copy all test runs to test_runs_all
INSERT INTO test_runs_all (
    id, timestamp, test_date, drive_model, drive_type, test_name, 
    block_size, read_write_pattern, queue_depth, duration, fio_version, 
    job_runtime, rwmixread, total_ios_read, total_ios_write, 
    usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
    output_file, num_jobs, direct, test_size, sync, iodepth, is_latest
)
SELECT 
    id, timestamp, test_date, drive_model, drive_type, test_name,
    CAST(block_size AS TEXT) as block_size,  -- Ensure it's stored as text
    read_write_pattern, queue_depth, duration, fio_version,
    job_runtime, rwmixread, total_ios_read, total_ios_write,
    usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
    COALESCE(output_file, '') as output_file,
    COALESCE(num_jobs, 1) as num_jobs,
    COALESCE(direct, 0) as direct,
    COALESCE(test_size, '') as test_size,
    COALESCE(sync, 0) as sync,
    COALESCE(iodepth, queue_depth) as iodepth,  -- Use queue_depth if iodepth is missing
    COALESCE(is_latest, 1) as is_latest
FROM test_runs
WHERE NOT EXISTS (
    SELECT 1 FROM test_runs_all WHERE test_runs_all.id = test_runs.id
);

-- Copy all performance metrics to performance_metrics_all
INSERT INTO performance_metrics_all (
    id, test_run_id, metric_type, value, unit, operation_type
)
SELECT id, test_run_id, metric_type, value, unit, operation_type
FROM performance_metrics
WHERE NOT EXISTS (
    SELECT 1 FROM performance_metrics_all WHERE performance_metrics_all.id = performance_metrics.id
);

-- Copy all latency percentiles to latency_percentiles_all (if table exists)
INSERT INTO latency_percentiles_all (
    id, test_run_id, operation_type, percentile, latency_ns
)
SELECT id, test_run_id, operation_type, percentile, latency_ns
FROM latency_percentiles
WHERE EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='latency_percentiles')
AND NOT EXISTS (
    SELECT 1 FROM latency_percentiles_all WHERE latency_percentiles_all.id = latency_percentiles.id
);

-- Step 5: Clear existing test_runs table and recreate with unique constraints
-- First, rename the old table as backup
ALTER TABLE test_runs RENAME TO test_runs_backup;

-- Step 6: Create new test_runs table with unique constraints for latest-only data
CREATE TABLE test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    test_date TEXT,
    drive_model TEXT NOT NULL,
    drive_type TEXT NOT NULL,
    test_name TEXT NOT NULL,
    block_size TEXT NOT NULL,  -- Changed to TEXT to match existing data
    read_write_pattern TEXT NOT NULL,
    queue_depth INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    fio_version TEXT,
    job_runtime INTEGER,
    rwmixread INTEGER,
    total_ios_read INTEGER,
    total_ios_write INTEGER,
    usr_cpu REAL,
    sys_cpu REAL,
    hostname TEXT,
    protocol TEXT,
    description TEXT,
    uploaded_file_path TEXT,
    -- Job options fields
    output_file TEXT,
    num_jobs INTEGER,
    direct INTEGER,
    test_size TEXT,
    sync INTEGER,
    iodepth INTEGER,
    -- Always 1 for latest-only table
    is_latest INTEGER DEFAULT 1,
    -- Unique constraint to ensure only one latest entry per configuration
    UNIQUE(hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth, num_jobs, direct, test_size, sync, iodepth, duration)
);

-- Step 7: Populate new test_runs table with only the latest test per unique configuration
-- This identifies the most recent test for each unique configuration
INSERT INTO test_runs (
    timestamp, test_date, drive_model, drive_type, test_name, 
    block_size, read_write_pattern, queue_depth, duration, fio_version, 
    job_runtime, rwmixread, total_ios_read, total_ios_write, 
    usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
    output_file, num_jobs, direct, test_size, sync, iodepth, is_latest
)
SELECT 
    timestamp, test_date, drive_model, drive_type, test_name,
    block_size, read_write_pattern, queue_depth, duration, fio_version,
    job_runtime, rwmixread, total_ios_read, total_ios_write,
    usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
    output_file, num_jobs, direct, test_size, sync, iodepth, 1 as is_latest
FROM (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY hostname, protocol, drive_type, drive_model, 
                           block_size, read_write_pattern, queue_depth, 
                           num_jobs, direct, test_size, sync, iodepth, duration
               ORDER BY timestamp DESC
           ) as rn
    FROM test_runs_all
    WHERE hostname IS NOT NULL 
      AND protocol IS NOT NULL
      AND drive_type IS NOT NULL
      AND drive_model IS NOT NULL
) ranked
WHERE rn = 1;

-- Step 8: Clear and repopulate performance_metrics with only latest test data
-- Backup existing performance_metrics
ALTER TABLE performance_metrics RENAME TO performance_metrics_backup;

-- Recreate performance_metrics table
CREATE TABLE performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    operation_type TEXT,
    FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
);

-- Populate with metrics for latest test runs only
INSERT INTO performance_metrics (test_run_id, metric_type, value, unit, operation_type)
SELECT pma.test_run_id, pma.metric_type, pma.value, pma.unit, pma.operation_type
FROM performance_metrics_all pma
JOIN test_runs tr ON pma.test_run_id = tr.id;

-- Step 9: Clear and repopulate latency_percentiles with only latest test data (if table exists)
-- Check if latency_percentiles table exists before trying to rename it
UPDATE sqlite_master SET name = 'latency_percentiles_backup' 
WHERE type = 'table' AND name = 'latency_percentiles';

-- Create latency_percentiles table for latest data
CREATE TABLE IF NOT EXISTS latency_percentiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL,
    percentile REAL NOT NULL,
    latency_ns INTEGER NOT NULL,
    FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
);

-- Populate with percentiles for latest test runs only (if data exists)
INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns)
SELECT lpa.test_run_id, lpa.operation_type, lpa.percentile, lpa.latency_ns
FROM latency_percentiles_all lpa
JOIN test_runs tr ON lpa.test_run_id = tr.id;

-- Step 10: Create performance indexes for new tables
-- Indexes for test_runs_all (historical data queries)
CREATE INDEX IF NOT EXISTS idx_test_runs_all_timestamp 
ON test_runs_all (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_test_runs_all_host_protocol_time 
ON test_runs_all (hostname, protocol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_test_runs_all_config_filter 
ON test_runs_all (hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth);

-- Indexes for test_runs (latest data queries)
CREATE INDEX IF NOT EXISTS idx_test_runs_config_lookup 
ON test_runs (hostname, protocol, drive_type, drive_model);

-- Index for performance metrics by test_run_id and metric_type (both tables)
CREATE INDEX IF NOT EXISTS idx_performance_metrics_test_metric 
ON performance_metrics (test_run_id, metric_type, operation_type);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_all_test_metric 
ON performance_metrics_all (test_run_id, metric_type, operation_type);

-- Indexes for latency percentiles
CREATE INDEX IF NOT EXISTS idx_latency_percentiles_test_run 
ON latency_percentiles (test_run_id, operation_type);

CREATE INDEX IF NOT EXISTS idx_latency_percentiles_all_test_run 
ON latency_percentiles_all (test_run_id, operation_type);

-- Step 11: Create view for latest test results per server
CREATE VIEW IF NOT EXISTS latest_test_per_server AS
WITH ranked_tests AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY hostname, protocol, drive_model 
            ORDER BY timestamp DESC
        ) as rn
    FROM test_runs 
    WHERE hostname IS NOT NULL AND protocol IS NOT NULL
)
SELECT 
    id,
    hostname,
    protocol,
    drive_model,
    drive_type,
    test_name,
    block_size,
    read_write_pattern,
    queue_depth,
    timestamp,
    description,
    test_date
FROM ranked_tests 
WHERE rn = 1;

-- Step 12: Verify migration results
-- Count records in each table
SELECT 
    'Migration Summary' as status,
    (SELECT COUNT(*) FROM test_runs_all) as total_historical_runs,
    (SELECT COUNT(*) FROM test_runs) as latest_runs,
    (SELECT COUNT(*) FROM performance_metrics_all) as total_historical_metrics,
    (SELECT COUNT(*) FROM performance_metrics) as latest_metrics,
    (SELECT COUNT(*) FROM latency_percentiles_all) as total_historical_percentiles,
    (SELECT COUNT(*) FROM latency_percentiles) as latest_percentiles;

COMMIT;

-- Notes:
-- 1. Backup tables (test_runs_backup, performance_metrics_backup) are kept for safety
-- 2. All historical data is preserved in *_all tables
-- 3. Latest-only data is in the main tables with unique constraints
-- 4. Run VACUUM after migration to reclaim space if needed
-- 5. Test the application thoroughly after migration
-- 6. You can drop backup tables once you're confident the migration worked:
--    DROP TABLE IF EXISTS test_runs_backup;
--    DROP TABLE IF EXISTS performance_metrics_backup;
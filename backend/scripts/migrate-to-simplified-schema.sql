-- Migration script to simplify database schema by moving performance metrics into main tables
-- This script moves avg_latency, bandwidth, iops, p95_latency, p99_latency into the main tables
-- 
-- Before running: BACKUP YOUR DATABASE!
-- Usage: sqlite3 your_database.db < migrate-to-simplified-schema.sql

BEGIN TRANSACTION;

-- Step 1: Add performance metric columns to test_runs_all table
ALTER TABLE test_runs_all ADD COLUMN avg_latency REAL;
ALTER TABLE test_runs_all ADD COLUMN bandwidth REAL;
ALTER TABLE test_runs_all ADD COLUMN iops REAL;
ALTER TABLE test_runs_all ADD COLUMN p95_latency REAL;
ALTER TABLE test_runs_all ADD COLUMN p99_latency REAL;

-- Step 2: Add performance metric columns to test_runs table
ALTER TABLE test_runs ADD COLUMN avg_latency REAL;
ALTER TABLE test_runs ADD COLUMN bandwidth REAL;
ALTER TABLE test_runs ADD COLUMN iops REAL;
ALTER TABLE test_runs ADD COLUMN p95_latency REAL;
ALTER TABLE test_runs ADD COLUMN p99_latency REAL;

-- Step 3: Migrate existing performance metrics data to main tables
-- Update test_runs_all with performance metrics (take first available value)
UPDATE test_runs_all SET
    avg_latency = (
        SELECT value FROM performance_metrics_all 
        WHERE test_run_id = test_runs_all.id 
        AND metric_type = 'avg_latency'
        LIMIT 1
    ),
    bandwidth = (
        SELECT value FROM performance_metrics_all 
        WHERE test_run_id = test_runs_all.id 
        AND metric_type = 'bandwidth'
        LIMIT 1
    ),
    iops = (
        SELECT value FROM performance_metrics_all 
        WHERE test_run_id = test_runs_all.id 
        AND metric_type = 'iops'
        LIMIT 1
    ),
    p95_latency = (
        SELECT value FROM performance_metrics_all 
        WHERE test_run_id = test_runs_all.id 
        AND metric_type = 'p95_latency'
        LIMIT 1
    ),
    p99_latency = (
        SELECT value FROM performance_metrics_all 
        WHERE test_run_id = test_runs_all.id 
        AND metric_type = 'p99_latency'
        LIMIT 1
    );

-- Update test_runs with performance metrics (take first available value)
UPDATE test_runs SET
    avg_latency = (
        SELECT value FROM performance_metrics 
        WHERE test_run_id = test_runs.id 
        AND metric_type = 'avg_latency'
        LIMIT 1
    ),
    bandwidth = (
        SELECT value FROM performance_metrics 
        WHERE test_run_id = test_runs.id 
        AND metric_type = 'bandwidth'
        LIMIT 1
    ),
    iops = (
        SELECT value FROM performance_metrics 
        WHERE test_run_id = test_runs.id 
        AND metric_type = 'iops'
        LIMIT 1
    ),
    p95_latency = (
        SELECT value FROM performance_metrics 
        WHERE test_run_id = test_runs.id 
        AND metric_type = 'p95_latency'
        LIMIT 1
    ),
    p99_latency = (
        SELECT value FROM performance_metrics 
        WHERE test_run_id = test_runs.id 
        AND metric_type = 'p99_latency'
        LIMIT 1
    );

-- Step 4: Create backup tables for safety
CREATE TABLE IF NOT EXISTS performance_metrics_backup AS SELECT * FROM performance_metrics;
CREATE TABLE IF NOT EXISTS performance_metrics_all_backup AS SELECT * FROM performance_metrics_all;

-- Step 5: Drop the old performance_metrics tables
DROP TABLE IF EXISTS performance_metrics;
DROP TABLE IF EXISTS performance_metrics_all;

-- Step 6: Drop the old performance_metrics indexes
DROP INDEX IF EXISTS idx_performance_metrics_test_metric;
DROP INDEX IF EXISTS idx_performance_metrics_all_test_metric;

-- Step 7: Verify migration results
SELECT 
    'Migration Summary' as status,
    (SELECT COUNT(*) FROM test_runs_all) as total_historical_runs,
    (SELECT COUNT(*) FROM test_runs) as latest_runs,
    (SELECT COUNT(*) FROM performance_metrics_backup) as old_metrics_count,
    (SELECT COUNT(*) FROM performance_metrics_all_backup) as old_metrics_all_count;

-- Step 8: Show sample of migrated data
SELECT 
    'Sample Migrated Data' as info,
    id,
    hostname,
    drive_model,
    iops,
    avg_latency,
    bandwidth,
    p95_latency,
    p99_latency
FROM test_runs_all 
WHERE iops IS NOT NULL OR avg_latency IS NOT NULL
LIMIT 5;

COMMIT;

-- Notes:
-- 1. Backup tables (performance_metrics_backup, performance_metrics_all_backup) are kept for safety
-- 2. All performance metrics are now directly in the main tables
-- 3. API code needs to be updated to read/write directly to main tables
-- 4. Run VACUUM after migration to reclaim space if needed
-- 5. Test the application thoroughly after migration
-- 6. You can drop backup tables once you're confident the migration worked:
--    DROP TABLE IF EXISTS performance_metrics_backup;
--    DROP TABLE IF EXISTS performance_metrics_all_backup; 
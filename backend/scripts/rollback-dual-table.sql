-- Rollback script to revert dual-table migration back to single-table structure
-- WARNING: This will lose the latest/historical separation and revert to the old structure
-- 
-- Usage: sqlite3 your_database.db < rollback-dual-table.sql

BEGIN TRANSACTION;

-- Step 1: Check if backup tables exist
SELECT CASE 
    WHEN EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='test_runs_backup')
    THEN 'Backup tables found - proceeding with rollback'
    ELSE 'ERROR: Backup tables not found - cannot rollback safely'
END as rollback_status;

-- Step 2: Drop current tables
DROP TABLE IF EXISTS test_runs;
DROP TABLE IF EXISTS performance_metrics; 
DROP TABLE IF EXISTS latency_percentiles;
DROP VIEW IF EXISTS latest_test_per_server;

-- Step 3: Restore from backup tables
ALTER TABLE test_runs_backup RENAME TO test_runs;
ALTER TABLE performance_metrics_backup RENAME TO performance_metrics;

-- Step 4: Keep historical tables as backup (don't delete them)
-- The *_all tables remain for reference but won't be used by the old application

-- Step 5: Verify rollback
SELECT 
    'Rollback Summary' as status,
    (SELECT COUNT(*) FROM test_runs) as restored_runs,
    (SELECT COUNT(*) FROM performance_metrics) as restored_metrics,
    (SELECT COUNT(*) FROM test_runs_all) as historical_backup_runs,
    (SELECT COUNT(*) FROM performance_metrics_all) as historical_backup_metrics;

COMMIT;

-- Notes:
-- 1. Historical tables (*_all) are kept as backup
-- 2. Original structure is restored from backup tables
-- 3. You may need to restart your application after rollback
-- 4. Consider keeping the dual-table structure - it provides better performance!
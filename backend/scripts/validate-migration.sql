-- Validation script to verify dual-table migration was successful
-- Run this after the migration to ensure data integrity
-- 
-- Usage: sqlite3 your_database.db < validate-migration.sql

.mode column
.headers on

SELECT '=== MIGRATION VALIDATION REPORT ===' as report_title;

-- 1. Table structure validation
SELECT 'Table Structure Check' as check_type;
SELECT 
    name as table_name,
    CASE 
        WHEN name LIKE '%_all' THEN 'Historical'
        WHEN name IN ('test_runs', 'performance_metrics', 'latency_percentiles') THEN 'Latest'
        ELSE 'Other'
    END as table_type
FROM sqlite_master 
WHERE type = 'table' 
  AND name IN ('test_runs', 'test_runs_all', 'performance_metrics', 'performance_metrics_all', 
               'latency_percentiles', 'latency_percentiles_all', 'test_runs_backup', 'performance_metrics_backup')
ORDER BY table_type, name;

-- 2. Record count comparison
SELECT 'Record Count Validation' as check_type;
SELECT 
    'Test Runs' as data_type,
    (SELECT COUNT(*) FROM test_runs_all) as historical_count,
    (SELECT COUNT(*) FROM test_runs) as latest_count,
    (SELECT COUNT(*) FROM test_runs_backup) as original_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM test_runs_all) = (SELECT COUNT(*) FROM test_runs_backup) 
        THEN '✓ Historical data preserved'
        ELSE '✗ Data loss detected!'
    END as historical_validation,
    CASE 
        WHEN (SELECT COUNT(*) FROM test_runs) <= (SELECT COUNT(*) FROM test_runs_all)
        THEN '✓ Latest subset valid'
        ELSE '✗ Latest count error!'
    END as latest_validation;

SELECT 
    'Performance Metrics' as data_type,
    (SELECT COUNT(*) FROM performance_metrics_all) as historical_count,
    (SELECT COUNT(*) FROM performance_metrics) as latest_count,
    (SELECT COUNT(*) FROM performance_metrics_backup) as original_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM performance_metrics_all) = (SELECT COUNT(*) FROM performance_metrics_backup) 
        THEN '✓ Historical data preserved'
        ELSE '✗ Data loss detected!'
    END as historical_validation,
    CASE 
        WHEN (SELECT COUNT(*) FROM performance_metrics) <= (SELECT COUNT(*) FROM performance_metrics_all)
        THEN '✓ Latest subset valid'
        ELSE '✗ Latest count error!'
    END as latest_validation;

-- 3. Unique constraint validation
SELECT 'Unique Constraint Check' as check_type;
SELECT 
    COUNT(*) as total_latest_runs,
    COUNT(DISTINCT hostname || '|' || protocol || '|' || drive_type || '|' || drive_model || '|' || 
                   block_size || '|' || read_write_pattern || '|' || queue_depth || '|' || 
                   num_jobs || '|' || direct || '|' || test_size || '|' || sync || '|' || iodepth || '|' || duration) as unique_configs,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT hostname || '|' || protocol || '|' || drive_type || '|' || drive_model || '|' || 
                                      block_size || '|' || read_write_pattern || '|' || queue_depth || '|' || 
                                      num_jobs || '|' || direct || '|' || test_size || '|' || sync || '|' || iodepth || '|' || duration)
        THEN '✓ No duplicate configs in latest'
        ELSE '✗ Duplicate configs found!'
    END as uniqueness_validation
FROM test_runs;

-- 4. Data integrity validation - check if latest runs are actually the most recent
SELECT 'Data Recency Check' as check_type;
WITH latest_should_be AS (
    SELECT 
        hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth,
        num_jobs, direct, test_size, sync, iodepth, duration,
        MAX(timestamp) as max_timestamp
    FROM test_runs_all
    WHERE hostname IS NOT NULL AND protocol IS NOT NULL
    GROUP BY hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth,
             num_jobs, direct, test_size, sync, iodepth, duration
)
SELECT 
    COUNT(*) as configs_checked,
    SUM(CASE WHEN tr.timestamp = lsb.max_timestamp THEN 1 ELSE 0 END) as correct_latest,
    CASE 
        WHEN COUNT(*) = SUM(CASE WHEN tr.timestamp = lsb.max_timestamp THEN 1 ELSE 0 END)
        THEN '✓ All latest runs are most recent'
        ELSE '✗ Some latest runs are not the most recent!'
    END as recency_validation
FROM test_runs tr
JOIN latest_should_be lsb ON 
    tr.hostname = lsb.hostname AND 
    tr.protocol = lsb.protocol AND 
    tr.drive_type = lsb.drive_type AND 
    tr.drive_model = lsb.drive_model AND
    tr.block_size = lsb.block_size AND 
    tr.read_write_pattern = lsb.read_write_pattern AND 
    tr.queue_depth = lsb.queue_depth AND
    tr.num_jobs = lsb.num_jobs AND 
    tr.direct = lsb.direct AND 
    tr.test_size = lsb.test_size AND 
    tr.sync = lsb.sync AND 
    tr.iodepth = lsb.iodepth AND 
    tr.duration = lsb.duration;

-- 5. Foreign key validation
SELECT 'Foreign Key Validation' as check_type;
SELECT 
    'Performance Metrics (Latest)' as table_name,
    COUNT(*) as total_records,
    COUNT(tr.id) as valid_references,
    CASE 
        WHEN COUNT(*) = COUNT(tr.id) 
        THEN '✓ All foreign keys valid'
        ELSE '✗ Orphaned records found!'
    END as fk_validation
FROM performance_metrics pm
LEFT JOIN test_runs tr ON pm.test_run_id = tr.id;

SELECT 
    'Performance Metrics (Historical)' as table_name,
    COUNT(*) as total_records,
    COUNT(tra.id) as valid_references,
    CASE 
        WHEN COUNT(*) = COUNT(tra.id) 
        THEN '✓ All foreign keys valid'
        ELSE '✗ Orphaned records found!'
    END as fk_validation
FROM performance_metrics_all pma
LEFT JOIN test_runs_all tra ON pma.test_run_id = tra.id;

-- 6. Sample data verification - show some latest vs historical data
SELECT 'Sample Data Comparison' as check_type;
SELECT 'Latest Test Runs (Sample)' as sample_type;
SELECT hostname, protocol, drive_model, block_size, read_write_pattern, timestamp
FROM test_runs 
ORDER BY timestamp DESC 
LIMIT 5;

SELECT 'Historical Test Runs (Sample)' as sample_type;
SELECT hostname, protocol, drive_model, block_size, read_write_pattern, timestamp
FROM test_runs_all 
ORDER BY timestamp DESC 
LIMIT 5;

-- 7. View validation
SELECT 'View Validation' as check_type;
SELECT 
    COUNT(*) as view_record_count,
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✓ latest_test_per_server view working'
        ELSE '✗ View has no data!'
    END as view_validation
FROM latest_test_per_server;

SELECT '=== VALIDATION COMPLETE ===' as report_end;

-- Summary recommendations
SELECT 'RECOMMENDATIONS' as section;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM test_runs_all) = (SELECT COUNT(*) FROM test_runs_backup)
             AND (SELECT COUNT(*) FROM test_runs) <= (SELECT COUNT(*) FROM test_runs_all)
             AND (SELECT COUNT(*) FROM test_runs) = (SELECT COUNT(DISTINCT hostname || '|' || protocol || '|' || drive_type || '|' || drive_model || '|' || block_size || '|' || read_write_pattern || '|' || queue_depth || '|' || num_jobs || '|' || direct || '|' || test_size || '|' || sync || '|' || iodepth || '|' || duration) FROM test_runs)
        THEN 'Migration appears SUCCESSFUL! You can safely test the application.'
        ELSE 'Migration has ISSUES! Review the validation results above before proceeding.'
    END as migration_status;

SELECT 'Next steps:' as step, '1. Test the application thoroughly' as action;
SELECT 'Next steps:' as step, '2. Run VACUUM to reclaim disk space' as action;
SELECT 'Next steps:' as step, '3. If all works well, you can drop backup tables' as action;
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../config');
const { logInfo, logError, logWarning, calculateUniqueKey, getBaseIops, getBaseLatency, getBaseBandwidth, parseBlockSizeToKB, showServerReady } = require('../utils');

let db;

// Initialize database connection
function initDatabase() {
    logInfo('Initializing database connection', { dbPath: DB_PATH });
    
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            logError('Error opening database', err, { dbPath: DB_PATH });
            process.exit(1);
        }
        logInfo('Connected to SQLite database successfully', { dbPath: DB_PATH });
        initDb();
    });
    
    return db;
}

// Get database instance
function getDatabase() {
    if (!db) {
        const error = new Error('Database not initialized. Call initDatabase() first.');
        logError('Database not initialized', error);
        throw error;
    }
    return db;
}

// Mark existing tests as not latest when inserting a new test with the same configuration
function updateLatestFlags(testRun, callback) {
    const uniqueKey = calculateUniqueKey(testRun);
    
    logInfo('Updating latest flags for test run', { 
        uniqueKey,
        driveType: testRun.drive_type,
        driveModel: testRun.drive_model,
        hostname: testRun.hostname
    });
    
    // Find all existing tests with the same unique configuration
    const query = `
        UPDATE test_runs 
        SET is_latest = 0 
        WHERE drive_type = ? AND drive_model = ? AND hostname = ? AND protocol = ? 
        AND block_size = ? AND read_write_pattern = ? AND output_file = ? AND num_jobs = ? 
        AND direct = ? AND test_size = ? AND sync = ? AND iodepth = ?
    `;
    
    const params = [
        testRun.drive_type || null,
        testRun.drive_model || null,
        testRun.hostname || null,
        testRun.protocol || null,
        testRun.block_size || null,
        testRun.read_write_pattern || null,
        testRun.output_file || null,
        testRun.num_jobs || null,
        testRun.direct || null,
        testRun.test_size || null,
        testRun.sync || null,
        testRun.iodepth || null
    ];
    
    db.run(query, params, function(err) {
        if (err) {
            logError('Error updating latest flags', err, { uniqueKey });
            return callback(err);
        }
        logInfo('Updated existing tests to is_latest=0', { 
            changes: this.changes,
            uniqueKey 
        });
        callback(null);
    });
}

// Database schema initialization
function initDb() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS test_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                test_date TEXT,
                drive_model TEXT NOT NULL,
                drive_type TEXT NOT NULL,
                test_name TEXT NOT NULL,
                block_size INTEGER NOT NULL,
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
                -- Job options fields moved from job_options table
                output_file TEXT,
                num_jobs INTEGER,
                direct INTEGER,
                test_size TEXT,
                sync INTEGER,
                iodepth INTEGER,
                -- Uniqueness tracking
                is_latest INTEGER DEFAULT 1
            )
        `);

        // Add new columns if they don't exist (for existing databases)
        db.run(`ALTER TABLE test_runs ADD COLUMN hostname TEXT`, (err) => {
            // Ignore error if column already exists
        });
        
        db.run(`ALTER TABLE test_runs ADD COLUMN protocol TEXT`, (err) => {
            // Ignore error if column already exists
        });
        
        db.run(`ALTER TABLE test_runs ADD COLUMN description TEXT`, (err) => {
            // Ignore error if column already exists
        });
        
        db.run(`ALTER TABLE test_runs ADD COLUMN uploaded_file_path TEXT`, (err) => {
            // Ignore error if column already exists
        });
        
        db.run(`ALTER TABLE test_runs ADD COLUMN test_date TEXT`, (err) => {
            // Ignore error if column already exists
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                operation_type TEXT,
                FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS latency_percentiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                operation_type TEXT NOT NULL,
                percentile REAL NOT NULL,
                latency_ns INTEGER NOT NULL,
                FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
            )
        `);

        // Create composite index for uniqueness checks
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_unique_key 
            ON test_runs (drive_type, drive_model, hostname, protocol, block_size, read_write_pattern, output_file, num_jobs, direct, test_size, sync, iodepth)
        `);

        // Time-series database optimizations for efficient queries
        
        // Index for time-series queries by server (hostname+protocol) and timestamp
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_timeseries 
            ON test_runs (hostname, protocol, timestamp DESC)
        `);
        
        // Index for time-series queries by server, drive model, and timestamp
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_server_drive_time 
            ON test_runs (hostname, protocol, drive_model, timestamp DESC)
        `);
        
        // Index for performance metrics by test_run_id and metric_type
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_performance_metrics_test_metric 
            ON performance_metrics (test_run_id, metric_type, operation_type)
        `);
        
        // Index for timestamp-based queries (historical data)
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_timestamp 
            ON test_runs (timestamp DESC)
        `);
        
        // Create view for latest test results per server
        db.run(`
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
            WHERE rn = 1
        `);

        db.get('SELECT COUNT(*) as count FROM test_runs', (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }
            if (row.count === 0) {
                console.log('Populating sample data...');
                console.log('Estimated data: ~60 test runs with ~300 metrics (reduced for faster startup)');
                populateSampleData(() => {
                    showServerReady(8000);
                });
            } else {
                showServerReady(8000);
            }
        });
    });
}

// Sample data generation
function populateSampleData(callback) {
    // Define multiple realistic servers with different storage types
    const servers = [
        { hostname: "sim-web-01", protocol: "NFS", drives: [["Simsung 980 PRO", "HDD"]] },
        { hostname: "sim-db-01", protocol: "iSCSI", drives: [["Simsung SN850", "NVMe SSD"]] },
        { hostname: "sim-app-01", protocol: "Local", drives: [["Simsung 980 PRO", "NVMe SSD"]] },
        { hostname: "sim-cache-01", protocol: "Local", drives: [["Simsung Optane", "NVMe SSD"]] }
    ];
    
    const block_sizes = ['4K', '8K', '16K', '64K', '1M']; // Focused on common block sizes
    const patterns = ["sequential_read", "sequential_write", "random_read", "random_write"];
    const queue_depths = [1, 4, 8, 16]; // Common queue depths
    
    const testRunsData = [];
    
    // Generate multiple realistic test scenarios across all servers
    for (const server of servers) {
        console.log(`Processing server: ${server.hostname} (${server.protocol})`);
        
        // Generate tests for each drive on this server
        for (const [drive_model, drive_type] of server.drives) {
            console.log(`  Drive: ${drive_model} (${drive_type})`);
            
            // Create regular time-series data - tests every few days over 30 days
            for (let dayOffset = 0; dayOffset < 30; dayOffset += 2 + Math.floor(Math.random() * 4)) {
                // Create timestamp for this day (with some hour randomization)
                const dayMs = dayOffset * 24 * 60 * 60 * 1000;
                const hourRandomization = Math.random() * 12 * 60 * 60 * 1000; // Random hour in first 12 hours
                const timestamp = new Date(Date.now() - dayMs + hourRandomization).toISOString();
                
                // Create a focused test run for this time point
                const block_size = block_sizes[Math.floor(Math.random() * block_sizes.length)];
                const pattern = patterns[Math.floor(Math.random() * patterns.length)];
                const queue_depth = queue_depths[Math.floor(Math.random() * queue_depths.length)];
                
                const test_name = `${server.hostname}_${pattern}_${block_size}`;
                console.log(`    Creating: ${test_name} (${drive_model}, ${block_size}, QD${queue_depth}) at ${timestamp.substring(0, 10)}`);
                
                // Store test run data for batch processing
                testRunsData.push({
                    timestamp,
                    drive_model,
                    drive_type,
                    test_name,
                    block_size,
                    pattern,
                    queue_depth,
                    server,
                    testDate: new Date(timestamp)
                });
            }
        }
    }

    db.serialize(() => {
        // Insert all test runs first
        const testRunIds = [];
        let testRunsInserted = 0;
        
        const stmt = db.prepare(`
            INSERT INTO test_runs (
                timestamp, test_date, drive_model, drive_type, test_name, 
                block_size, read_write_pattern, queue_depth, duration, 
                fio_version, job_runtime, rwmixread, total_ios_read, total_ios_write, 
                usr_cpu, sys_cpu, hostname, protocol, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        testRunsData.forEach((data, index) => {
            // Calculate realistic test results based on drive type
            const fakeIops = Math.floor(getBaseIops(data.drive_type, data.pattern, data.block_size) * (0.8 + Math.random() * 0.4));
            const fakeLatency = getBaseLatency(data.drive_type, data.pattern) * (0.8 + Math.random() * 0.4);
            const fakeBandwidth = Math.floor(getBaseBandwidth(data.drive_type, data.pattern, data.block_size) * (0.8 + Math.random() * 0.4));
            
            stmt.run([
                data.timestamp,
                data.testDate.toISOString(),
                data.drive_model,
                data.drive_type,
                data.test_name,
                data.block_size,
                data.pattern,
                data.queue_depth,
                30, // duration: 30 seconds
                "fio-3.28", // fio_version
                30000, // job_runtime: 30000ms
                data.pattern.includes('read') ? 100 : 0, // rwmixread
                data.pattern.includes('read') ? fakeIops * 30 : 0, // total_ios_read
                data.pattern.includes('write') ? fakeIops * 30 : 0, // total_ios_write
                5.2 + Math.random() * 3, // usr_cpu: 5-8%
                2.1 + Math.random() * 2, // sys_cpu: 2-4%
                data.server.hostname,
                data.server.protocol,
                `Simulated ${data.pattern} test on ${data.drive_model} drive`
            ], function(err) {
                if (err) {
                    console.error('Error inserting test run:', err);
                    return;
                }
                
                // Store the test run ID for metrics insertion
                testRunIds.push({
                    id: this.lastID,
                    data: data,
                    iops: fakeIops,
                    latency: fakeLatency,
                    bandwidth: fakeBandwidth
                });
                
                testRunsInserted++;
                if (testRunsInserted === testRunsData.length) {
                    insertMetricsForAllTests(testRunIds, callback);
                }
            });
        });
        
        stmt.finalize();
    });
}

// Insert performance metrics and latency percentiles for all test runs
function insertMetricsForAllTests(testRunIds, callback) {
    let metricsInserted = 0;
    const totalMetrics = testRunIds.length * 4; // ~4 metrics per test run (IOPS, latency, bandwidth, latency percentiles)
    
    // Insert metrics for each test run
    testRunIds.forEach(testRun => {
        const { id, data, iops, latency, bandwidth } = testRun;
        
        // Insert IOPS metric
        insertMetric(id, 'iops', iops, 'IOPS', data.pattern.includes('read') ? 'read' : 'write', () => {
            metricsInserted++;
            checkCompletion();
        });
        
        // Insert latency metric
        insertMetric(id, 'avg_latency', latency, 'ms', data.pattern.includes('read') ? 'read' : 'write', () => {
            metricsInserted++;
            checkCompletion();
        });
        
        // Insert bandwidth metric
        insertMetric(id, 'bandwidth', bandwidth, 'MB/s', data.pattern.includes('read') ? 'read' : 'write', () => {
            metricsInserted++;
            checkCompletion();
        });
        
        // Insert latency percentiles
        insertLatencyPercentiles(id, data.pattern.includes('read') ? 'read' : 'write', latency, () => {
            metricsInserted++;
            checkCompletion();
        });
    });
    
    function checkCompletion() {
        if (metricsInserted >= totalMetrics) {
            console.log(`Sample data generation complete: ${testRunIds.length} test runs, ~${totalMetrics} metrics`);
            callback();
        }
    }
}

// Insert a single performance metric
function insertMetric(testRunId, metricType, value, unit, operationType, callback) {
    db.run(
        'INSERT INTO performance_metrics (test_run_id, metric_type, value, unit, operation_type) VALUES (?, ?, ?, ?, ?)',
        [testRunId, metricType, value, unit, operationType],
        callback
    );
}

// Insert latency percentiles for a test run
function insertLatencyPercentiles(testRunId, operationType, baseLatency, callback) {
    const percentiles = [
        { percentile: 50.0, multiplier: 1.0 },
        { percentile: 90.0, multiplier: 1.5 },
        { percentile: 95.0, multiplier: 2.0 },
        { percentile: 99.0, multiplier: 3.0 },
        { percentile: 99.9, multiplier: 5.0 }
    ];
    
    let inserted = 0;
    let errors = 0;
    
    percentiles.forEach(p => {
        const latencyNs = Math.floor(baseLatency * p.multiplier * 1000000); // Convert ms to ns
        
        // Ensure latency is valid
        if (latencyNs > 0) {
            db.run(
                'INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns) VALUES (?, ?, ?, ?)',
                [testRunId, operationType, p.percentile, latencyNs],
                (err) => {
                    if (err) {
                        logError('Error inserting latency percentile', err, {
                            testRunId,
                            operationType,
                            percentile: p.percentile,
                            latencyNs,
                            baseLatency
                        });
                        errors++;
                    }
                    inserted++;
                    if (inserted === percentiles.length && callback) {
                        callback(errors > 0 ? new Error(`${errors} percentile insertions failed`) : null);
                    }
                }
            );
        } else {
            logWarning('Skipping invalid latency percentile', {
                testRunId,
                operationType,
                percentile: p.percentile,
                latencyNs,
                baseLatency,
                reason: 'invalid_latency'
            });
            inserted++;
            if (inserted === percentiles.length && callback) {
                callback(errors > 0 ? new Error(`${errors} percentile insertions failed`) : null);
            }
        }
    });
}

module.exports = {
    initDatabase,
    getDatabase,
    updateLatestFlags,
    insertMetric,
    insertLatencyPercentiles
};
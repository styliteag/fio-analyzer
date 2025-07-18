const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../config');
const { logInfo, logError, calculateUniqueKey, getBaseIops, getBaseLatency, getBaseBandwidth, showServerReady } = require('../utils');

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
        // Create test_runs_all table for all historical data
        db.run(`
            CREATE TABLE IF NOT EXISTS test_runs_all (
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
                -- Performance metrics directly in main table
                avg_latency REAL,
                bandwidth REAL,
                iops REAL,
                p95_latency REAL,
                p99_latency REAL,
                -- Uniqueness tracking (kept for migration purposes)
                is_latest INTEGER DEFAULT 1
            )
        `);

        // Create test_runs table for latest data only with unique constraints
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
                -- Performance metrics directly in main table
                avg_latency REAL,
                bandwidth REAL,
                iops REAL,
                p95_latency REAL,
                p99_latency REAL,
                -- Uniqueness tracking (always 1 for latest-only table)
                is_latest INTEGER DEFAULT 1,
                -- Unique constraint to ensure only one latest entry per configuration
                UNIQUE(hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth, num_jobs, direct, test_size, sync, iodepth, duration)
            )
        `);

        // Create indexes for test_runs_all (historical data queries)
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_all_timestamp 
            ON test_runs_all (timestamp DESC)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_all_host_protocol_time 
            ON test_runs_all (hostname, protocol, timestamp DESC)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_all_config_filter 
            ON test_runs_all (hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth)
        `);

        // Create indexes for test_runs (latest data queries)
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_test_runs_config_lookup 
            ON test_runs (hostname, protocol, drive_type, drive_model)
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

            db.get('SELECT COUNT(*) as count FROM test_runs_all', (err, allRow) => {
                if (err) {
                    console.error(err.message);
                    return;
                }

                if (row.count === 0 && allRow.count === 0) {
                    console.log('Populating sample data...');
                    console.log('Estimated data: ~60 test runs with performance metrics (simplified schema)');
                    populateSampleData(() => {
                        showServerReady(8000);
                    });
                } else {
                    showServerReady(8000);
                }
            });
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

    // Process data in a simpler way to avoid statement finalization issues
    const testRunIds = [];
    const testRunIdsAll = [];

    const insertNextTestRun = (index) => {
        if (index >= testRunsData.length) {
            console.log('All test runs inserted, now inserting metrics...');
            insertMetricsForAllTests(testRunIds, testRunIdsAll, callback);
            return;
        }

        const data = testRunsData[index];

        // Calculate realistic test results based on drive type
        const fakeIops = Math.floor(getBaseIops(data.drive_type, data.pattern, data.block_size) * (0.8 + Math.random() * 0.4));
        const fakeLatency = getBaseLatency(data.drive_type, data.pattern) * (0.8 + Math.random() * 0.4);
        const fakeBandwidth = Math.floor(getBaseBandwidth(data.drive_type, data.pattern, data.block_size) * (0.8 + Math.random() * 0.4));

        // Generate realistic job option values
        const numJobs = [1, 2, 4, 8][Math.floor(Math.random() * 4)]; // 1, 2, 4, or 8 jobs
        const directIO = Math.random() > 0.5 ? 1 : 0; // 50% chance of direct IO
        const syncMode = Math.random() > 0.7 ? 1 : 0; // 30% chance of sync mode
        const testSizes = ["1M", "10M", "100M", "1G"];
        const testSize = testSizes[Math.floor(Math.random() * testSizes.length)];
        const iodepth = [1, 4, 8, 16, 32][Math.floor(Math.random() * 5)]; // Common iodepth values

        const testParams = [
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
            `Simulated ${data.pattern} test on ${data.drive_model} drive`,
            "testfile.bin", // output_file
            numJobs, // num_jobs
            directIO, // direct: 0 or 1
            testSize, // test_size
            syncMode, // sync: 0 or 1
            iodepth, // iodepth
            fakeLatency, // avg_latency
            fakeBandwidth, // bandwidth
            fakeIops, // iops
            fakeLatency * 1.25, // p95_latency
            fakeLatency * 1.5 // p99_latency
        ];

        // Insert into test_runs_all first (always succeeds)
        db.run(`
            INSERT INTO test_runs_all (
                timestamp, test_date, drive_model, drive_type, test_name, 
                block_size, read_write_pattern, queue_depth, duration, 
                fio_version, job_runtime, rwmixread, total_ios_read, total_ios_write, 
                usr_cpu, sys_cpu, hostname, protocol, description,
                output_file, num_jobs, direct, test_size, sync, iodepth,
                avg_latency, bandwidth, iops, p95_latency, p99_latency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, testParams, function(err) {
            if (err) {
                console.error('Error inserting test run to test_runs_all:', err);
                insertNextTestRun(index + 1);
                return;
            }

            const allId = this.lastID;
            testRunIdsAll.push({
                id: allId,
                data: data,
                iops: fakeIops,
                latency: fakeLatency,
                bandwidth: fakeBandwidth
            });

            // Try to insert into test_runs (may fail due to unique constraint)
            db.run(`
                INSERT OR REPLACE INTO test_runs (
                    timestamp, test_date, drive_model, drive_type, test_name, 
                    block_size, read_write_pattern, queue_depth, duration, 
                    fio_version, job_runtime, rwmixread, total_ios_read, total_ios_write, 
                    usr_cpu, sys_cpu, hostname, protocol, description,
                    output_file, num_jobs, direct, test_size, sync, iodepth,
                    avg_latency, bandwidth, iops, p95_latency, p99_latency
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, testParams, function(err) {
                if (err) {
                    console.error('Error inserting test run to test_runs:', err);
                } else {
                    testRunIds.push({
                        id: this.lastID,
                        data: data,
                        iops: fakeIops,
                        latency: fakeLatency,
                        bandwidth: fakeBandwidth
                    });
                }

                // Continue with next test run
                insertNextTestRun(index + 1);
            });
        });
    };

    // Start the sequential insertion
    insertNextTestRun(0);
}

// Insert performance metrics and latency percentiles for all test runs
function insertMetricsForAllTests(testRunIds, testRunIdsAll, callback) {
    // Since metrics are now stored directly in the main tables, we don't need separate insertion
    console.log(`Sample data generation complete: ${testRunIds.length} latest test runs, ${testRunIdsAll.length} historical test runs`);
    console.log('Performance metrics are now stored directly in the main tables');
    callback();
}

module.exports = {
    initDatabase,
    getDatabase,
    updateLatestFlags,
    insertMetricsForAllTests
};

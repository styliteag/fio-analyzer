const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, './db/storage_performance.db');
const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

const multer = require('multer');
const upload = multer();

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error(err.message);
        // Create the db directory if it doesn't exist
        const fs = require('fs');
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        // try to connect again
        new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Connected to the SQLite database.');
                initDb();
            }
        });
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS test_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
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
                sys_cpu REAL
            )
        `);

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

        db.get('SELECT COUNT(*) as count FROM test_runs', (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }
            if (row.count === 0) {
                console.log('Populating sample data...');
                populateSampleData();
            }
        });
    });
}

function populateSampleData() {
    const drives = [
        ["Samsung 980 PRO", "NVMe SSD"],
        ["WD Black SN850", "NVMe SSD"],
        ["Crucial MX500", "SATA SSD"],
        ["Seagate Barracuda", "HDD"],
        ["Intel Optane", "NVMe SSD"]
    ];
    
    const block_sizes = [4, 8, 16, 32, 64, 128]; // KB
    const patterns = ["sequential_read", "sequential_write", "random_read", "random_write", "mixed_70_30"];
    const queue_depths = [1, 4, 8, 16, 32];
    
    let testRunId = 1;

    const testRunsStmt = db.prepare('INSERT INTO test_runs (timestamp, drive_model, drive_type, test_name, block_size, read_write_pattern, queue_depth, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const metricsStmt = db.prepare('INSERT INTO performance_metrics (test_run_id, metric_type, value, unit) VALUES (?, ?, ?, ?)');

    db.serialize(() => {
        for (const [drive_model, drive_type] of drives) {
            for (let i = 0; i < 10; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
                
                const sampleBlockSizes = [...block_sizes].sort(() => 0.5 - Math.random()).slice(0, 3);
                for (const block_size of sampleBlockSizes) {
                    const samplePatterns = [...patterns].sort(() => 0.5 - Math.random()).slice(0, 2);
                    for (const pattern of samplePatterns) {
                        const queue_depth = queue_depths[Math.floor(Math.random() * queue_depths.length)];
                        
                        const test_name = `FIO_${pattern}_${block_size}k`;
                        testRunsStmt.run(timestamp, drive_model, drive_type, test_name, block_size, pattern, queue_depth, 300);
                        
                        const base_iops = getBaseIops(drive_type, pattern, block_size);
                        const base_latency = getBaseLatency(drive_type, pattern);
                        const base_throughput = getBaseThroughput(drive_type, pattern, block_size);
                        
                        const iops = base_iops * (0.8 + Math.random() * 0.4);
                        const latency = base_latency * (0.7 + Math.random() * 0.6);
                        const throughput = base_throughput * (0.85 + Math.random() * 0.3);
                        
                        const metrics = [
                            [testRunId, "iops", iops, "IOPS"],
                            [testRunId, "avg_latency", latency, "ms"],
                            [testRunId, "throughput", throughput, "MB/s"],
                            [testRunId, "p95_latency", latency * 1.5, "ms"],
                            [testRunId, "p99_latency", latency * 2.2, "ms"]
                        ];
                        
                        for (const metric of metrics) {
                            metricsStmt.run(metric);
                        }
                        
                        testRunId++;
                    }
                }
            }
        }
        testRunsStmt.finalize();
        metricsStmt.finalize();
    });
}

function getBaseIops(drive_type, pattern, block_size) {
    const base_values = {
        "NVMe SSD": {"sequential": 100000, "random": 50000},
        "SATA SSD": {"sequential": 50000, "random": 25000},
        "HDD": {"sequential": 200, "random": 100}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    const base = base_values[drive_type][pattern_type];
    
    return base * Math.pow(64 / block_size, 0.5);
}

function getBaseLatency(drive_type, pattern) {
    const base_values = {
        "NVMe SSD": {"sequential": 0.1, "random": 0.2},
        "SATA SSD": {"sequential": 0.5, "random": 1.0},
        "HDD": {"sequential": 8.0, "random": 12.0}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    return base_values[drive_type][pattern_type];
}

function getBaseThroughput(drive_type, pattern, block_size) {
    const base_values = {
        "NVMe SSD": {"sequential": 3500, "random": 2000},
        "SATA SSD": {"sequential": 550, "random": 400},
        "HDD": {"sequential": 150, "random": 80}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    const base = base_values[drive_type][pattern_type];
    
    return base * Math.pow(block_size / 64, 0.3);
}


app.get('/api/test-runs', (req, res) => {
    db.all(`
        SELECT id, timestamp, drive_model, drive_type, test_name, 
               block_size, read_write_pattern, queue_depth, duration,
               fio_version, job_runtime, rwmixread, total_ios_read, 
               total_ios_write, usr_cpu, sys_cpu
        FROM test_runs
        ORDER BY timestamp DESC
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/performance-data', (req, res) => {
    const { test_run_ids, metric_types } = req.query;

    if (!test_run_ids) {
        return res.status(400).json({ error: "test_run_ids is required" });
    }

    const run_ids = test_run_ids.split(',').map(id => parseInt(id.trim()));
    const metrics = (metric_types || "iops,avg_latency,throughput").split(',').map(m => m.trim());
    
    const placeholders = run_ids.map(() => '?').join(',');
    const metric_placeholders = metrics.map(() => '?').join(',');

    const query = `
        SELECT tr.id, tr.drive_model, tr.drive_type, tr.test_name, 
               tr.block_size, tr.read_write_pattern, tr.timestamp,
               pm.metric_type, pm.value, pm.unit
        FROM test_runs tr
        JOIN performance_metrics pm ON tr.id = pm.test_run_id
        WHERE tr.id IN (${placeholders}) AND pm.metric_type IN (${metric_placeholders})
        ORDER BY tr.timestamp, pm.metric_type
    `;

    db.all(query, [...run_ids, ...metrics], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const data = {};
        for (const row of rows) {
            const run_id = row.id;
            if (!data[run_id]) {
                data[run_id] = {
                    id: run_id,
                    drive_model: row.drive_model,
                    drive_type: row.drive_type,
                    test_name: row.test_name,
                    block_size: row.block_size,
                    read_write_pattern: row.read_write_pattern,
                    timestamp: row.timestamp,
                    metrics: {}
                };
            }
            data[run_id].metrics[row.metric_type] = {
                value: row.value,
                unit: row.unit
            };
        }
        
        // The frontend expects an array of objects, not an object with keys as ids
        const responseData = Object.values(data);
        res.json(responseData);
    });
});

// Get filter options
app.get('/api/filters', (req, res) => {
    const queries = [
        'SELECT DISTINCT drive_type FROM test_runs ORDER BY drive_type',
        'SELECT DISTINCT drive_model FROM test_runs ORDER BY drive_model', 
        'SELECT DISTINCT read_write_pattern FROM test_runs ORDER BY read_write_pattern',
        'SELECT DISTINCT block_size FROM test_runs ORDER BY block_size'
    ];

    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    )).then(([driveTypes, driveModels, patterns, blockSizes]) => {
        res.json({
            drive_types: driveTypes.map(row => row.drive_type),
            drive_models: driveModels.map(row => row.drive_model),
            patterns: patterns.map(row => row.read_write_pattern),
            block_sizes: blockSizes.map(row => row.block_size)
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// Update test run endpoint
app.put('/api/test-runs/:id', (req, res) => {
    const { id } = req.params;
    const { drive_model, drive_type } = req.body;
    
    if (!drive_model && !drive_type) {
        return res.status(400).json({ error: 'At least one field (drive_model or drive_type) is required' });
    }
    
    const updates = [];
    const values = [];
    
    if (drive_model) {
        updates.push('drive_model = ?');
        values.push(drive_model);
    }
    
    if (drive_type) {
        updates.push('drive_type = ?');
        values.push(drive_type);
    }
    
    values.push(parseInt(id));
    
    const query = `UPDATE test_runs SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(query, values, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Test run not found' });
        }
        
        res.json({ message: 'Test run updated successfully', changes: this.changes });
    });
});

// FIO JSON import endpoint
app.post('/api/import', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fioData = JSON.parse(req.file.buffer.toString());
        const { drive_model = 'Unknown', drive_type = 'Unknown' } = req.body;

        // Process first job from FIO output
        const job = fioData.jobs?.[0];
        if (!job) {
            return res.status(400).json({ error: 'No job data found in FIO output' });
        }

        const opts = job['job options'] || {};
        const globalOpts = fioData['global options'] || {};

        // Extract test parameters
        const bs = opts.bs || globalOpts.bs || '4k';
        const block_size = parseInt(bs.toString().replace('k', ''));
        const rw = opts.rw || globalOpts.rw || 'read';
        const iodepth = parseInt(opts.iodepth || globalOpts.iodepth || '1');
        const duration = job.runtime || 0;
        const test_name = job.jobname || 'fio_test';
        const rwmixread = parseInt(opts.rwmixread || '100');

        // Insert test run
        const insertTestRun = `
            INSERT INTO test_runs 
            (timestamp, drive_model, drive_type, test_name, block_size, 
             read_write_pattern, queue_depth, duration, fio_version, 
             job_runtime, rwmixread, total_ios_read, total_ios_write, 
             usr_cpu, sys_cpu)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(insertTestRun, [
            new Date().toISOString(),
            drive_model,
            drive_type,
            test_name,
            block_size,
            rw,
            iodepth,
            duration,
            fioData['fio version'],
            job.job_runtime,
            rwmixread,
            job.read?.total_ios || 0,
            job.write?.total_ios || 0,
            job.usr_cpu,
            job.sys_cpu
        ], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const testRunId = this.lastID;

            // Insert performance metrics for read operations
            if (job.read && job.read.iops > 0) {
                insertMetrics(testRunId, job.read, 'read');
            }

            // Insert performance metrics for write operations  
            if (job.write && job.write.iops > 0) {
                insertMetrics(testRunId, job.write, 'write');
            }

            // Insert latency percentiles
            if (job.read?.clat_ns?.percentile) {
                insertLatencyPercentiles(testRunId, job.read.clat_ns.percentile, 'read');
            }
            if (job.write?.clat_ns?.percentile) {
                insertLatencyPercentiles(testRunId, job.write.clat_ns.percentile, 'write');
            }

            res.json({ message: 'FIO results imported successfully', test_run_id: testRunId });
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

function insertMetrics(testRunId, data, operationType) {
    const metrics = [
        [testRunId, 'iops', data.iops, 'IOPS', operationType],
        [testRunId, 'bandwidth', data.bw, 'KB/s', operationType],
        [testRunId, 'avg_latency', data.clat_ns?.mean / 1000000 || 0, 'ms', operationType]
    ];

    const stmt = db.prepare('INSERT INTO performance_metrics (test_run_id, metric_type, value, unit, operation_type) VALUES (?, ?, ?, ?, ?)');
    for (const metric of metrics) {
        stmt.run(metric);
    }
    stmt.finalize();
}

function insertLatencyPercentiles(testRunId, percentiles, operationType) {
    const stmt = db.prepare('INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns) VALUES (?, ?, ?, ?)');
    
    for (const [percentile, latencyNs] of Object.entries(percentiles)) {
        stmt.run([testRunId, operationType, parseFloat(percentile), parseInt(latencyNs)]);
    }
    stmt.finalize();
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../db/storage_performance.db');
const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

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
                duration INTEGER NOT NULL
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
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
               block_size, read_write_pattern, queue_depth, duration
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


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

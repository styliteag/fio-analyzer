const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(__dirname, './db/storage_performance.db');
const HTPASSWD_PATH = path.resolve(__dirname, '.htpasswd');
const HTUPLOADERS_PATH = path.resolve(__dirname, '.htuploaders');
const app = express();
const port = 8000;

// Check if user has admin privileges
function isAdminUser(username, password) {
    const htpasswdUsers = parseHtpasswd(HTPASSWD_PATH);
    if (!htpasswdUsers || !htpasswdUsers[username]) {
        return false;
    }
    
    const hash = htpasswdUsers[username];
    return verifyPassword(password, hash);
}

// Check if user has upload-only privileges
function isUploaderUser(username, password) {
    const htuploadersUsers = parseHtpasswd(HTUPLOADERS_PATH);
    if (!htuploadersUsers || !htuploadersUsers[username]) {
        return false;
    }
    
    const hash = htuploadersUsers[username];
    return verifyPassword(password, hash);
}

// Combined auth checker that works for any valid user
function customAuthChecker(username, password) {
    return isAdminUser(username, password) || isUploaderUser(username, password);
}

// Get user role
function getUserRole(username, password) {
    if (isAdminUser(username, password)) {
        return 'admin';
    } else if (isUploaderUser(username, password)) {
        return 'uploader';
    }
    return null;
}

// Verify password against hash
function verifyPassword(password, hash) {
    // Handle different hash formats
    if (hash.startsWith('$2y$') || hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
        // Bcrypt format
        return bcrypt.compareSync(password, hash);
    } else if (hash.startsWith('$apr1$')) {
        // Apache MD5 - not implemented, use bcrypt instead
        console.warn('Apache MD5 format not supported, please recreate .htpasswd with bcrypt (-B flag)');
        return false;
    } else {
        // Plain text (insecure)
        return password === hash;
    }
}

// Parse htpasswd file
function parseHtpasswd(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: .htpasswd file not found at ${filePath}. Authentication disabled.`);
        return null;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const users = {};
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const [username, hash] = trimmedLine.split(':');
                if (username && hash) {
                    users[username] = hash;
                }
            }
        });
        return Object.keys(users).length > 0 ? users : null;
    } catch (error) {
        console.error(`Error reading .htpasswd file: ${error.message}`);
        return null;
    }
}

app.use(cors());

// Allow OPTIONS requests to bypass authentication for CORS preflight
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.sendStatus(200);
    } else {
        next();
    }
});

// Authentication middleware for any valid user (admin or uploader)
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        logWarning('Authentication failed - no credentials provided', {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            ip: req.ip || req.connection.remoteAddress
        });
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    
    const userRole = getUserRole(username, password);
    if (!userRole) {
        logWarning('Authentication failed - invalid credentials', {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            username,
            ip: req.ip || req.connection.remoteAddress
        });
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    logInfo('User authenticated successfully', {
        requestId: req.requestId,
        username,
        role: userRole,
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress
    });
    
    req.user = { username, role: userRole };
    next();
}

// Authentication middleware for admin-only routes
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        logWarning('Authentication failed - no credentials provided', {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            ip: req.ip || req.connection.remoteAddress
        });
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    
    if (!isAdminUser(username, password)) {
        logWarning('Access denied - admin privileges required', {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            username,
            ip: req.ip || req.connection.remoteAddress
        });
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    logInfo('Admin user authenticated successfully', {
        requestId: req.requestId,
        username,
        role: 'admin',
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress
    });
    
    req.user = { username, role: 'admin' };
    next();
}

// Logging utility functions
function logInfo(message, details = {}) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
    const detailsStr = Object.entries(details)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
    
    console.log(`[${timestamp}] INFO  ${message}${detailsStr ? ' | ' + detailsStr : ''}`);
}

function logError(message, error = null, details = {}) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
    const detailsStr = Object.entries(details)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
    
    console.error(`[${timestamp}] ERROR ${message}${detailsStr ? ' | ' + detailsStr : ''}`);
    if (error) {
        console.error(`[${timestamp}] ERROR Stack: ${error.stack || error.message}`);
    }
}

function logWarning(message, details = {}) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
    const detailsStr = Object.entries(details)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
    
    console.warn(`[${timestamp}] WARN  ${message}${detailsStr ? ' | ' + detailsStr : ''}`);
}

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    req.requestId = requestId;
    req.startTime = startTime;
    
    // Log incoming request
    logInfo('Incoming request', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        contentLength: req.get('Content-Length') || 0
    });
    
    // Override res.json to log responses
    const originalJson = res.json;
    res.json = function(data) {
        const duration = Date.now() - startTime;
        const username = req.user ? req.user.username : 'anonymous';
        
        if (res.statusCode >= 400) {
            logError('Request failed', null, {
                requestId,
                method: req.method,
                url: req.url,
                username,
                statusCode: res.statusCode,
                duration,
                responseData: data
            });
        } else {
            logInfo('Request completed', {
                requestId,
                method: req.method,
                url: req.url,
                username,
                statusCode: res.statusCode,
                duration
            });
        }
        
        return originalJson.call(this, data);
    };
    
    next();
});

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
                uploaded_file_path TEXT
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
    
    const block_sizes = ['4K', '8K', '16K', '32K', '64K', '128K']; // Text with uppercase suffix
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


app.get('/api/test-runs', requireAdmin, (req, res) => {
    logInfo('User requesting test runs list', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'LIST_TEST_RUNS'
    });
    
    db.all(`
        SELECT id, timestamp, drive_model, drive_type, test_name, 
               block_size, read_write_pattern, queue_depth, duration,
               fio_version, job_runtime, rwmixread, total_ios_read, 
               total_ios_write, usr_cpu, sys_cpu, hostname, protocol
        FROM test_runs
        ORDER BY timestamp DESC
    `, [], (err, rows) => {
        if (err) {
            logError('Database error fetching test runs', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'LIST_TEST_RUNS'
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        logInfo('Test runs list retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'LIST_TEST_RUNS',
            resultCount: rows.length
        });
        
        res.json(rows);
    });
});

app.get('/api/performance-data', requireAdmin, (req, res) => {
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
               tr.hostname, tr.protocol, tr.description,
               pm.metric_type, pm.value, pm.unit, pm.operation_type
        FROM test_runs tr
        JOIN performance_metrics pm ON tr.id = pm.test_run_id
        WHERE tr.id IN (${placeholders}) AND pm.metric_type IN (${metric_placeholders})
        ORDER BY tr.timestamp, pm.metric_type, pm.operation_type
    `;

    // Query for latency percentiles
    const percentileQuery = `
        SELECT test_run_id, operation_type, percentile, latency_ns
        FROM latency_percentiles
        WHERE test_run_id IN (${placeholders})
        ORDER BY test_run_id, operation_type, percentile
    `;

    db.all(query, [...run_ids, ...metrics], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Get latency percentiles
        db.all(percentileQuery, run_ids, (err, percentileRows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const data = {};
            
            // Process performance metrics
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
                        hostname: row.hostname,
                        protocol: row.protocol,
                        description: row.description,
                        metrics: {},
                        latency_percentiles: {}
                    };
                }
                
                // Group metrics by operation type
                const operation = row.operation_type || 'combined';
                if (!data[run_id].metrics[operation]) {
                    data[run_id].metrics[operation] = {};
                }
                
                data[run_id].metrics[operation][row.metric_type] = {
                    value: row.value,
                    unit: row.unit
                };
            }
            
            // Process latency percentiles
            for (const row of percentileRows) {
                const run_id = row.test_run_id;
                if (data[run_id]) {
                    const operation = row.operation_type;
                    if (!data[run_id].latency_percentiles[operation]) {
                        data[run_id].latency_percentiles[operation] = {};
                    }
                    
                    data[run_id].latency_percentiles[operation][`p${row.percentile}`] = {
                        value: row.latency_ns / 1000000, // Convert to milliseconds
                        unit: 'ms'
                    };
                }
            }
            
            // The frontend expects an array of objects, not an object with keys as ids
            const responseData = Object.values(data);
            res.json(responseData);
        });
    });
});

// Get filter options
app.get('/api/filters', requireAdmin, (req, res) => {
    const queries = [
        'SELECT DISTINCT drive_type FROM test_runs ORDER BY drive_type',
        'SELECT DISTINCT drive_model FROM test_runs ORDER BY drive_model', 
        'SELECT DISTINCT read_write_pattern FROM test_runs ORDER BY read_write_pattern',
        'SELECT DISTINCT block_size FROM test_runs ORDER BY block_size',
        'SELECT DISTINCT hostname FROM test_runs WHERE hostname IS NOT NULL ORDER BY hostname',
        'SELECT DISTINCT protocol FROM test_runs WHERE protocol IS NOT NULL ORDER BY protocol'
    ];

    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    )).then(([driveTypes, driveModels, patterns, blockSizes, hostnames, protocols]) => {
        res.json({
            drive_types: driveTypes.map(row => row.drive_type),
            drive_models: driveModels.map(row => row.drive_model),
            patterns: patterns.map(row => row.read_write_pattern),
            block_sizes: blockSizes.map(row => row.block_size),
            hostnames: hostnames.map(row => row.hostname),
            protocols: protocols.map(row => row.protocol)
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// Update test run endpoint
app.put('/api/test-runs/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { drive_model, drive_type, hostname, protocol } = req.body;
    
    if (!drive_model && !drive_type && !hostname && !protocol) {
        return res.status(400).json({ error: 'At least one field (drive_model, drive_type, hostname, or protocol) is required' });
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
    
    if (hostname) {
        updates.push('hostname = ?');
        values.push(hostname);
    }
    
    if (protocol) {
        updates.push('protocol = ?');
        values.push(protocol);
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

// DELETE endpoint for test runs
app.delete('/api/test-runs/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    logInfo('User attempting to delete test run', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'DELETE_TEST_RUN',
        testRunId: id
    });
    
    // Start a transaction to delete from both tables
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // First delete related performance metrics
        db.run('DELETE FROM performance_metrics WHERE test_run_id = ?', [parseInt(id)], function(err) {
            if (err) {
                db.run('ROLLBACK');
                logError('Failed to delete performance metrics', err, {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'DELETE_TEST_RUN',
                    testRunId: id
                });
                return res.status(500).json({ error: err.message });
            }
            
            // Then delete the test run
            db.run('DELETE FROM test_runs WHERE id = ?', [parseInt(id)], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    logError('Failed to delete test run', err, {
                        requestId: req.requestId,
                        username: req.user.username,
                        action: 'DELETE_TEST_RUN',
                        testRunId: id
                    });
                    return res.status(500).json({ error: err.message });
                }
                
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    logWarning('Test run not found for deletion', {
                        requestId: req.requestId,
                        username: req.user.username,
                        action: 'DELETE_TEST_RUN',
                        testRunId: id
                    });
                    return res.status(404).json({ error: 'Test run not found' });
                }
                
                db.run('COMMIT');
                logInfo('Test run deleted successfully', {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'DELETE_TEST_RUN',
                    testRunId: id,
                    deletedRecords: this.changes
                });
                res.json({ message: 'Test run deleted successfully', changes: this.changes });
            });
        });
    });
});

// FIO JSON import endpoint
app.post('/api/import', requireAuth, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fioData = JSON.parse(req.file.buffer.toString());
        const { 
            drive_model = 'Unknown', 
            drive_type = 'Unknown',
            hostname = 'Unknown',
            protocol = 'Unknown', 
            description = 'Imported FIO test',
            date = ''
        } = req.body;

        // Create a structured directory path
        const testDate = date ? new Date(date) : new Date();
        const datePart = testDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const timePart = testDate.getTime(); // Milliseconds timestamp
        const safeHostname = hostname.replace(/[^a-zA-Z0-9-_]/g, '_');
        
        const uploadPath = path.join(__dirname, 'uploads', safeHostname, datePart, timePart.toString());
        
        // Ensure the directory exists
        fs.mkdirSync(uploadPath, { recursive: true });

        // Define file paths
        const jsonFilePath = path.join(uploadPath, 'fio_results.json');
        const infoFilePath = path.join(uploadPath, 'upload.info');
        
        // Save the uploaded JSON file
        fs.writeFileSync(jsonFilePath, req.file.buffer);
        
        // Create and save the .info file
        const infoContent = `drive_model: ${drive_model}
drive_type: ${drive_type}
hostname: ${hostname}
protocol: ${protocol}
description: ${description}
upload_timestamp: ${new Date().toISOString()}
test_date: ${testDate.toISOString()}
original_filename: ${req.file.originalname}
`;
        fs.writeFileSync(infoFilePath, infoContent);

        const relativeFilePath = path.relative(path.join(__dirname, 'uploads'), jsonFilePath);

        // Process all jobs from FIO output
        const jobs = fioData.jobs;
        if (!jobs || jobs.length === 0) {
            return res.status(400).json({ error: 'No job data found in FIO output' });
        }

        const globalOpts = fioData['global options'] || {};
        const importedTestRuns = [];
        let completedJobs = 0;

        // Process each job
        jobs.forEach((job, jobIndex) => {
            // Skip jobs with errors or no valid data
            if (job.error && job.error !== 0) {
                completedJobs++;
                if (completedJobs === jobs.length) {
                    res.json({ 
                        message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                        test_run_ids: importedTestRuns,
                        skipped_jobs: jobs.length - importedTestRuns.length
                    });
                }
                return;
            }

            const opts = job['job options'] || {};

            // Extract test parameters
            const bs = opts.bs || globalOpts.bs || '4k';
            
            // Store block size as text with uppercase suffix
            const bsStr = bs.toString().toUpperCase();
            const block_size = bsStr;
            // If block size is a number, 
            const rw = opts.rw || globalOpts.rw || 'read';
            const iodepth = parseInt(opts.iodepth || globalOpts.iodepth || '1');
            const duration = job.runtime || parseInt(globalOpts.runtime || '0');
            const test_name = job.jobname || `fio_job_${jobIndex + 1}`;
            const rwmixread = parseInt(opts.rwmixread || '100');

            // Insert test run
            const insertTestRun = `
                INSERT INTO test_runs 
                (timestamp, test_date, drive_model, drive_type, test_name, block_size, 
                 read_write_pattern, queue_depth, duration, fio_version, 
                 job_runtime, rwmixread, total_ios_read, total_ios_write, 
                 usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(insertTestRun, [
                new Date().toISOString(),
                testDate.toISOString(),
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
                job.sys_cpu,
                hostname,
                protocol,
                description,
                relativeFilePath
            ], function(err) {
                if (err) {
                    console.error(`Error importing job ${test_name}:`, err.message);
                    completedJobs++;
                    if (completedJobs === jobs.length) {
                        res.json({ 
                            message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                            test_run_ids: importedTestRuns,
                            skipped_jobs: jobs.length - importedTestRuns.length
                        });
                    }
                    return;
                }

                const testRunId = this.lastID;
                importedTestRuns.push(testRunId);

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

                completedJobs++;
                if (completedJobs === jobs.length) {
                    res.json({ 
                        message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                        test_run_ids: importedTestRuns,
                        skipped_jobs: jobs.length - importedTestRuns.length
                    });
                }
            });
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

// Clear database endpoint (for development/testing)
app.delete('/api/clear-database', requireAdmin, (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Delete all data from tables in proper order (child tables first)
        db.run('DELETE FROM latency_percentiles', (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to clear latency_percentiles: ' + err.message });
            }
            
            db.run('DELETE FROM performance_metrics', (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to clear performance_metrics: ' + err.message });
                }
                
                db.run('DELETE FROM test_runs', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to clear test_runs: ' + err.message });
                    }
                    
                    // Reset auto-increment counters
                    db.run('DELETE FROM sqlite_sequence WHERE name IN ("test_runs", "performance_metrics", "latency_percentiles")', (err) => {
                        if (err) {
                            console.warn('Could not reset auto-increment counters:', err.message);
                        }
                        
                        db.run('COMMIT');
                        res.json({ 
                            message: 'Database cleared successfully',
                            tables_cleared: ['test_runs', 'performance_metrics', 'latency_percentiles']
                        });
                    });
                });
            });
        });
    });
});

// Server startup
app.listen(port, () => {
    logInfo('FIO Analyzer Backend Server started', {
        port,
        nodeVersion: process.version,
        platform: process.platform,
        processId: process.pid,
        environment: process.env.NODE_ENV || 'development'
    });
    console.log(`Server running at http://localhost:${port}`);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
    logInfo('Received SIGINT, shutting down gracefully');
    db.close((err) => {
        if (err) {
            logError('Error closing database', err);
        } else {
            logInfo('Database connection closed');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    logInfo('Received SIGTERM, shutting down gracefully');
    db.close((err) => {
        if (err) {
            logError('Error closing database', err);
        } else {
            logInfo('Database connection closed');
        }
        process.exit(0);
    });
});

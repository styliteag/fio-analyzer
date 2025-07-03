const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');
const bcrypt = require('bcryptjs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

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

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FIO Analyzer API',
            version: '1.0.0',
            description: 'A comprehensive API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring',
            contact: {
                name: 'FIO Analyzer',
                url: 'https://github.com/fio-analyzer'
            }
        },
        servers: [
            {
                url: '/',
                description: '/ On the server'
            },
            {
                url: '.',
                description: 'Current server (relative URL)'
            },
            {
                url: 'http://localhost:8000',
                description: 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                basicAuth: {
                    type: 'http',
                    scheme: 'basic',
                    description: 'Admin or uploader credentials'
                }
            },
            schemas: {
                TestRun: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'Unique test run ID' },
                        timestamp: { type: 'string', format: 'date-time', description: 'Test execution timestamp' },
                        hostname: { type: 'string', description: 'Server hostname' },
                        protocol: { type: 'string', description: 'Storage protocol (e.g., NVMe, SATA)' },
                        drive_model: { type: 'string', description: 'Storage device model' },
                        drive_type: { type: 'string', description: 'Storage device type' },
                        test_name: { type: 'string', description: 'Test configuration name' },
                        block_size: { type: 'string', description: 'I/O block size' },
                        read_write_pattern: { type: 'string', description: 'Test pattern (read, write, randread, etc.)' },
                        queue_depth: { type: 'integer', description: 'I/O queue depth' },
                        description: { type: 'string', description: 'Test description' }
                    }
                },
                PerformanceMetric: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'Metric ID' },
                        test_run_id: { type: 'integer', description: 'Associated test run ID' },
                        metric_type: { type: 'string', description: 'Metric type (iops, avg_latency, bandwidth)' },
                        value: { type: 'number', description: 'Metric value' },
                        unit: { type: 'string', description: 'Measurement unit' },
                        operation_type: { type: 'string', description: 'Operation type (read, write, combined)' }
                    }
                },
                ServerInfo: {
                    type: 'object',
                    properties: {
                        hostname: { type: 'string', description: 'Server hostname' },
                        protocol: { type: 'string', description: 'Storage protocol' },
                        drive_model: { type: 'string', description: 'Drive model' },
                        test_count: { type: 'integer', description: 'Total number of tests' },
                        last_test_time: { type: 'string', format: 'date-time', description: 'Most recent test timestamp' },
                        first_test_time: { type: 'string', format: 'date-time', description: 'First test timestamp' }
                    }
                },
                TrendData: {
                    type: 'object',
                    properties: {
                        timestamp: { type: 'string', format: 'date-time', description: 'Test timestamp' },
                        block_size: { type: 'string', description: 'Block size' },
                        read_write_pattern: { type: 'string', description: 'Test pattern' },
                        queue_depth: { type: 'integer', description: 'Queue depth' },
                        value: { type: 'number', description: 'Metric value' },
                        unit: { type: 'string', description: 'Unit of measurement' },
                        moving_avg: { type: 'number', description: '3-point moving average' },
                        percent_change: { type: 'string', description: 'Percentage change from previous value' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', description: 'Error message' }
                    }
                }
            }
        },
        security: [
            {
                basicAuth: []
            }
        ]
    },
    apis: ['./index.js'] // Path to the API docs
};

// Dynamic Swagger setup that adapts to the current host
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res) => {
    // Generate dynamic server URL based on the request
    const hostHeader = req.get('Host');
    const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
    const currentServerUrl = `${protocol}://${hostHeader}`;
    
    // Clone the swagger options and update servers
    const dynamicSwaggerOptions = {
        ...swaggerOptions,
        definition: {
            ...swaggerOptions.definition,
            servers: [
                {
                    url: currentServerUrl,
                    description: 'Current server'
                },
                {
                    url: 'http://localhost:8000',
                    description: 'Development server'
                },
                {
                    url: '/',
                    description: 'Relative URL'
                }
            ]
        }
    };
    
    const dynamicSwaggerSpecs = swaggerJsdoc(dynamicSwaggerOptions);
    
    const swaggerUiAssets = swaggerUi.generateHTML(dynamicSwaggerSpecs, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'FIO Analyzer API Documentation'
    });
    
    res.send(swaggerUiAssets);
});

// Serve Swagger JSON
app.get('/api-docs/swagger.json', (req, res) => {
    // Generate dynamic server URL based on the request
    const hostHeader = req.get('Host');
    const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
    const currentServerUrl = `${protocol}://${hostHeader}`;
    
    // Clone the swagger options and update servers
    const dynamicSwaggerOptions = {
        ...swaggerOptions,
        definition: {
            ...swaggerOptions.definition,
            servers: [
                {
                    url: currentServerUrl,
                    description: 'Current server'
                },
                {
                    url: 'http://localhost:8000',
                    description: 'Development server'
                },
                {
                    url: '/',
                    description: 'relative URL'
                }
            ]
        }
    };
    
    const dynamicSwaggerSpecs = swaggerJsdoc(dynamicSwaggerOptions);
    res.json(dynamicSwaggerSpecs);
});

/**
 * @swagger
 * /api/info:
 *   get:
 *     summary: Get API information
 *     description: Retrieve basic information about the API including available endpoints and documentation links
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   description: API name
 *                   example: "FIO Analyzer API"
 *                 version:
 *                   type: string
 *                   description: API version
 *                   example: "1.0.0"
 *                 description:
 *                   type: string
 *                   description: API description
 *                 documentation:
 *                   type: object
 *                   properties:
 *                     swagger_ui:
 *                       type: string
 *                       description: Swagger UI endpoint
 *                       example: "/api-docs"
 *                     swagger_json:
 *                       type: string
 *                       description: Swagger JSON endpoint
 *                 endpoints:
 *                   type: object
 *                   description: Available API endpoints
 *                 authentication:
 *                   type: string
 *                   description: Authentication information
 *                 status:
 *                   type: string
 *                   description: API status
 *                   example: "running"
 */
// API documentation info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'FIO Analyzer API',
        version: '1.0.0',
        description: 'FIO performance analysis and time-series monitoring API',
        documentation: {
            swagger_ui: '/api-docs',
            swagger_json: '/api-docs/swagger.json'
        },
        endpoints: {
            test_runs: '/api/test-runs',
            performance_data: '/api/test-runs/performance-data',
            time_series: {
                servers: '/api/time-series/servers',
                latest: '/api/time-series/latest',
                history: '/api/time-series/history',
                trends: '/api/time-series/trends'
            }
        },
        authentication: 'Basic Auth (admin/admin for development)',
        status: 'running'
    });
});

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

        // Create table to store all job options
        db.run(`
            CREATE TABLE IF NOT EXISTS job_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                option_name TEXT NOT NULL,
                option_value TEXT,
                FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
            )
        `);

        // Add index for job options queries
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_job_options_test_run 
            ON job_options (test_run_id, option_name)
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
                    showServerReady();
                });
            } else {
                showServerReady();
            }
        });
    });
}

function showServerReady() {
    console.log('\n🚀 Server running at http://localhost:' + port);
    console.log('📊 FIO Analyzer Backend is ready to accept requests!');
    console.log('💡 Default admin credentials: admin/admin\n');
}

function populateSampleData(callback) {
    const drives = [
        ["Samsung 980 PRO", "NVMe SSD"],
        ["WD Black SN850", "NVMe SSD"],
        ["Crucial MX500", "SATA SSD"],
        ["Seagate Barracuda", "HDD"],
        ["Intel Optane", "NVMe SSD"]
    ];
    
    const block_sizes = ['512', '1K', '4K', '8K', '16K', '32K', '64K', '128K', '1M', '2G']; // Text with uppercase suffix
    const patterns = ["sequential_read", "sequential_write", "random_read", "random_write", "mixed_70_30"];
    const queue_depths = [1, 4, 8, 16, 32];
    
    let testRunId = 1;

    const testRunsStmt = db.prepare('INSERT INTO test_runs (timestamp, test_date, drive_model, drive_type, test_name, block_size, read_write_pattern, queue_depth, duration, fio_version, job_runtime, rwmixread, total_ios_read, total_ios_write, usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const metricsStmt = db.prepare('INSERT INTO performance_metrics (test_run_id, metric_type, value, unit, operation_type) VALUES (?, ?, ?, ?, ?)');
    const percentilesStmt = db.prepare('INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns) VALUES (?, ?, ?, ?)');

    db.serialize(() => {
        for (const [drive_model, drive_type] of drives) {
            console.log(`Processing drive: ${drive_model} (${drive_type})`);
            for (let i = 0; i < 3; i++) { // Reduced from 10 to 3 iterations
                const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
                
                const sampleBlockSizes = [...block_sizes].sort(() => 0.5 - Math.random()).slice(0, 2); // Reduced from 3 to 2
                for (const block_size of sampleBlockSizes) {
                    const samplePatterns = [...patterns].sort(() => 0.5 - Math.random()).slice(0, 2);
                    for (const pattern of samplePatterns) {
                        const queue_depth = queue_depths[Math.floor(Math.random() * queue_depths.length)];
                        
                        const test_name = `FIO_${pattern}_${block_size}`;
                        console.log(`  Creating: ${test_name} (${drive_model}, ${block_size}, QD${queue_depth})`);
                        // Define testDate as a Date object based on timestamp
                        const testDate = new Date(timestamp);
                        testRunsStmt.run(
                            timestamp,
                            testDate.toISOString(),
                            drive_model,
                            drive_type,
                            test_name,
                            block_size,
                            pattern,
                            queue_depth,
                            300,
                            'fio-3.40',
                            300,
                            100,
                            Math.floor(Math.random() * 1000000),
                            Math.floor(Math.random() * 1000000),
                            Math.random() * 100,
                            Math.random() * 100,
                            'test-data',
                            'generated',
                            function(err) {
                                if (!err) {
                                    // Generate job options similar to FIO import
                                    const jobOpts = {
                                        bs: block_size,
                                        rw: pattern,
                                        iodepth: queue_depth,
                                        size: '1G',
                                        numjobs: '1',
                                        direct: '1',
                                        sync: '1',
                                        group_reporting: '',
                                        time_based: '',
                                        runtime: '300',
                                        filename: `/tmp/fio_test/fio_test_${pattern}_${block_size}`,
                                        ioengine: 'psync',
                                        norandommap: '',
                                        randrepeat: '0',
                                        thread: ''
                                    };
                                    insertJobOptions(this.lastID, jobOpts, {});
                                }
                            }
                        );
                        
                        const base_iops = getBaseIops(drive_type, pattern, block_size);
                        const base_latency = getBaseLatency(drive_type, pattern);
                        const base_bandwidth = getBaseBandwidth(drive_type, pattern, block_size);
                        
                        const iops = base_iops * (0.8 + Math.random() * 0.4);
                        const latency = base_latency * (0.7 + Math.random() * 0.6);
                        const bandwidth = base_bandwidth * (0.85 + Math.random() * 0.3);
                        
                        // Store core metrics with 'combined' operation type to match FIO import structure
                        const metrics = [
                            [testRunId, "iops", iops, "IOPS", "combined"],
                            [testRunId, "avg_latency", latency, "ms", "combined"],
                            [testRunId, "bandwidth", bandwidth, "MB/s", "combined"]
                        ];
                        
                        for (const metric of metrics) {
                            metricsStmt.run(metric);
                        }
                        
                        // Store percentiles in latency_percentiles table like FIO import
                        const p95_latency_ns = latency * 1.5 * 1000000; // Convert ms to ns
                        const p99_latency_ns = latency * 2.2 * 1000000; // Convert ms to ns
                        
                        const percentiles = [
                            [testRunId, "combined", 95.0, p95_latency_ns],
                            [testRunId, "combined", 99.0, p99_latency_ns]
                        ];
                        
                        for (const percentile of percentiles) {
                            percentilesStmt.run(percentile);
                        }
                        
                        testRunId++;
                    }
                }
            }
        }
        testRunsStmt.finalize();
        metricsStmt.finalize();
        percentilesStmt.finalize();
        console.log('Sample data population completed!');
        if (callback) callback();
    });
}

// Helper function to convert text block size back to numeric KB for calculations
function parseBlockSizeToKB(blockSizeText) {
    const bsStr = blockSizeText.toString().toLowerCase();
    if (bsStr.includes('g')) {
        return parseInt(bsStr.replace('g', '')) * 1024 * 1024; // GB to KB
    } else if (bsStr.includes('m')) {
        return parseInt(bsStr.replace('m', '')) * 1024; // MB to KB
    } else if (bsStr.includes('k')) {
        return parseInt(bsStr.replace('k', '')); // Already in KB
    } else {
        // Plain number, assume bytes and convert to KB
        return Math.max(1, Math.round(parseInt(bsStr) / 1024));
    }
}

function getBaseIops(drive_type, pattern, block_size) {
    const base_values = {
        "NVMe SSD": {"sequential": 100000, "random": 50000},
        "SATA SSD": {"sequential": 50000, "random": 25000},
        "HDD": {"sequential": 200, "random": 100}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    const base = base_values[drive_type][pattern_type];
    
    // Convert text block size to numeric KB value for calculation
    const blockSizeKB = parseBlockSizeToKB(block_size);
    return base * Math.pow(64 / blockSizeKB, 0.5);
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

function getBaseBandwidth(drive_type, pattern, block_size) {
    const base_values = {
        "NVMe SSD": {"sequential": 3500, "random": 2000},
        "SATA SSD": {"sequential": 550, "random": 400},
        "HDD": {"sequential": 150, "random": 80}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    const base = base_values[drive_type][pattern_type];
    
    // Convert text block size to numeric KB value for calculation
    const blockSizeKB = parseBlockSizeToKB(block_size);
    return base * Math.pow(blockSizeKB / 64, 0.3);
}


/**
 * @swagger
 * /api/test-runs:
 *   get:
 *     summary: Get all test runs
 *     description: Retrieve a list of all FIO test runs with their metadata
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: List of test runs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TestRun'
 *       401:
 *         description: Unauthorized - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/filters:
 *   get:
 *     summary: Get filter options
 *     description: Retrieve all available filter options for test runs (drive types, models, patterns, etc.)
 *     tags: [Filters]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Filter options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 drive_types:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available drive types
 *                   example: ["NVMe SSD", "SATA SSD", "HDD"]
 *                 drive_models:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available drive models
 *                   example: ["Samsung_980_PRO", "WD Black SN850"]
 *                 patterns:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available test patterns
 *                   example: ["randread", "randwrite", "read", "write"]
 *                 block_sizes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available block sizes
 *                   example: ["4K", "64K", "1M"]
 *                 hostnames:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available hostnames
 *                   example: ["test-server-01", "test-data"]
 *                 protocols:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available protocols
 *                   example: ["NVMe", "SATA", "generated"]
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
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
        // Normalize block sizes to ensure consistent string format
        const normalizedBlockSizes = blockSizes.map(row => {
            const blockSize = row.block_size;
            if (typeof blockSize === 'number') {
                // Convert numeric values to proper format
                if (blockSize >= 1024 * 1024 * 1024) {
                    return `${Math.round(blockSize / (1024 * 1024 * 1024))}G`;
                } else if (blockSize >= 1024 * 1024) {
                    return `${Math.round(blockSize / (1024 * 1024))}M`;
                } else if (blockSize >= 1024) {
                    return `${Math.round(blockSize / 1024)}K`;
                } else {
                    return `${blockSize}`;
                }
            }
            return blockSize; // Already a string
        });

        res.json({
            drive_types: driveTypes.map(row => row.drive_type),
            drive_models: driveModels.map(row => row.drive_model),
            patterns: patterns.map(row => row.read_write_pattern),
            block_sizes: normalizedBlockSizes,
            hostnames: hostnames.map(row => row.hostname),
            protocols: protocols.map(row => row.protocol)
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

/**
 * @swagger
 * /api/test-runs/{id}:
 *   put:
 *     summary: Update test run metadata
 *     description: Update metadata fields for a specific test run
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test run ID
 *         example: 61
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               drive_model:
 *                 type: string
 *                 description: Drive model name
 *                 example: "Samsung_980_PRO"
 *               drive_type:
 *                 type: string
 *                 description: Drive type
 *                 example: "NVMe SSD"
 *               hostname:
 *                 type: string
 *                 description: Server hostname
 *                 example: "test-server-01"
 *               protocol:
 *                 type: string
 *                 description: Storage protocol
 *                 example: "NVMe"
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: Test run updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Test run updated successfully"
 *                 changes:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: Bad request - At least one field is required
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Test run not found
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/test-runs/{id}:
 *   delete:
 *     summary: Delete test run
 *     description: Delete a test run and all associated performance metrics
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test run ID to delete
 *         example: 61
 *     responses:
 *       200:
 *         description: Test run deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Test run and associated metrics deleted successfully"
 *                 deleted_test_runs:
 *                   type: integer
 *                   example: 1
 *                 deleted_metrics:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Test run not found
 *       500:
 *         description: Internal server error
 */
app.delete('/api/test-runs/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    logInfo('User attempting to delete test run', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'DELETE_TEST_RUN',
        testRunId: id
    });
    
    // Start a transaction to delete from all related tables
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // First delete related job options
        db.run('DELETE FROM job_options WHERE test_run_id = ?', [parseInt(id)], function(err) {
            if (err) {
                db.run('ROLLBACK');
                logError('Failed to delete job options', err, {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'DELETE_TEST_RUN',
                    testRunId: id
                });
                return res.status(500).json({ error: err.message });
            }
            
            // Then delete related latency percentiles
            db.run('DELETE FROM latency_percentiles WHERE test_run_id = ?', [parseInt(id)], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    logError('Failed to delete latency percentiles', err, {
                        requestId: req.requestId,
                        username: req.user.username,
                        action: 'DELETE_TEST_RUN',
                        testRunId: id
                    });
                    return res.status(500).json({ error: err.message });
                }
                
                // Then delete related performance metrics
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
                    
                    // Finally delete the test run
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
    });
});

/**
 * @swagger
 * /api/import:
 *   post:
 *     summary: Import FIO test results
 *     description: Upload and import FIO JSON test results with metadata
 *     tags: [Import]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: FIO JSON output file
 *               drive_model:
 *                 type: string
 *                 description: Storage device model
 *                 example: "Samsung_980_PRO"
 *               drive_type:
 *                 type: string
 *                 description: Storage device type
 *                 example: "NVMe SSD"
 *               hostname:
 *                 type: string
 *                 description: Server hostname
 *                 example: "test-server-01"
 *               protocol:
 *                 type: string
 *                 description: Storage protocol
 *                 example: "NVMe"
 *               description:
 *                 type: string
 *                 description: Test description
 *                 example: "Automated hourly test"
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Test execution date
 *             required:
 *               - file
 *     responses:
 *       200:
 *         description: FIO results imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "FIO results imported successfully. Processed 4 out of 4 jobs."
 *                 test_run_ids:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [61, 62, 63, 64]
 *                 skipped_jobs:
 *                   type: integer
 *                   example: 0
 *       400:
 *         description: Bad request - File or invalid FIO format
 *       401:
 *         description: Unauthorized - Admin or uploader access required
 *       500:
 *         description: Internal server error
 */
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

                // Store all job options
                insertJobOptions(testRunId, opts, globalOpts);

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
        [testRunId, 'bandwidth', data.bw / 1024, 'MB/s', operationType],
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

function insertJobOptions(testRunId, jobOpts, globalOpts) {
    const stmt = db.prepare('INSERT INTO job_options (test_run_id, option_name, option_value) VALUES (?, ?, ?)');
    
    // Store job-specific options
    for (const [optionName, optionValue] of Object.entries(jobOpts)) {
        // Skip the jobname as it's already stored in test_name
        if (optionName === 'name') continue;
        
        // Convert value to string for storage
        const valueStr = optionValue !== null && optionValue !== undefined ? String(optionValue) : null;
        stmt.run([testRunId, optionName, valueStr]);
    }
    
    // Store global options with a prefix to distinguish them
    for (const [optionName, optionValue] of Object.entries(globalOpts)) {
        // Convert value to string for storage
        const valueStr = optionValue !== null && optionValue !== undefined ? String(optionValue) : null;
        stmt.run([testRunId, `global_${optionName}`, valueStr]);
    }
    
    stmt.finalize();
}

/**
 * @swagger
 * /api/test-runs/job-options:
 *   get:
 *     summary: Get job options for multiple test runs
 *     description: Retrieve job options (both job-specific and global) for multiple test runs
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: test_run_ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of test run IDs
 *         example: "61,62,63,64"
 *     responses:
 *       200:
 *         description: Job options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   test_run_id:
 *                     type: integer
 *                     example: 61
 *                   job_options:
 *                     type: object
 *                     description: Job-specific options
 *                     example: {"bs": "4k", "rw": "randread", "iodepth": "1", "size": "50M"}
 *                   global_options:
 *                     type: object
 *                     description: Global options
 *                     example: {"runtime": "10", "time_based": ""}
 *       400:
 *         description: Bad request - test_run_ids is required
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.get('/api/test-runs/job-options', requireAdmin, (req, res) => {
    const { test_run_ids } = req.query;

    if (!test_run_ids) {
        return res.status(400).json({ error: "test_run_ids is required" });
    }

    const run_ids = test_run_ids.split(',').map(id => parseInt(id.trim()));
    const placeholders = run_ids.map(() => '?').join(',');

    const query = `
        SELECT test_run_id, option_name, option_value
        FROM job_options
        WHERE test_run_id IN (${placeholders})
        ORDER BY test_run_id, option_name
    `;

    db.all(query, run_ids, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const data = {};
        
        // Process job options
        for (const row of rows) {
            const run_id = row.test_run_id;
            if (!data[run_id]) {
                data[run_id] = {
                    test_run_id: run_id,
                    job_options: {},
                    global_options: {}
                };
            }
            
            if (row.option_name.startsWith('global_')) {
                const globalOptionName = row.option_name.substring(7); // Remove 'global_' prefix
                data[run_id].global_options[globalOptionName] = row.option_value;
            } else {
                data[run_id].job_options[row.option_name] = row.option_value;
            }
        }
        
        // Convert to array format to match performance-data pattern
        const responseData = Object.values(data);
        res.json(responseData);
    });
});

/**
 * @swagger
 * /api/test-runs/{id}/job-options:
 *   get:
 *     summary: Get job options for a test run
 *     description: Retrieve all job options (both job-specific and global) for a specific test run
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test run ID
 *         example: 61
 *     responses:
 *       200:
 *         description: Job options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 test_run_id:
 *                   type: integer
 *                   example: 61
 *                 job_options:
 *                   type: object
 *                   description: Job-specific options
 *                   example: {"bs": "4k", "rw": "randread", "iodepth": "1", "size": "50M"}
 *                 global_options:
 *                   type: object
 *                   description: Global options
 *                   example: {"runtime": "10", "time_based": ""}
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Test run not found
 *       500:
 *         description: Internal server error
 */
app.get('/api/test-runs/:id/job-options', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    logInfo('User requesting job options for test run', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_JOB_OPTIONS',
        testRunId: id
    });
    
    db.all(`
        SELECT option_name, option_value
        FROM job_options
        WHERE test_run_id = ?
        ORDER BY option_name
    `, [parseInt(id)], (err, rows) => {
        if (err) {
            logError('Database error fetching job options', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_JOB_OPTIONS',
                testRunId: id
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (rows.length === 0) {
            logWarning('No job options found for test run', {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_JOB_OPTIONS',
                testRunId: id
            });
            return res.status(404).json({ error: 'Test run not found or no job options available' });
        }
        
        // Separate job options and global options
        const jobOptions = {};
        const globalOptions = {};
        
        for (const row of rows) {
            if (row.option_name.startsWith('global_')) {
                const globalOptionName = row.option_name.substring(7); // Remove 'global_' prefix
                globalOptions[globalOptionName] = row.option_value;
            } else {
                jobOptions[row.option_name] = row.option_value;
            }
        }
        
        logInfo('Job options retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_JOB_OPTIONS',
            testRunId: id,
            jobOptionsCount: Object.keys(jobOptions).length,
            globalOptionsCount: Object.keys(globalOptions).length
        });
        
        res.json({
            test_run_id: parseInt(id),
            job_options: jobOptions,
            global_options: globalOptions
        });
    });
});

/**
 * @swagger
 * /api/clear-database:
 *   delete:
 *     summary: Clear all database data
 *     description: Delete all test runs and performance metrics (for development/testing only)
 *     tags: [Admin]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Database cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Database cleared successfully"
 *                 deleted_test_runs:
 *                   type: integer
 *                   example: 91
 *                 deleted_metrics:
 *                   type: integer
 *                   example: 455
 *                 deleted_latency_percentiles:
 *                   type: integer
 *                   example: 273
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.delete('/api/clear-database', requireAdmin, (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Delete all data from tables in proper order (child tables first)
        db.run('DELETE FROM job_options', (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to clear job_options: ' + err.message });
            }
            
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
                        db.run('DELETE FROM sqlite_sequence WHERE name IN ("test_runs", "performance_metrics", "latency_percentiles", "job_options")', (err) => {
                            if (err) {
                                console.warn('Could not reset auto-increment counters:', err.message);
                            }
                            
                            db.run('COMMIT');
                            res.json({ 
                                message: 'Database cleared successfully',
                                tables_cleared: ['test_runs', 'performance_metrics', 'latency_percentiles', 'job_options']
                            });
                        });
                    });
                });
            });
        });
    });
});

/**
 * @swagger
 * /script.sh:
 *   get:
 *     summary: Download FIO test script
 *     description: Download the automated FIO testing script with pre-configured backend URL
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: Script downloaded successfully
 *         content:
 *           application/x-sh:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Shell script for automated FIO testing
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="fio-analyzer-tests.sh"'
 *       500:
 *         description: Failed to generate script
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Serve FIO test script dynamically with correct backend URL and credentials
app.get('/script.sh', (req, res) => {
    const hostHeader = req.get('Host');
    const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
    const backendUrl = `${protocol}://${hostHeader}`;
    
    const fs = require('fs');
    const path = require('path');
    
    // Use local script path in development, Docker path in production
    let scriptPath;
    const productionPath = '/usr/share/nginx/html/fio-analyzer-tests.sh';
    const fallbackPath = path.join(__dirname, '..', 'scripts', 'fio-analyzer-tests.sh');
        
    // Check if production path exists, otherwise use fallback
    if (fs.existsSync(productionPath)) {
        scriptPath = productionPath;
    } else {
        scriptPath = fallbackPath;
    }
    
    try {
        let scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Replace placeholders in the script
        scriptContent = scriptContent.replace(
            /BACKEND_URL="\${BACKEND_URL:-[^}]*}"/g,
            `BACKEND_URL="\${BACKEND_URL:-${backendUrl}}"`
        );
                
        res.setHeader('Content-Type', 'application/x-sh');
        res.setHeader('Content-Disposition', 'attachment; filename="fio-analyzer-tests.sh"');
        res.send(scriptContent);
    } catch (error) {
        logError('Failed to read script template', error, {
            requestId: req.requestId,
            scriptPath
        });
        res.status(500).json({ error: 'Failed to generate script' });
    }
});

/**
 * @swagger
 * /env.example:
 *   get:
 *     summary: Download environment configuration template
 *     description: Download the .env.example template file with pre-configured backend URL for FIO testing script
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: Environment template downloaded successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               description: Environment configuration template
 *               example: |
 *                 HOSTNAME=test-server-01
 *                 PROTOCOL=NVMe
 *                 DRIVE_TYPE=NVMe SSD
 *                 BACKEND_URL=http://localhost:8000
 *                 USERNAME=admin
 *                 PASSWORD=admin
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename=".env.example"'
 *       500:
 *         description: Failed to read template file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/env.example', (req, res) => {
    const hostHeader = req.get('Host');
    const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
    const backendUrl = `${protocol}://${hostHeader}`;
    
    const fs = require('fs');
    const path = require('path');
    
    // Use local script path in development, Docker path in production
    let scriptPath;
    const productionPath = '/usr/share/nginx/html/.env.example';
    const fallbackPath = path.join(__dirname, '..', 'scripts', '.env.example');
        
    // Check if production path exists, otherwise use fallback
    if (fs.existsSync(productionPath)) {
        scriptPath = productionPath;
    } else {
        scriptPath = fallbackPath;
    }
    
    try {
        let scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Log the content for debugging
        logInfo('Read .env.example content', {
            requestId: req.requestId,
            scriptPath,
            contentLength: scriptContent.length,
            containsBackendUrl: scriptContent.includes('BACKEND_URL')
        });
        
        // Replace placeholders in the script
        // Replace BACKEND_URL=anything with BACKEND_URL=${backendUrl}
        scriptContent = scriptContent.replace(
            /BACKEND_URL="[^"]*"/g,
            `BACKEND_URL="${backendUrl}"`
        );
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename=".env.example"');
        res.send(scriptContent);
    } catch (error) {
        logError('Failed to read script template', error, {
            requestId: req.requestId,
            scriptPath
        });
        res.status(500).json({ error: 'Failed to generate .env.example' });
    }
});

// Time-series API endpoints for automated data collection and historical analysis

/**
 * @swagger
 * /api/time-series/servers:
 *   get:
 *     summary: Get all servers in time-series
 *     description: Retrieve a list of all servers (hostname+protocol combinations) with test statistics
 *     tags: [Time-Series]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: List of servers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ServerInfo'
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.get('/api/time-series/servers', requireAdmin, (req, res) => {
    logInfo('User requesting servers list for time-series', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'LIST_SERVERS'
    });
    
    db.all(`
        SELECT DISTINCT 
            hostname,
            protocol,
            drive_model,
            COUNT(*) as test_count,
            MAX(timestamp) as last_test_time,
            MIN(timestamp) as first_test_time
        FROM test_runs 
        WHERE hostname IS NOT NULL AND protocol IS NOT NULL
        GROUP BY hostname, protocol, drive_model
        ORDER BY hostname, protocol, drive_model
    `, [], (err, rows) => {
        if (err) {
            logError('Database error fetching servers list', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'LIST_SERVERS'
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        logInfo('Servers list retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'LIST_SERVERS',
            resultCount: rows.length
        });
        
        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/latest:
 *   get:
 *     summary: Get latest test results per server
 *     description: Retrieve the most recent test results for each server (hostname+protocol combination)
 *     tags: [Time-Series]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Latest test results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/TestRun'
 *                   - $ref: '#/components/schemas/PerformanceMetric'
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.get('/api/time-series/latest', requireAdmin, (req, res) => {
    logInfo('User requesting latest test results per server', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_LATEST_RESULTS'
    });
    
    const query = `
        SELECT 
            lts.id,
            lts.hostname,
            lts.protocol,
            lts.drive_model,
            lts.drive_type,
            lts.test_name,
            lts.block_size,
            lts.read_write_pattern,
            lts.queue_depth,
            lts.timestamp,
            lts.description,
            pm.metric_type,
            pm.value,
            pm.unit,
            pm.operation_type
        FROM latest_test_per_server lts
        LEFT JOIN performance_metrics pm ON lts.id = pm.test_run_id
        ORDER BY lts.hostname, lts.protocol, lts.drive_model, pm.metric_type, pm.operation_type
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            logError('Database error fetching latest results', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_LATEST_RESULTS'
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        logInfo('Latest results retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_LATEST_RESULTS',
            resultCount: rows.length
        });
        
        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/history:
 *   get:
 *     summary: Get historical performance data
 *     description: Retrieve historical test data for a specific server with optional time range filtering
 *     tags: [Time-Series]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: hostname
 *         required: true
 *         schema:
 *           type: string
 *         description: Server hostname
 *         example: test-server-01
 *       - in: query
 *         name: protocol
 *         required: true
 *         schema:
 *           type: string
 *         description: Storage protocol
 *         example: NVMe
 *       - in: query
 *         name: drive_model
 *         schema:
 *           type: string
 *         description: Specific drive model to filter by
 *         example: Samsung_980_PRO
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for time range filter
 *         example: 2025-07-03T10:00:00Z
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for time range filter
 *         example: 2025-07-03T18:00:00Z
 *       - in: query
 *         name: metric_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of metrics to retrieve
 *         example: iops,avg_latency,bandwidth
 *     responses:
 *       200:
 *         description: Historical data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/TestRun'
 *                   - $ref: '#/components/schemas/PerformanceMetric'
 *       400:
 *         description: Bad request - hostname and protocol are required
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.get('/api/time-series/history', requireAdmin, (req, res) => {
    const { hostname, protocol, drive_model, start_date, end_date, metric_types } = req.query;
    
    if (!hostname || !protocol) {
        return res.status(400).json({ error: "hostname and protocol are required" });
    }
    
    const metrics = (metric_types || "iops,avg_latency,bandwidth").split(',').map(m => m.trim());
    let whereConditions = ['tr.hostname = ?', 'tr.protocol = ?'];
    let queryParams = [hostname, protocol];
    
    if (drive_model) {
        whereConditions.push('tr.drive_model = ?');
        queryParams.push(drive_model);
    }
    
    if (start_date) {
        whereConditions.push('tr.timestamp >= ?');
        queryParams.push(start_date);
    }
    
    if (end_date) {
        whereConditions.push('tr.timestamp <= ?');
        queryParams.push(end_date);
    }
    
    const metric_placeholders = metrics.map(() => '?').join(',');
    queryParams.push(...metrics);
    
    const query = `
        SELECT 
            tr.id,
            tr.hostname,
            tr.protocol,
            tr.drive_model,
            tr.drive_type,
            tr.test_name,
            tr.block_size,
            tr.read_write_pattern,
            tr.queue_depth,
            tr.timestamp,
            tr.description,
            pm.metric_type,
            pm.value,
            pm.unit,
            pm.operation_type
        FROM test_runs tr
        LEFT JOIN performance_metrics pm ON tr.id = pm.test_run_id
        WHERE ${whereConditions.join(' AND ')} 
            AND (pm.metric_type IN (${metric_placeholders}) OR pm.metric_type IS NULL)
        ORDER BY tr.timestamp DESC, pm.metric_type, pm.operation_type
    `;
    
    logInfo('User requesting historical data', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_HISTORICAL_DATA',
        hostname,
        protocol,
        drive_model,
        start_date,
        end_date,
        metrics: metrics.join(',')
    });
    
    db.all(query, queryParams, (err, rows) => {
        if (err) {
            logError('Database error fetching historical data', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_HISTORICAL_DATA',
                hostname,
                protocol
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        logInfo('Historical data retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_HISTORICAL_DATA',
            hostname,
            protocol,
            resultCount: rows.length
        });
        
        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/trends:
 *   get:
 *     summary: Get performance trend analysis
 *     description: Retrieve trend analysis for specific metrics with moving averages and percentage changes
 *     tags: [Time-Series]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: hostname
 *         required: true
 *         schema:
 *           type: string
 *         description: Server hostname
 *         example: test-server-01
 *       - in: query
 *         name: protocol
 *         required: true
 *         schema:
 *           type: string
 *         description: Storage protocol
 *         example: NVMe
 *       - in: query
 *         name: drive_model
 *         schema:
 *           type: string
 *         description: Specific drive model to filter by
 *         example: Samsung_980_PRO
 *       - in: query
 *         name: metric_type
 *         schema:
 *           type: string
 *           default: iops
 *         description: Performance metric to analyze
 *         example: iops
 *       - in: query
 *         name: operation_type
 *         schema:
 *           type: string
 *           default: combined
 *         description: Operation type to analyze
 *         example: read
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back
 *         example: 7
 *     responses:
 *       200:
 *         description: Trend analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrendData'
 *       400:
 *         description: Bad request - hostname and protocol are required
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.get('/api/time-series/trends', requireAdmin, (req, res) => {
    const { hostname, protocol, drive_model, metric_type = 'iops', operation_type = 'combined', days = 30 } = req.query;
    
    if (!hostname || !protocol) {
        return res.status(400).json({ error: "hostname and protocol are required" });
    }
    
    let whereConditions = ['tr.hostname = ?', 'tr.protocol = ?', 'pm.metric_type = ?', 'pm.operation_type = ?'];
    let queryParams = [hostname, protocol, metric_type, operation_type];
    
    if (drive_model) {
        whereConditions.push('tr.drive_model = ?');
        queryParams.push(drive_model);
    }
    
    // Add date filter for specified number of days
    whereConditions.push('tr.timestamp >= datetime("now", "-" || ? || " days")');
    queryParams.push(parseInt(days));
    
    const query = `
        SELECT 
            tr.timestamp,
            tr.block_size,
            tr.read_write_pattern,
            tr.queue_depth,
            pm.value,
            pm.unit,
            -- Calculate moving average
            AVG(pm.value) OVER (
                ORDER BY tr.timestamp 
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ) as moving_avg,
            -- Calculate percentage change from previous value
            LAG(pm.value) OVER (ORDER BY tr.timestamp) as prev_value
        FROM test_runs tr
        JOIN performance_metrics pm ON tr.id = pm.test_run_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY tr.timestamp ASC
    `;
    
    logInfo('User requesting trend analysis', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_TREND_ANALYSIS',
        hostname,
        protocol,
        metric_type,
        operation_type,
        days
    });
    
    db.all(query, queryParams, (err, rows) => {
        if (err) {
            logError('Database error fetching trend analysis', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_TREND_ANALYSIS',
                hostname,
                protocol
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Calculate percentage changes
        const results = rows.map((row, index) => {
            const percentChange = row.prev_value ? 
                ((row.value - row.prev_value) / row.prev_value * 100).toFixed(2) : null;
            
            return {
                ...row,
                percent_change: percentChange
            };
        });
        
        logInfo('Trend analysis retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_TREND_ANALYSIS',
            hostname,
            protocol,
            resultCount: results.length
        });
        
        res.json(results);
    });
});

// Start server but don't show "ready" message until database is initialized
app.listen(port, () => {
    logInfo('FIO Analyzer Backend Server started', {
        port,
        nodeVersion: process.version,
        platform: process.platform,
        processId: process.pid,
        environment: process.env.NODE_ENV || 'development'
    });
    // "Server running" message will be shown after database initialization
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

/**
 * @swagger
 * /api/test-runs/performance-data:
 *   get:
 *     summary: Get performance metrics for test runs
 *     description: Retrieve performance metrics and latency percentiles for specific test runs
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: test_run_ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of test run IDs
 *         example: "61,62,63,64"
 *       - in: query
 *         name: metric_types
 *         schema:
 *           type: string
 *           default: "iops,avg_latency,bandwidth"
 *         description: Comma-separated list of metric types to retrieve
 *         example: "iops,avg_latency,bandwidth"
 *     responses:
 *       200:
 *         description: Performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/TestRun'
 *                   - $ref: '#/components/schemas/PerformanceMetric'
 *       400:
 *         description: Bad request - test_run_ids is required
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
app.get('/api/test-runs/performance-data', requireAdmin, (req, res) => {
    const { test_run_ids, metric_types } = req.query;

    if (!test_run_ids) {
        return res.status(400).json({ error: "test_run_ids is required" });
    }

    const run_ids = test_run_ids.split(',').map(id => parseInt(id.trim()));
    const metrics = (metric_types || "iops,avg_latency,bandwidth").split(',').map(m => m.trim());
    
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

/**
 * @swagger
 * /api/test-runs/{id}:
 *   get:
 *     summary: Get a single test run
 *     description: Retrieve a single FIO test run by its ID
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test run ID
 *         example: 61
 *     responses:
 *       200:
 *         description: Test run retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestRun'
 *       401:
 *         description: Unauthorized - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Test run not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/test-runs/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.get(`
        SELECT id, timestamp, test_date, drive_model, drive_type, test_name, block_size, read_write_pattern, queue_depth, duration, fio_version, job_runtime, rwmixread, total_ios_read, total_ios_write, usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path
        FROM test_runs
        WHERE id = ?
    `, [parseInt(id)], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Test run not found' });
        }
        res.json(row);
    });
});

/**
 * @swagger
 * /api/test-runs/{id}/performance-data:
 *   get:
 *     summary: Get performance data for a single test run
 *     description: Retrieve performance metrics and latency percentiles for a specific test run
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test run ID
 *         example: 61
 *       - in: query
 *         name: metric_types
 *         schema:
 *           type: string
 *           default: "iops,avg_latency,bandwidth"
 *         description: Comma-separated list of metric types to retrieve
 *         example: "iops,avg_latency,bandwidth"
 *     responses:
 *       200:
 *         description: Performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 test_run:
 *                   $ref: '#/components/schemas/TestRun'
 *                 metrics:
 *                   type: object
 *                   description: Performance metrics grouped by operation type
 *                   example: {"read": {"iops": 1000, "bandwidth": 50}, "write": {"iops": 500, "bandwidth": 25}}
 *                 latency_percentiles:
 *                   type: object
 *                   description: Latency percentiles grouped by operation type
 *                   example: {"read": {"p95": 1.5, "p99": 2.1}, "write": {"p95": 2.0, "p99": 3.0}}
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Test run not found
 *       500:
 *         description: Internal server error
 */
app.get('/api/test-runs/:id/performance-data', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { metric_types } = req.query;
    
    const metrics = (metric_types || "iops,avg_latency,bandwidth").split(',').map(m => m.trim());
    const metric_placeholders = metrics.map(() => '?').join(',');
    
    // First, get the test run details
    db.get(`
        SELECT id, timestamp, test_date, drive_model, drive_type, test_name, block_size, read_write_pattern, queue_depth, duration, fio_version, job_runtime, rwmixread, total_ios_read, total_ios_write, usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path
        FROM test_runs
        WHERE id = ?
    `, [parseInt(id)], (err, testRun) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!testRun) {
            return res.status(404).json({ error: 'Test run not found' });
        }
        
        // Get performance metrics
        db.all(`
            SELECT metric_type, value, unit, operation_type
            FROM performance_metrics
            WHERE test_run_id = ? AND metric_type IN (${metric_placeholders})
            ORDER BY operation_type, metric_type
        `, [parseInt(id), ...metrics], (err, metricRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Get latency percentiles
            db.all(`
                SELECT operation_type, percentile, latency_ns
                FROM latency_percentiles
                WHERE test_run_id = ?
                ORDER BY operation_type, percentile
            `, [parseInt(id)], (err, percentileRows) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Group metrics by operation type
                const metricsByOperation = {};
                for (const row of metricRows) {
                    const operation = row.operation_type || 'combined';
                    if (!metricsByOperation[operation]) {
                        metricsByOperation[operation] = {};
                    }
                    metricsByOperation[operation][row.metric_type] = {
                        value: row.value,
                        unit: row.unit
                    };
                }
                
                // Group percentiles by operation type
                const percentilesByOperation = {};
                for (const row of percentileRows) {
                    const operation = row.operation_type;
                    if (!percentilesByOperation[operation]) {
                        percentilesByOperation[operation] = {};
                    }
                    percentilesByOperation[operation][`p${row.percentile}`] = {
                        value: row.latency_ns / 1000000, // Convert to milliseconds
                        unit: 'ms'
                    };
                }
                
                res.json({
                    test_run: testRun,
                    metrics: metricsByOperation,
                    latency_percentiles: percentilesByOperation
                });
            });
        });
    });
});

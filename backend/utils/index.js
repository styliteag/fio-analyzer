const crypto = require('crypto');

// Generate a unique request ID for logging purposes
function generateRequestId() {
    return crypto.randomBytes(8).toString('hex');
}

// Enhanced logging functions with structured output
function logInfo(message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level: 'INFO',
        message,
        ...metadata
    };
    console.log(`[${timestamp}] INFO  ${message} | ${Object.entries(metadata).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

function logError(message, error, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level: 'ERROR',
        message,
        error: error?.message || error,
        stack: error?.stack,
        ...metadata
    };
    console.error(`[${timestamp}] ERROR ${message} | error=${error?.message || error} | ${Object.entries(metadata).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

function logWarning(message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level: 'WARN',
        message,
        ...metadata
    };
    console.warn(`[${timestamp}] WARN  ${message} | ${Object.entries(metadata).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

function logDebug(message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level: 'DEBUG',
        message,
        ...metadata
    };
    console.log(`[${timestamp}] DEBUG ${message} | ${Object.entries(metadata).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

// Enhanced request logging middleware
function requestLoggingMiddleware(req, res, next) {
    const requestId = generateRequestId();
    req.requestId = requestId;
    
    const startTime = Date.now();
    
    // Log incoming request
    logInfo('Incoming request', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        contentLength: req.get('Content-Length') || 0
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        logInfo('Request completed', {
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('Content-Length') || 0
        });
        
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
}

// Error logging middleware
function errorLoggingMiddleware(err, req, res, next) {
    logError('Unhandled error', err, {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
    });
    
    res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId
    });
}

// Calculate unique key for test run configuration
function calculateUniqueKey(testRun) {
    const fields = [
        testRun.drive_type || '',
        testRun.drive_model || '',
        testRun.hostname || '',
        testRun.protocol || '',
        testRun.block_size || '',
        testRun.read_write_pattern || '',
        testRun.output_file || '',
        testRun.num_jobs || '',
        testRun.direct || '',
        testRun.test_size || '',
        testRun.sync || '',
        testRun.iodepth || ''
    ];
    return fields.join('|').toLowerCase();
}

// Parse block size text to numeric KB value for calculations
function parseBlockSizeToKB(blockSizeStr) {
    if (!blockSizeStr) return 64; // Default to 64KB
    
    const str = blockSizeStr.toString().toUpperCase();
    const num = parseInt(str);
    
    if (str.includes('M')) {
        return num * 1024; // Convert MB to KB
    } else if (str.includes('K')) {
        return num; // Already in KB
    } else {
        return Math.max(1, num / 1024); // Convert bytes to KB
    }
}

// Helper functions for sample data generation
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
        "HDD": {"sequential": 5.0, "random": 10.0}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    const base = base_values[drive_type][pattern_type];
    return base; // Base latency doesn't need block size adjustment like IOPS
}

function getBaseBandwidth(drive_type, pattern, block_size) {
    const base_values = {
        "NVMe SSD": {"sequential": 3000, "random": 1500},
        "SATA SSD": {"sequential": 500, "random": 250},
        "HDD": {"sequential": 150, "random": 50}
    };
    
    const pattern_type = pattern.includes("sequential") ? "sequential" : "random";
    const base = base_values[drive_type][pattern_type];
    const blockSizeKB = parseBlockSizeToKB(block_size);
    return base * Math.pow(blockSizeKB / 64, 0.3);
}

// Server ready message
function showServerReady(port) {
    console.log('\n🚀 Server running at http://localhost:' + port);
    console.log('📊 FIO Analyzer Backend is ready to accept requests!');
    console.log('💡 Default admin credentials: admin/admin\n');
}

// Request ID middleware
function requestIdMiddleware(req, res, next) {
    req.requestId = generateRequestId();
    next();
}

module.exports = {
    generateRequestId,
    logInfo,
    logError,
    logWarning,
    logDebug,
    calculateUniqueKey,
    parseBlockSizeToKB,
    getBaseIops,
    getBaseLatency,
    getBaseBandwidth,
    showServerReady,
    requestIdMiddleware,
    requestLoggingMiddleware,
    errorLoggingMiddleware
};
const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database');
const { requireAdmin } = require('../auth');
const { logInfo, logError, requestIdMiddleware } = require('../utils');

const router = express.Router();

// Apply request ID middleware
router.use(requestIdMiddleware);

/**
 * @swagger
 * /api/filters:
 *   get:
 *     summary: Get filter options for UI
 *     description: Retrieve available filter options (drive models, types, hostnames, protocols) for UI dropdowns
 *     tags: [Utils]
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
 *                 drive_models:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Samsung 980 PRO", "Samsung SN850", "Intel Optane"]
 *                 drive_types:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["NVMe SSD", "SATA SSD", "HDD"]
 *                 hostnames:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["web-server-01", "db-server-01", "app-server-01"]
 *                 protocols:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Local", "iSCSI", "NFS"]
 *                 block_sizes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["4K", "8K", "16K", "64K", "1M"]
 *                 patterns:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["read", "write", "randread", "randwrite"]
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/filters', requireAdmin, (req, res) => {
    logInfo('User requesting filter options', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_FILTER_OPTIONS'
    });
    
    const db = getDatabase();
    
    // Get all unique values for filter dropdowns
    const queries = [
        'SELECT DISTINCT drive_model FROM test_runs WHERE drive_model IS NOT NULL ORDER BY drive_model',
        'SELECT DISTINCT drive_type FROM test_runs WHERE drive_type IS NOT NULL ORDER BY drive_type',
        'SELECT DISTINCT hostname FROM test_runs WHERE hostname IS NOT NULL ORDER BY hostname',
        'SELECT DISTINCT protocol FROM test_runs WHERE protocol IS NOT NULL ORDER BY protocol',
        'SELECT DISTINCT block_size FROM test_runs WHERE block_size IS NOT NULL ORDER BY block_size',
        'SELECT DISTINCT read_write_pattern FROM test_runs WHERE read_write_pattern IS NOT NULL ORDER BY read_write_pattern',
        'SELECT DISTINCT sync FROM test_runs WHERE sync IS NOT NULL ORDER BY sync',
        'SELECT DISTINCT queue_depth FROM test_runs WHERE queue_depth IS NOT NULL ORDER BY queue_depth',
        'SELECT DISTINCT direct FROM test_runs WHERE direct IS NOT NULL ORDER BY direct',
        'SELECT DISTINCT num_jobs FROM test_runs WHERE num_jobs IS NOT NULL ORDER BY num_jobs',
        'SELECT DISTINCT test_size FROM test_runs WHERE test_size IS NOT NULL ORDER BY test_size',
        'SELECT DISTINCT duration FROM test_runs WHERE duration IS NOT NULL ORDER BY duration'
    ];
    
    const results = {};
    const keys = ['drive_models', 'drive_types', 'hostnames', 'protocols', 'block_sizes', 'patterns', 'syncs', 'queue_depths', 'directs', 'num_jobs', 'test_sizes', 'durations'];
    let completed = 0;
    
    queries.forEach((query, index) => {
        db.all(query, [], (err, rows) => {
            if (err) {
                logError('Database error fetching filter options', err, {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'GET_FILTER_OPTIONS',
                    queryIndex: index
                });
                res.status(500).json({ error: err.message });
                return;
            }
            
            const fieldName = Object.keys(rows[0] || {})[0];
            results[keys[index]] = rows.map(row => row[fieldName]);
            
            completed++;
            if (completed === queries.length) {
                logInfo('Filter options retrieved successfully', {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'GET_FILTER_OPTIONS',
                    filterCounts: Object.keys(results).map(key => `${key}:${results[key].length}`).join(', ')
                });
                
                res.json(results);
            }
        });
    });
});

/**
 * @swagger
 * /api/info:
 *   get:
 *     summary: Get API information
 *     description: Retrieve basic information about the FIO Analyzer API
 *     tags: [Utils]
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
 *                   example: "FIO Analyzer API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 description:
 *                   type: string
 *                   example: "API for FIO performance analysis and time-series monitoring"
 *                 endpoints:
 *                   type: integer
 *                   example: 14
 *                 documentation:
 *                   type: string
 *                   example: "/api-docs"
 */
router.get('/info', (req, res) => {
    res.json({
        name: 'FIO Analyzer API',
        version: '1.0.0',
        description: 'API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring',
        endpoints: 14,
        documentation: '/api-docs'
    });
});

/**
 * @swagger
 * /api/database/clear:
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
 *                 deleted_records:
 *                   type: object
 *                   properties:
 *                     test_runs:
 *                       type: integer
 *                       example: 150
 *                     performance_metrics:
 *                       type: integer
 *                       example: 600
 *                     latency_percentiles:
 *                       type: integer
 *                       example: 750
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.delete('/database/clear', requireAdmin, (req, res) => {
    logInfo('User requesting database clear', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'CLEAR_DATABASE'
    });
    
    const db = getDatabase();
    
    // Get counts before deletion
    db.get('SELECT COUNT(*) as count FROM test_runs', [], (err, testRunsCount) => {
        if (err) {
            logError('Error getting test runs count', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'CLEAR_DATABASE'
            });
            return res.status(500).json({ error: err.message });
        }
        
        db.get('SELECT COUNT(*) as count FROM performance_metrics', [], (err, metricsCount) => {
            if (err) {
                logError('Error getting metrics count', err, {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'CLEAR_DATABASE'
                });
                return res.status(500).json({ error: err.message });
            }
            
            // Clear tables
            db.serialize(() => {
                db.run('DELETE FROM performance_metrics');
                db.run('DELETE FROM test_runs', function(err) {
                    if (err) {
                        logError('Error clearing database', err, {
                            requestId: req.requestId,
                            username: req.user.username,
                            action: 'CLEAR_DATABASE'
                        });
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    logInfo('Database cleared successfully', {
                        requestId: req.requestId,
                        username: req.user.username,
                        action: 'CLEAR_DATABASE',
                        deletedRecords: {
                            test_runs: testRunsCount.count,
                            performance_metrics: metricsCount.count
                        }
                    });
                    
                    res.json({
                        message: 'Database cleared successfully',
                        deleted_records: {
                            test_runs: testRunsCount.count,
                            performance_metrics: metricsCount.count
                        }
                    });
                });
            });
        });
    });
});

module.exports = router;
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDatabase, updateLatestFlags, insertMetric, insertLatencyPercentiles } = require('../database');
const { requireAdmin, requireAuth } = require('../auth');
const { logInfo, logError, logWarning, requestIdMiddleware } = require('../utils');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Apply request ID middleware to all routes
router.use(requestIdMiddleware);

/**
 * @swagger
 * /api/test-runs:
 *   get:
 *     summary: Get latest test runs (or all with historical data)
 *     description: Retrieve a list of FIO test runs. By default returns only the latest test for each unique configuration. Use include_historical=true to get all historical data.
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: include_historical
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Include historical test runs (default false - only latest per configuration)
 *         example: false
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
router.get('/', requireAdmin, (req, res) => {
    const includeHistorical = req.query.include_historical === 'true';
    
    logInfo('User requesting test runs list', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'LIST_TEST_RUNS',
        includeHistorical: includeHistorical
    });
    
    // Build query with optional is_latest filter
    let query = `
        SELECT id, timestamp, drive_model, drive_type, test_name, 
               block_size, read_write_pattern, queue_depth, duration,
               fio_version, job_runtime, rwmixread, total_ios_read, 
               total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
               output_file, num_jobs, direct, test_size, sync, iodepth, is_latest
        FROM test_runs
    `;
    
    // Add WHERE clause to filter by is_latest unless historical data is requested
    if (!includeHistorical) {
        query += ` WHERE is_latest = 1`;
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    const db = getDatabase();
    db.all(query, [], (err, rows) => {
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
            resultCount: rows.length,
            includeHistorical: includeHistorical
        });
        
        res.json(rows);
    });
});

/**
 * @swagger
 * /api/test-runs/performance-data:
 *   get:
 *     summary: Get performance metrics for multiple test runs
 *     description: Retrieve performance metrics (IOPS, latency, bandwidth) for specified test runs
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
 *         example: "1,2,3,4"
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   test_run_id:
 *                     type: integer
 *                     example: 1
 *                   metrics:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/PerformanceMetric'
 *       400:
 *         description: Bad request - test_run_ids is required
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/performance-data', requireAdmin, (req, res) => {
    const { test_run_ids } = req.query;

    if (!test_run_ids) {
        return res.status(400).json({ error: "test_run_ids is required" });
    }

    const run_ids = test_run_ids.split(',').map(id => parseInt(id.trim()));
    const placeholders = run_ids.map(() => '?').join(',');

    const query = `
        SELECT 
            tr.id, tr.drive_model, tr.drive_type, tr.test_name, 
            tr.block_size, tr.read_write_pattern, tr.timestamp, tr.queue_depth,
            tr.hostname, tr.protocol, tr.output_file, tr.num_jobs, tr.direct, 
            tr.test_size, tr.sync, tr.iodepth, tr.duration,
            pm.metric_type, pm.value, pm.unit, pm.operation_type
        FROM test_runs tr
        JOIN performance_metrics pm ON tr.id = pm.test_run_id
        WHERE tr.id IN (${placeholders})
        ORDER BY tr.id, pm.metric_type
    `;

    const db = getDatabase();
    db.all(query, run_ids, (err, rows) => {
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
                    queue_depth: row.queue_depth,
                    hostname: row.hostname,
                    protocol: row.protocol,
                    output_file: row.output_file,
                    num_jobs: row.num_jobs,
                    direct: row.direct,
                    test_size: row.test_size,
                    sync: row.sync,
                    iodepth: row.iodepth,
                    duration: row.duration,
                    metrics: {}
                };
            }
            
            // Create the metric key (e.g., "iops", "avg_latency", "bandwidth")
            const metricKey = row.metric_type;
            data[run_id].metrics[metricKey] = {
                value: row.value,
                unit: row.unit,
                operation_type: row.operation_type
            };
        }
        
        const responseData = Object.values(data);
        res.json(responseData);
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Updated test description
 *                 example: "Updated performance test on production server"
 *               hostname:
 *                 type: string
 *                 description: Updated hostname
 *                 example: "prod-db-01"
 *               protocol:
 *                 type: string
 *                 description: Updated protocol
 *                 example: "iSCSI"
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
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Test run not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { description, hostname, protocol } = req.body;
    
    logInfo('User updating test run', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'UPDATE_TEST_RUN',
        testRunId: id,
        updatedFields: Object.keys(req.body)
    });
    
    const db = getDatabase();
    db.run(`
        UPDATE test_runs 
        SET description = COALESCE(?, description),
            hostname = COALESCE(?, hostname),
            protocol = COALESCE(?, protocol)
        WHERE id = ?
    `, [description, hostname, protocol, parseInt(id)], function(err) {
        if (err) {
            logError('Database error updating test run', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'UPDATE_TEST_RUN',
                testRunId: id
            });
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            logWarning('Test run not found for update', {
                requestId: req.requestId,
                username: req.user.username,
                action: 'UPDATE_TEST_RUN',
                testRunId: id
            });
            return res.status(404).json({ error: 'Test run not found' });
        }
        
        logInfo('Test run updated successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'UPDATE_TEST_RUN',
            testRunId: id,
            changesCount: this.changes
        });
        
        res.json({ message: 'Test run updated successfully' });
    });
});

/**
 * @swagger
 * /api/test-runs/{id}:
 *   delete:
 *     summary: Delete a test run
 *     description: Delete a specific test run and all its associated performance metrics and latency percentiles
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
 *         example: 1
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
 *                   example: "Test run deleted successfully"
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Test run not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    logInfo('User deleting test run', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'DELETE_TEST_RUN',
        testRunId: id
    });
    
    const db = getDatabase();
    
    // Delete in order: latency_percentiles, performance_metrics, then test_runs
    db.serialize(() => {
        db.run('DELETE FROM latency_percentiles WHERE test_run_id = ?', [parseInt(id)], (err) => {
            if (err) {
                logError('Error deleting latency percentiles', err, {
                    requestId: req.requestId,
                    username: req.user.username,
                    action: 'DELETE_TEST_RUN',
                    testRunId: id
                });
                return res.status(500).json({ error: err.message });
            }
            
            db.run('DELETE FROM performance_metrics WHERE test_run_id = ?', [parseInt(id)], (err) => {
                if (err) {
                    logError('Error deleting performance metrics', err, {
                        requestId: req.requestId,
                        username: req.user.username,
                        action: 'DELETE_TEST_RUN',
                        testRunId: id
                    });
                    return res.status(500).json({ error: err.message });
                }
                
                db.run('DELETE FROM test_runs WHERE id = ?', [parseInt(id)], function(err) {
                    if (err) {
                        logError('Error deleting test run', err, {
                            requestId: req.requestId,
                            username: req.user.username,
                            action: 'DELETE_TEST_RUN',
                            testRunId: id
                        });
                        return res.status(500).json({ error: err.message });
                    }
                    
                    if (this.changes === 0) {
                        logWarning('Test run not found for deletion', {
                            requestId: req.requestId,
                            username: req.user.username,
                            action: 'DELETE_TEST_RUN',
                            testRunId: id
                        });
                        return res.status(404).json({ error: 'Test run not found' });
                    }
                    
                    logInfo('Test run deleted successfully', {
                        requestId: req.requestId,
                        username: req.user.username,
                        action: 'DELETE_TEST_RUN',
                        testRunId: id
                    });
                    
                    res.json({ message: 'Test run deleted successfully' });
                });
            });
        });
    });
});

module.exports = router;
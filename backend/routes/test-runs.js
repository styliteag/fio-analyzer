const express = require('express');
// const multer = require('multer'); // Unused import
// const path = require('path'); // Unused import
// const fs = require('fs'); // Unused import
const { getDatabase } = require('../database');
const { requireAdmin } = require('../auth');
const { logInfo, logError, logWarning, requestIdMiddleware } = require('../utils');

const router = express.Router();

// Configure multer for file uploads (unused)
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         const uploadPath = path.join(__dirname, '..', 'uploads');
//         if (!fs.existsSync(uploadPath)) {
//             fs.mkdirSync(uploadPath, { recursive: true });
//         }
//         cb(null, uploadPath);
//     },
//     filename: function (req, file, cb) {
//         cb(null, `${Date.now()}-${file.originalname}`);
//     }
// });

// const upload = multer({ storage: storage }); // Unused variable

// Apply request ID middleware to all routes
router.use(requestIdMiddleware);

/**
 * @swagger
 * /api/test-runs/bulk:
 *   put:
 *     summary: Bulk update test run metadata
 *     description: Update metadata fields for multiple test runs at once
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testRunIds
 *               - updates
 *             properties:
 *               testRunIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of test run IDs to update
 *                 example: [1, 2, 3, 4]
 *               updates:
 *                 type: object
 *                 properties:
 *                   description:
 *                     type: string
 *                     description: New test description
 *                     example: "Bulk updated performance test"
 *                   test_name:
 *                     type: string
 *                     description: New test name
 *                     example: "Bulk updated test name"
 *                   hostname:
 *                     type: string
 *                     description: New hostname
 *                     example: "prod-cluster-01"
 *                   protocol:
 *                     type: string
 *                     description: New protocol
 *                     example: "NVMe"
 *                   drive_type:
 *                     type: string
 *                     description: New drive type
 *                     example: "NVMe SSD"
 *                   drive_model:
 *                     type: string
 *                     description: New drive model
 *                     example: "Samsung 980 PRO"
 *     responses:
 *       200:
 *         description: Test runs updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully updated 4 test runs"
 *                 updated:
 *                   type: integer
 *                   example: 4
 *                 failed:
 *                   type: integer
 *                   example: 0
 *       400:
 *         description: Bad request - Invalid fields or missing data
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.put('/bulk', requireAdmin, (req, res) => {
    const { testRunIds, updates } = req.body;

    // Validate required fields
    if (!testRunIds || !Array.isArray(testRunIds) || testRunIds.length === 0) {
        return res.status(400).json({ error: 'testRunIds array is required and must not be empty' });
    }

    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'updates object is required' });
    }

    // Define allowed fields for validation
    const allowedFields = ['description', 'test_name', 'hostname', 'protocol', 'drive_type', 'drive_model'];
    const submittedFields = Object.keys(updates);

    // Check for invalid fields
    const invalidFields = submittedFields.filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
        logWarning('Invalid fields in bulk test run update request', {
            requestId: req.requestId,
            username: req.user.username,
            testRunIds,
            invalidFields
        });
        return res.status(400).json({
            error: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`
        });
    }

    // Simple validation
    const validation = {
        hostname: { maxLength: 255 },
        protocol: { maxLength: 100 },
        description: { maxLength: 1000 },
        test_name: { maxLength: 500 },
        drive_type: { maxLength: 100 },
        drive_model: { maxLength: 255 }
    };

    for (const [field, value] of Object.entries(updates)) {
        if (value && validation[field] && value.length > validation[field].maxLength) {
            return res.status(400).json({
                error: `Field '${field}' exceeds maximum length of ${validation[field].maxLength} characters`
            });
        }
    }

    logInfo('Admin bulk updating test runs', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'BULK_UPDATE_TEST_RUNS',
        testRunCount: testRunIds.length,
        testRunIds,
        updatedFields: submittedFields,
        changes: updates
    });

    const db = getDatabase();

    // Build dynamic SQL for only the fields being updated
    const setParts = [];
    const values = [];

    if (updates.description !== undefined) {
        setParts.push('description = ?');
        values.push(updates.description);
    }
    if (updates.test_name !== undefined) {
        setParts.push('test_name = ?');
        values.push(updates.test_name);
    }
    if (updates.hostname !== undefined) {
        setParts.push('hostname = ?');
        values.push(updates.hostname);
    }
    if (updates.protocol !== undefined) {
        setParts.push('protocol = ?');
        values.push(updates.protocol);
    }
    if (updates.drive_type !== undefined) {
        setParts.push('drive_type = ?');
        values.push(updates.drive_type);
    }
    if (updates.drive_model !== undefined) {
        setParts.push('drive_model = ?');
        values.push(updates.drive_model);
    }

    if (setParts.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Create placeholders for WHERE IN clause
    const placeholders = testRunIds.map(() => '?').join(',');
    const whereValues = testRunIds.map(id => parseInt(id));

    const query = `
        UPDATE test_runs 
        SET ${setParts.join(', ')}
        WHERE id IN (${placeholders})
    `;

    db.run(query, [...values, ...whereValues], function(err) {
        if (err) {
            logError('Database error in bulk update', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'BULK_UPDATE_TEST_RUNS',
                testRunIds
            });
            res.status(500).json({ error: err.message });
            return;
        }

        const updatedCount = this.changes;
        const failedCount = testRunIds.length - updatedCount;

        logInfo('Bulk test run update completed', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'BULK_UPDATE_TEST_RUNS',
            requestedCount: testRunIds.length,
            updatedCount,
            failedCount,
            updatedFields: submittedFields,
            newValues: updates
        });

        res.json({
            message: `Successfully updated ${updatedCount} test runs`,
            updated: updatedCount,
            failed: failedCount
        });
    });
});

/**
 * @swagger
 * /api/test-runs:
 *   get:
 *     summary: Get latest test runs with optional filtering
 *     description: Retrieve a list of the latest FIO test runs (one per unique configuration) with comprehensive filtering capabilities. For historical data, use the /api/time-series endpoints.
 *     tags: [Test Runs]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: hostnames
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of hostnames to filter by
 *         example: "server1,server2"
 *       - in: query
 *         name: protocols
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of protocols to filter by
 *         example: "NVMe,SATA"
 *       - in: query
 *         name: drive_types
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of drive types to filter by
 *         example: "SSD,HDD"
 *       - in: query
 *         name: drive_models
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of drive models to filter by
 *         example: "Samsung 980 PRO,WD Black"
 *       - in: query
 *         name: patterns
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of test patterns to filter by
 *         example: "read,write,randread,randwrite"
 *       - in: query
 *         name: block_sizes
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of block sizes to filter by
 *         example: "4k,64k,1M"
 *       - in: query
 *         name: syncs
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of sync values to filter by
 *         example: "0,1"
 *       - in: query
 *         name: queue_depths
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of queue depths to filter by
 *         example: "1,4,16,32"
 *       - in: query
 *         name: directs
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of direct I/O values to filter by
 *         example: "0,1"
 *       - in: query
 *         name: num_jobs
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of number of jobs to filter by
 *         example: "1,4,8"
 *       - in: query
 *         name: test_sizes
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of test sizes to filter by
 *         example: "1G,10G,100G"
 *       - in: query
 *         name: durations
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of test durations (in seconds) to filter by
 *         example: "30,60,300"
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
    // Extract filter parameters from query string
    const filters = {
        hostnames: req.query.hostnames ? req.query.hostnames.split(',') : [],
        protocols: req.query.protocols ? req.query.protocols.split(',') : [],
        drive_types: req.query.drive_types ? req.query.drive_types.split(',') : [],
        drive_models: req.query.drive_models ? req.query.drive_models.split(',') : [],
        patterns: req.query.patterns ? req.query.patterns.split(',') : [],
        block_sizes: req.query.block_sizes ? req.query.block_sizes.split(',') : [],
        syncs: req.query.syncs ? req.query.syncs.split(',').map(s => parseInt(s)) : [],
        queue_depths: req.query.queue_depths ? req.query.queue_depths.split(',').map(q => parseInt(q)) : [],
        directs: req.query.directs ? req.query.directs.split(',').map(d => parseInt(d)) : [],
        num_jobs: req.query.num_jobs ? req.query.num_jobs.split(',').map(n => parseInt(n)) : [],
        test_sizes: req.query.test_sizes ? req.query.test_sizes.split(',') : [],
        durations: req.query.durations ? req.query.durations.split(',').map(d => parseInt(d)) : []
    };

    logInfo('User requesting latest test runs list with filters', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'LIST_LATEST_TEST_RUNS',
        filters: filters
    });

    // Build base query
    let query = `
        SELECT id, timestamp, drive_model, drive_type, test_name, description,
               block_size, read_write_pattern, queue_depth, duration,
               fio_version, job_runtime, rwmixread, total_ios_read, 
               total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
               output_file, num_jobs, direct, test_size, sync, iodepth, is_latest
        FROM test_runs
    `;

    // Build WHERE conditions
    const whereConditions = [];
    const queryParams = [];

    // Add hostname filter
    if (filters.hostnames.length > 0) {
        const placeholders = filters.hostnames.map(() => '?').join(',');
        whereConditions.push(`hostname IN (${placeholders})`);
        queryParams.push(...filters.hostnames);
    }

    // Add protocol filter
    if (filters.protocols.length > 0) {
        const placeholders = filters.protocols.map(() => '?').join(',');
        whereConditions.push(`protocol IN (${placeholders})`);
        queryParams.push(...filters.protocols);
    }

    // Add drive_type filter
    if (filters.drive_types.length > 0) {
        const placeholders = filters.drive_types.map(() => '?').join(',');
        whereConditions.push(`drive_type IN (${placeholders})`);
        queryParams.push(...filters.drive_types);
    }

    // Add drive_model filter
    if (filters.drive_models.length > 0) {
        const placeholders = filters.drive_models.map(() => '?').join(',');
        whereConditions.push(`drive_model IN (${placeholders})`);
        queryParams.push(...filters.drive_models);
    }

    // Add patterns (read_write_pattern) filter
    if (filters.patterns.length > 0) {
        const placeholders = filters.patterns.map(() => '?').join(',');
        whereConditions.push(`read_write_pattern IN (${placeholders})`);
        queryParams.push(...filters.patterns);
    }

    // Add block_sizes filter (handle both string and numeric values)
    if (filters.block_sizes.length > 0) {
        const placeholders = filters.block_sizes.map(() => '?').join(',');
        whereConditions.push(`block_size IN (${placeholders})`);
        queryParams.push(...filters.block_sizes);
    }

    // Add sync filter
    if (filters.syncs.length > 0) {
        const placeholders = filters.syncs.map(() => '?').join(',');
        whereConditions.push(`sync IN (${placeholders})`);
        queryParams.push(...filters.syncs);
    }

    // Add queue_depths filter
    if (filters.queue_depths.length > 0) {
        const placeholders = filters.queue_depths.map(() => '?').join(',');
        whereConditions.push(`queue_depth IN (${placeholders})`);
        queryParams.push(...filters.queue_depths);
    }

    // Add directs filter
    if (filters.directs.length > 0) {
        const placeholders = filters.directs.map(() => '?').join(',');
        whereConditions.push(`direct IN (${placeholders})`);
        queryParams.push(...filters.directs);
    }

    // Add num_jobs filter
    if (filters.num_jobs.length > 0) {
        const placeholders = filters.num_jobs.map(() => '?').join(',');
        whereConditions.push(`num_jobs IN (${placeholders})`);
        queryParams.push(...filters.num_jobs);
    }

    // Add test_sizes filter
    if (filters.test_sizes.length > 0) {
        const placeholders = filters.test_sizes.map(() => '?').join(',');
        whereConditions.push(`test_size IN (${placeholders})`);
        queryParams.push(...filters.test_sizes);
    }

    // Add durations filter
    if (filters.durations.length > 0) {
        const placeholders = filters.durations.map(() => '?').join(',');
        whereConditions.push(`duration IN (${placeholders})`);
        queryParams.push(...filters.durations);
    }

    // Add WHERE clause if there are conditions
    if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ` ORDER BY timestamp DESC`;

    const db = getDatabase();
    db.all(query, queryParams, (err, rows) => {
        if (err) {
            logError('Database error fetching test runs', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'LIST_TEST_RUNS'
            });
            res.status(500).json({ error: err.message });
            return;
        }

        logInfo('Latest test runs list retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'LIST_LATEST_TEST_RUNS',
            resultCount: rows.length,
            filtersApplied: Object.keys(filters).filter(key => filters[key].length > 0)
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
            tr.id, tr.drive_model, tr.drive_type, tr.test_name, tr.description,
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
                    description: row.description,
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
 *   get:
 *     summary: Get a single test run by ID
 *     description: Retrieve a specific FIO test run by its unique identifier
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
router.get('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;

    logInfo('User requesting single test run', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_TEST_RUN',
        testRunId: id
    });

    const query = `
        SELECT id, timestamp, drive_model, drive_type, test_name, description,
               block_size, read_write_pattern, queue_depth, duration,
               fio_version, job_runtime, rwmixread, total_ios_read, 
               total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
               output_file, num_jobs, direct, test_size, sync, iodepth, is_latest
        FROM test_runs
        WHERE id = ?
    `;

    const db = getDatabase();
    db.get(query, [parseInt(id)], (err, row) => {
        if (err) {
            logError('Database error fetching test run', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_TEST_RUN',
                testRunId: id
            });
            res.status(500).json({ error: err.message });
            return;
        }

        if (!row) {
            logWarning('Test run not found', {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_TEST_RUN',
                testRunId: id
            });
            return res.status(404).json({ error: 'Test run not found' });
        }

        logInfo('Test run retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_TEST_RUN',
            testRunId: id
        });

        res.json(row);
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
 *               test_name:
 *                 type: string
 *                 description: Updated test name
 *                 example: "Updated test name"
 *               hostname:
 *                 type: string
 *                 description: Updated hostname
 *                 example: "prod-db-01"
 *               protocol:
 *                 type: string
 *                 description: Updated protocol
 *                 example: "iSCSI"
 *               drive_type:
 *                 type: string
 *                 description: Updated drive type
 *                 example: "NVMe SSD"
 *               drive_model:
 *                 type: string
 *                 description: Updated drive model
 *                 example: "Samsung 980 PRO"
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
    const { description, test_name, hostname, protocol, drive_type, drive_model } = req.body;

    // Define allowed fields for validation
    const allowedFields = ['description', 'test_name', 'hostname', 'protocol', 'drive_type', 'drive_model'];
    const submittedFields = Object.keys(req.body);

    // Check for invalid fields
    const invalidFields = submittedFields.filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
        logWarning('Invalid fields in test run update request', {
            requestId: req.requestId,
            username: req.user.username,
            testRunId: id,
            invalidFields
        });
        return res.status(400).json({
            error: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`
        });
    }

    // Simple validation
    const validation = {
        hostname: { maxLength: 255 },
        protocol: { maxLength: 100 },
        description: { maxLength: 1000 },
        test_name: { maxLength: 500 },
        drive_type: { maxLength: 100 },
        drive_model: { maxLength: 255 }
    };

    for (const [field, value] of Object.entries(req.body)) {
        if (value && validation[field] && value.length > validation[field].maxLength) {
            return res.status(400).json({
                error: `Field '${field}' exceeds maximum length of ${validation[field].maxLength} characters`
            });
        }
    }

    logInfo('Admin updating test run fields', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'UPDATE_TEST_RUN',
        testRunId: id,
        updatedFields: submittedFields,
        changes: req.body
    });

    const db = getDatabase();
    db.run(`
        UPDATE test_runs 
        SET description = COALESCE(?, description),
            test_name = COALESCE(?, test_name),
            hostname = COALESCE(?, hostname),
            protocol = COALESCE(?, protocol),
            drive_type = COALESCE(?, drive_type),
            drive_model = COALESCE(?, drive_model)
        WHERE id = ?
    `, [description, test_name, hostname, protocol, drive_type, drive_model, parseInt(id)], function(err) {
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
            changesCount: this.changes,
            updatedFields: submittedFields,
            newValues: req.body
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

    // Delete performance_metrics then test_runs
    db.serialize(() => {
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

module.exports = router;

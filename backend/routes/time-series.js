const express = require('express');
const { getDatabase } = require('../database');
const { requireAdmin } = require('../auth');
const { logInfo, logError, requestIdMiddleware } = require('../utils');

const router = express.Router();

// Apply request ID middleware
router.use(requestIdMiddleware);

/**
 * @swagger
 * /api/time-series/all:
 *   get:
 *     summary: Get all historical test runs with filtering
 *     description: Retrieve all historical test runs (equivalent to the old include_historical=true). This endpoint provides access to the complete test run history.
 *     tags: [Time Series]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: hostnames
 *         schema:
 *           type: string
 *         description: Comma-separated list of hostnames to filter by
 *         example: "server1,server2"
 *       - in: query
 *         name: protocols
 *         schema:
 *           type: string
 *         description: Comma-separated list of protocols to filter by
 *         example: "NVMe,SATA"
 *       - in: query
 *         name: drive_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of drive types to filter by
 *         example: "SSD,HDD"
 *       - in: query
 *         name: drive_models
 *         schema:
 *           type: string
 *         description: Comma-separated list of drive models to filter by
 *         example: "Samsung 980 PRO,WD Black"
 *       - in: query
 *         name: patterns
 *         schema:
 *           type: string
 *         description: Comma-separated list of test patterns to filter by
 *         example: "read,write,randread,randwrite"
 *       - in: query
 *         name: block_sizes
 *         schema:
 *           type: string
 *         description: Comma-separated list of block sizes to filter by
 *         example: "4k,64k,1M"
 *       - in: query
 *         name: syncs
 *         schema:
 *           type: string
 *         description: Comma-separated list of sync values to filter by
 *         example: "0,1"
 *       - in: query
 *         name: queue_depths
 *         schema:
 *           type: string
 *         description: Comma-separated list of queue depths to filter by
 *         example: "1,4,16,32"
 *       - in: query
 *         name: directs
 *         schema:
 *           type: string
 *         description: Comma-separated list of direct I/O values to filter by
 *         example: "0,1"
 *       - in: query
 *         name: num_jobs
 *         schema:
 *           type: string
 *         description: Comma-separated list of number of jobs to filter by
 *         example: "1,4,8"
 *       - in: query
 *         name: test_sizes
 *         schema:
 *           type: string
 *         description: Comma-separated list of test sizes to filter by
 *         example: "1G,10G,100G"
 *       - in: query
 *         name: durations
 *         schema:
 *           type: string
 *         description: Comma-separated list of test durations (in seconds) to filter by
 *         example: "30,60,300"
 *     responses:
 *       200:
 *         description: Historical test runs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TestRun'
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/all', requireAdmin, (req, res) => {
    // Extract filter parameters from query string (same as test-runs endpoint)
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

    logInfo('User requesting all historical test runs with filters', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'LIST_ALL_HISTORICAL_TEST_RUNS',
        filters: filters
    });

    // Build base query for test_runs_all
    let query = `
        SELECT id, timestamp, drive_model, drive_type, test_name, description,
               block_size, read_write_pattern, queue_depth, duration,
               fio_version, job_runtime, rwmixread, total_ios_read, 
               total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
               output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
               avg_latency, bandwidth, iops, p95_latency, p99_latency
        FROM test_runs_all
    `;

    // Build WHERE conditions (same logic as test-runs endpoint)
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

    // Add block_sizes filter
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
            logError('Database error fetching all historical test runs', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'LIST_ALL_HISTORICAL_TEST_RUNS'
            });
            res.status(500).json({ error: err.message });
            return;
        }

        logInfo('All historical test runs retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'LIST_ALL_HISTORICAL_TEST_RUNS',
            resultCount: rows.length,
            filtersApplied: Object.keys(filters).filter(key => filters[key].length > 0)
        });

        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/servers:
 *   get:
 *     summary: List servers with test statistics
 *     description: Get a list of all servers with their test count and time range statistics
 *     tags: [Time Series]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Server list retrieved successfully
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
router.get('/servers', requireAdmin, (req, res) => {
    logInfo('User requesting time-series servers list', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'LIST_TIMESERIES_SERVERS'
    });

    const db = getDatabase();
    db.all(`
        SELECT
            hostname,
            COUNT(*) AS config_count,
            SUM(run_count) AS total_runs,
            MAX(last_test_time) AS last_test_time,
            MIN(first_test_time) AS first_test_time
        FROM (
            SELECT
                hostname,
                COUNT(*) AS run_count,
                MAX(timestamp) AS last_test_time,
                MIN(timestamp) AS first_test_time
            FROM test_runs_all
            WHERE hostname IS NOT NULL
              AND protocol IS NOT NULL
              AND drive_model IS NOT NULL
            GROUP BY
                hostname,
                protocol,
                drive_model,
                drive_type,
                read_write_pattern,
                block_size,
                queue_depth
            HAVING
                COUNT(*) >= 2
        )
        GROUP BY hostname
        ORDER BY hostname;
    `, [], (err, rows) => {
        if (err) {
            logError('Database error fetching time-series servers', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'LIST_TIMESERIES_SERVERS'
            });
            res.status(500).json({ error: err.message });
            return;
        }

        logInfo('Time-series servers list retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'LIST_TIMESERIES_SERVERS',
            serverCount: rows.length
        });

        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/latest:
 *   get:
 *     summary: Get latest test results per server
 *     description: Retrieve the most recent test results for each server/drive combination
 *     tags: [Time Series]
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
 *                 $ref: '#/components/schemas/TestRun'
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/latest', requireAdmin, (req, res) => {
    logInfo('User requesting latest time-series data', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_LATEST_TIMESERIES'
    });

    const db = getDatabase();
    db.all(`
        SELECT 
            id, hostname, protocol, drive_model, drive_type, test_name,
            block_size, read_write_pattern, queue_depth, timestamp, description, test_date
        FROM latest_test_per_server
        ORDER BY hostname, protocol, drive_model
    `, [], (err, rows) => {
        if (err) {
            logError('Database error fetching latest time-series data', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_LATEST_TIMESERIES'
            });
            res.status(500).json({ error: err.message });
            return;
        }

        logInfo('Latest time-series data retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_LATEST_TIMESERIES',
            resultCount: rows.length
        });

        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/history:
 *   get:
 *     summary: Get historical test data with filtering
 *     description: Retrieve historical test data for specific servers, drives, and time ranges
 *     tags: [Time Series]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: hostname
 *         schema:
 *           type: string
 *         description: Filter by hostname
 *         example: "web-server-01"
 *       - in: query
 *         name: protocol
 *         schema:
 *           type: string
 *         description: Filter by protocol
 *         example: "Local"
 *       - in: query
 *         name: drive_model
 *         schema:
 *           type: string
 *         description: Filter by drive model
 *         example: "Samsung 980 PRO"
 *       - in: query
 *         name: drive_type
 *         schema:
 *           type: string
 *         description: Filter by drive type
 *         example: "NVMe SSD"
 *       - in: query
 *         name: block_size
 *         schema:
 *           type: string
 *         description: Filter by block size
 *         example: "4k"
 *       - in: query
 *         name: read_write_pattern
 *         schema:
 *           type: string
 *         description: Filter by read/write pattern
 *         example: "randread"
 *       - in: query
 *         name: queue_depth
 *         schema:
 *           type: integer
 *         description: Filter by queue depth
 *         example: 32
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for time range filter
 *         example: "2025-01-01T00:00:00Z"
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for time range filter
 *         example: "2025-01-31T23:59:59Z"
 *       - in: query
 *         name: metric_type
 *         schema:
 *           type: string
 *         description: Filter by metric type (iops, avg_latency, bandwidth)
 *         example: "iops"
 *       - in: query
 *         name: test_size
 *         schema:
 *           type: string
 *         description: Filter by test size
 *         example: "1m"
 *       - in: query
 *         name: sync
 *         schema:
 *           type: integer
 *         description: Filter by sync value (0 or 1)
 *         example: 1
 *       - in: query
 *         name: direct
 *         schema:
 *           type: integer
 *         description: Filter by direct value (0 or 1)
 *         example: 1
 *       - in: query
 *         name: num_jobs
 *         schema:
 *           type: integer
 *         description: Filter by number of jobs
 *         example: 4
 *       - in: query
 *         name: duration
 *         schema:
 *           type: integer
 *         description: Filter by test duration in seconds
 *         example: 30
 *     responses:
 *       200:
 *         description: Historical data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   test_run_id:
 *                     type: integer
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   hostname:
 *                     type: string
 *                   protocol:
 *                     type: string
 *                   drive_model:
 *                     type: string
 *                   block_size:
 *                     type: string
 *                   read_write_pattern:
 *                     type: string
 *                   queue_depth:
 *                     type: integer
 *                   metric_type:
 *                     type: string
 *                   value:
 *                     type: number
 *                   unit:
 *                     type: string
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/history', requireAdmin, (req, res) => {
    const { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, start_date, end_date, metric_type, test_size, sync, direct, num_jobs, duration } = req.query;

    logInfo('User requesting time-series history', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_TIMESERIES_HISTORY',
        filters: { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, start_date, end_date, metric_type, test_size, sync, direct, num_jobs, duration }
    });

    let query = `
        SELECT 
            tr.id as test_run_id,
            tr.timestamp,
            tr.hostname,
            tr.protocol,
            tr.drive_model,
            tr.block_size,
            tr.read_write_pattern,
            tr.queue_depth,
            tr.avg_latency,
            tr.bandwidth,
            tr.iops,
            tr.p95_latency,
            tr.p99_latency
        FROM test_runs_all tr
        WHERE tr.hostname IS NOT NULL AND tr.protocol IS NOT NULL
    `;

    const params = [];

    if (hostname) {
        query += ' AND tr.hostname = ?';
        params.push(hostname);
    }

    if (protocol) {
        query += ' AND tr.protocol = ?';
        params.push(protocol);
    }

    if (drive_model) {
        query += ' AND tr.drive_model = ?';
        params.push(drive_model);
    }

    if (drive_type) {
        query += ' AND tr.drive_type = ?';
        params.push(drive_type);
    }

    if (block_size) {
        query += ' AND tr.block_size = ?';
        params.push(block_size);
    }

    if (read_write_pattern) {
        query += ' AND tr.read_write_pattern = ?';
        params.push(read_write_pattern);
    }

    if (queue_depth) {
        query += ' AND tr.queue_depth = ?';
        params.push(parseInt(queue_depth));
    }

    if (start_date) {
        query += ' AND tr.timestamp >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND tr.timestamp <= ?';
        params.push(end_date);
    }

    if (test_size) {
        query += ' AND tr.test_size = ?';
        params.push(test_size);
    }

    if (sync !== undefined && sync !== '') {
        query += ' AND tr.sync = ?';
        params.push(parseInt(sync));
    }

    if (direct !== undefined && direct !== '') {
        query += ' AND tr.direct = ?';
        params.push(parseInt(direct));
    }

    if (num_jobs) {
        query += ' AND tr.num_jobs = ?';
        params.push(parseInt(num_jobs));
    }

    if (duration) {
        query += ' AND tr.duration = ?';
        params.push(parseInt(duration));
    }

    query += ' ORDER BY tr.timestamp DESC, tr.hostname, tr.protocol, tr.drive_model';

    const db = getDatabase();
    db.all(query, params, (err, rows) => {
        if (err) {
            logError('Database error fetching time-series history', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_TIMESERIES_HISTORY'
            });
            res.status(500).json({ error: err.message });
            return;
        }

        logInfo('Time-series history retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_TIMESERIES_HISTORY',
            resultCount: rows.length,
            appliedFilters: params.length
        });

        res.json(rows);
    });
});

/**
 * @swagger
 * /api/time-series/trends:
 *   get:
 *     summary: Get trend analysis with moving averages
 *     description: Retrieve performance trends with 3-point moving averages and percentage changes
 *     tags: [Time Series]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: hostname
 *         required: true
 *         schema:
 *           type: string
 *         description: Server hostname
 *         example: "web-server-01"
 *       - in: query
 *         name: protocol
 *         required: true
 *         schema:
 *           type: string
 *         description: Storage protocol
 *         example: "Local"
 *       - in: query
 *         name: drive_model
 *         required: true
 *         schema:
 *           type: string
 *         description: Drive model
 *         example: "Samsung 980 PRO"
 *       - in: query
 *         name: metric_type
 *         required: true
 *         schema:
 *           type: string
 *         description: Metric type for trend analysis
 *         example: "iops"
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to analyze (default 30)
 *         example: 30
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
 *         description: Bad request - Missing required parameters
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/trends', requireAdmin, (req, res) => {
    const { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, metric_type, days = 30, test_size, sync, direct, num_jobs, duration } = req.query;

    if (!hostname || !protocol || !drive_model || !metric_type) {
        return res.status(400).json({
            error: 'hostname, protocol, drive_model, and metric_type are required'
        });
    }

    logInfo('User requesting trend analysis', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_TREND_ANALYSIS',
        hostname,
        protocol,
        drive_model,
        drive_type,
        block_size,
        read_write_pattern,
        queue_depth,
        metric_type,
        days,
        test_size,
        sync,
        direct,
        num_jobs,
        duration
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const query = `
        WITH ordered_data AS (
            SELECT 
                tr.timestamp,
                tr.block_size,
                tr.read_write_pattern,
                tr.queue_depth,
                CASE 
                    WHEN ? = 'avg_latency' THEN tr.avg_latency
                    WHEN ? = 'bandwidth' THEN tr.bandwidth
                    WHEN ? = 'iops' THEN tr.iops
                    WHEN ? = 'p95_latency' THEN tr.p95_latency
                    WHEN ? = 'p99_latency' THEN tr.p99_latency
                    ELSE NULL
                END as value,
                CASE 
                    WHEN ? = 'avg_latency' THEN 'ms'
                    WHEN ? = 'bandwidth' THEN 'MB/s'
                    WHEN ? = 'iops' THEN 'IOPS'
                    WHEN ? = 'p95_latency' THEN 'ms'
                    WHEN ? = 'p99_latency' THEN 'ms'
                    ELSE 'N/A'
                END as unit,
                ROW_NUMBER() OVER (ORDER BY tr.timestamp) as rn
            FROM test_runs_all tr
            WHERE tr.hostname = ? 
            AND tr.protocol = ?
            AND tr.drive_model = ?
            AND tr.timestamp >= ?
            ${drive_type ? 'AND tr.drive_type = ?' : ''}
            ${block_size ? 'AND tr.block_size = ?' : ''}
            ${read_write_pattern ? 'AND tr.read_write_pattern = ?' : ''}
            ${queue_depth ? 'AND tr.queue_depth = ?' : ''}
            ${test_size ? 'AND tr.test_size = ?' : ''}
            ${sync !== undefined && sync !== '' ? 'AND tr.sync = ?' : ''}
            ${direct !== undefined && direct !== '' ? 'AND tr.direct = ?' : ''}
            ${num_jobs ? 'AND tr.num_jobs = ?' : ''}
            ${duration ? 'AND tr.duration = ?' : ''}
            ORDER BY tr.timestamp
        ),
        with_moving_avg AS (
            SELECT *,
                (SELECT AVG(value) 
                 FROM ordered_data od2 
                 WHERE od2.rn BETWEEN ordered_data.rn - 1 AND ordered_data.rn + 1
                ) as moving_avg
            FROM ordered_data
        ),
        with_prev_value AS (
            SELECT *,
                LAG(value) OVER (ORDER BY timestamp) as prev_value
            FROM with_moving_avg
        )
        SELECT 
            timestamp,
            block_size,
            read_write_pattern,
            queue_depth,
            value,
            unit,
            moving_avg,
            CASE 
                WHEN prev_value IS NULL OR prev_value = 0 THEN 'N/A'
                ELSE ROUND(((value - prev_value) / prev_value * 100), 2) || '%'
            END as percent_change
        FROM with_prev_value
        ORDER BY timestamp
    `;

    const db = getDatabase();
    const queryParams = [
        metric_type, metric_type, metric_type, metric_type, metric_type, // For CASE statements
        metric_type, metric_type, metric_type, metric_type, metric_type, // For unit CASE statements
        hostname, protocol, drive_model, cutoffDate.toISOString()
    ];

    // Add optional filter parameters
    if (drive_type) queryParams.push(drive_type);
    if (block_size) queryParams.push(block_size);
    if (read_write_pattern) queryParams.push(read_write_pattern);
    if (queue_depth) queryParams.push(parseInt(queue_depth));
    if (test_size) queryParams.push(test_size);
    if (sync !== undefined && sync !== '') queryParams.push(parseInt(sync));
    if (direct !== undefined && direct !== '') queryParams.push(parseInt(direct));
    if (num_jobs) queryParams.push(parseInt(num_jobs));
    if (duration) queryParams.push(parseInt(duration));

    db.all(query, queryParams, (err, rows) => {
        if (err) {
            logError('Database error fetching trend analysis', err, {
                requestId: req.requestId,
                username: req.user.username,
                action: 'GET_TREND_ANALYSIS'
            });
            res.status(500).json({ error: err.message });
            return;
        }

        logInfo('Trend analysis retrieved successfully', {
            requestId: req.requestId,
            username: req.user.username,
            action: 'GET_TREND_ANALYSIS',
            resultCount: rows.length,
            analysisParams: { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, metric_type, days, test_size, sync, direct, num_jobs, duration }
        });

        res.json(rows);
    });
});

module.exports = router;

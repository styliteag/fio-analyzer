const express = require('express');
const { getDatabase } = require('../database');
const { requireAdmin } = require('../auth');
const { logInfo, logError, requestIdMiddleware } = require('../utils');

const router = express.Router();

// Apply request ID middleware
router.use(requestIdMiddleware);

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
    const { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, start_date, end_date, metric_type } = req.query;
    
    logInfo('User requesting time-series history', {
        requestId: req.requestId,
        username: req.user.username,
        action: 'GET_TIMESERIES_HISTORY',
        filters: { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, start_date, end_date, metric_type }
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
            pm.metric_type,
            pm.value,
            pm.unit
        FROM test_runs tr
        JOIN performance_metrics pm ON tr.id = pm.test_run_id
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
    
    if (metric_type) {
        query += ' AND pm.metric_type = ?';
        params.push(metric_type);
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
    const { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, metric_type, days = 30 } = req.query;
    
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
        days
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
                pm.value,
                pm.unit,
                ROW_NUMBER() OVER (ORDER BY tr.timestamp) as rn
            FROM test_runs tr
            JOIN performance_metrics pm ON tr.id = pm.test_run_id
            WHERE tr.hostname = ? 
            AND tr.protocol = ?
            AND tr.drive_model = ?
            AND pm.metric_type = ?
            AND tr.timestamp >= ?
            ${drive_type ? 'AND tr.drive_type = ?' : ''}
            ${block_size ? 'AND tr.block_size = ?' : ''}
            ${read_write_pattern ? 'AND tr.read_write_pattern = ?' : ''}
            ${queue_depth ? 'AND tr.queue_depth = ?' : ''}
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
    const queryParams = [hostname, protocol, drive_model, metric_type, cutoffDate.toISOString()];
    
    // Add optional filter parameters
    if (drive_type) queryParams.push(drive_type);
    if (block_size) queryParams.push(block_size);
    if (read_write_pattern) queryParams.push(read_write_pattern);
    if (queue_depth) queryParams.push(parseInt(queue_depth));
    
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
            analysisParams: { hostname, protocol, drive_model, drive_type, block_size, read_write_pattern, queue_depth, metric_type, days }
        });
        
        res.json(rows);
    });
});

module.exports = router;
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDatabase, updateLatestFlags, insertMetric, insertLatencyPercentiles } = require('../database');
const { requireAuth } = require('../auth');
const { logInfo, logError, requestIdMiddleware } = require('../utils');

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

// Apply request ID middleware
router.use(requestIdMiddleware);

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
 *                 description: FIO JSON results file
 *               drive_model:
 *                 type: string
 *                 description: Drive model name
 *                 example: "Samsung 980 PRO"
 *               drive_type:
 *                 type: string
 *                 description: Drive type
 *                 example: "NVMe SSD"
 *               hostname:
 *                 type: string
 *                 description: Server hostname
 *                 example: "web-server-01"
 *               protocol:
 *                 type: string
 *                 description: Storage protocol
 *                 example: "Local"
 *               description:
 *                 type: string
 *                 description: Test description
 *                 example: "Performance baseline test"
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Test date (YYYY-MM-DD)
 *                 example: "2025-01-15"
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
 *                   example: [1, 2, 3, 4]
 *                 skipped_jobs:
 *                   type: integer
 *                   example: 0
 *       400:
 *         description: Bad request - Missing required fields or invalid file
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/', requireAuth, upload.single('file'), (req, res) => {
    try {
        const { drive_model, drive_type, hostname, protocol, description, date } = req.body;
        const file = req.file;

        logInfo('User uploading FIO results', {
            requestId: req.requestId,
            username: req.user.username,
            userRole: req.user.role,
            action: 'IMPORT_FIO_RESULTS',
            driveModel: drive_model,
            driveType: drive_type,
            hostname: hostname,
            protocol: protocol,
            filename: file?.originalname
        });

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!drive_model || !drive_type) {
            return res.status(400).json({ error: 'drive_model and drive_type are required' });
        }

        // Parse test date or use current date
        const testDate = date ? new Date(date) : new Date();
        if (isNaN(testDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        // Create directory structure for organized file storage
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hostDir = hostname || 'unknown-host';
        const dateDir = testDate.toISOString().substring(0, 10); // YYYY-MM-DD
        const uploadDir = path.join(__dirname, '..', 'uploads', hostDir, dateDir, timestamp);
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Move uploaded file to organized location
        const finalPath = path.join(uploadDir, 'fio_results.json');
        fs.renameSync(file.path, finalPath);
        
        // Store relative path for database
        const relativeFilePath = path.relative(path.join(__dirname, '..'), finalPath);
        
        // Create metadata file
        const metadataPath = path.join(uploadDir, 'upload.info');
        const metadata = {
            drive_model,
            drive_type,
            hostname,
            protocol,
            description,
            test_date: testDate.toISOString(),
            upload_timestamp: new Date().toISOString(),
            original_filename: file.originalname,
            uploaded_by: req.user.username
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        // Parse FIO JSON data
        const fioData = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
        const jobs = fioData.jobs || [];
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

            // Extract job options for uniqueness and storage
            const output_file = opts.filename || globalOpts.filename || '';
            const num_jobs = parseInt(opts.numjobs || globalOpts.numjobs || '1');
            const direct = parseInt(opts.direct || globalOpts.direct || '0');
            const test_size = opts.size || globalOpts.size || '';
            const sync = parseInt(opts.sync || globalOpts.sync || '0');

            // Create test run object for uniqueness calculation
            const testRunData = {
                drive_type,
                drive_model,
                hostname,
                protocol,
                block_size,
                read_write_pattern: rw,
                output_file,
                num_jobs,
                direct,
                test_size,
                sync,
                iodepth
            };

            // Update existing tests to is_latest = 0 for same configuration
            updateLatestFlags(testRunData, (err) => {
                if (err) {
                    console.error(`Error updating latest flags for job ${test_name}:`, err.message);
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

                // Insert test run with job options fields and is_latest = 1
                const insertTestRun = `
                    INSERT INTO test_runs 
                    (timestamp, test_date, drive_model, drive_type, test_name, block_size, 
                     read_write_pattern, queue_depth, duration, fio_version, 
                     job_runtime, rwmixread, total_ios_read, total_ios_write, 
                     usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
                     output_file, num_jobs, direct, test_size, sync, iodepth, is_latest)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `;

                const db = getDatabase();
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
                    relativeFilePath,
                    output_file,
                    num_jobs,
                    direct,
                    test_size,
                    sync,
                    iodepth
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
                    insertFioMetrics(testRunId, job.read, 'read');
                }

                // Insert performance metrics for write operations  
                if (job.write && job.write.iops > 0) {
                    insertFioMetrics(testRunId, job.write, 'write');
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
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

function insertFioMetrics(testRunId, data, operationType) {
    const metrics = [
        [testRunId, 'iops', data.iops, 'IOPS', operationType],
        [testRunId, 'avg_latency', data.lat_ns.mean / 1000000, 'ms', operationType], // Convert ns to ms
        [testRunId, 'bandwidth', data.bw_bytes / (1024 * 1024), 'MB/s', operationType] // Convert bytes/s to MB/s
    ];

    const db = getDatabase();
    metrics.forEach(metric => {
        insertMetric(metric[0], metric[1], metric[2], metric[3], metric[4], (err) => {
            if (err) console.error('Error inserting metric:', err);
        });
    });
}

module.exports = router;
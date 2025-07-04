const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDatabase, updateLatestFlags, insertMetric, insertLatencyPercentiles } = require('../database');
const { requireAuth } = require('../auth');
const { logInfo, logError, logWarning, requestIdMiddleware } = require('../utils');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
            logInfo('Created uploads directory', { 
                requestId: req.requestId,
                uploadPath 
            });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const filename = `${Date.now()}-${file.originalname}`;
        logInfo('File upload started', { 
            requestId: req.requestId,
            originalName: file.originalname,
            generatedName: filename,
            size: file.size
        });
        cb(null, filename);
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
    const startTime = Date.now();
    
    try {
        const { drive_model, drive_type, hostname, protocol, description, date } = req.body;
        const file = req.file;

        logInfo('Import request started', {
            requestId: req.requestId,
            username: req.user.username,
            userRole: req.user.role,
            action: 'IMPORT_FIO_RESULTS',
            driveModel: drive_model,
            driveType: drive_type,
            hostname: hostname,
            protocol: protocol,
            filename: file?.originalname,
            fileSize: file?.size
        });

        // Log the specific hardware and configuration details
        logInfo('Upload configuration details', {
            requestId: req.requestId,
            username: req.user.username,
            hardware: {
                driveModel: drive_model,
                driveType: drive_type,
                hostname: hostname || 'unknown',
                protocol: protocol || 'unknown'
            },
            testInfo: {
                description: description || 'No description',
                testDate: date || 'Current date'
            }
        });

        // Validate required fields
        if (!file) {
            logError('Import failed - no file uploaded', null, {
                requestId: req.requestId,
                username: req.user.username
            });
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!drive_model || !drive_type) {
            logError('Import failed - missing required fields', null, {
                requestId: req.requestId,
                username: req.user.username,
                missingFields: {
                    driveModel: !drive_model,
                    driveType: !drive_type
                }
            });
            return res.status(400).json({ error: 'drive_model and drive_type are required' });
        }

        // Parse test date or use current date
        const testDate = date ? new Date(date) : new Date();
        if (isNaN(testDate.getTime())) {
            logError('Import failed - invalid date format', null, {
                requestId: req.requestId,
                username: req.user.username,
                providedDate: date
            });
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        logInfo('File validation passed', {
            requestId: req.requestId,
            username: req.user.username,
            testDate: testDate.toISOString(),
            filePath: file.path
        });

        // Create directory structure for organized file storage
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hostDir = hostname || 'unknown-host';
        const dateDir = testDate.toISOString().substring(0, 10); // YYYY-MM-DD
        const uploadDir = path.join(__dirname, '..', 'uploads', hostDir, dateDir, timestamp);
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            logInfo('Created organized upload directory', {
                requestId: req.requestId,
                uploadDir,
                hostDir,
                dateDir,
                timestamp
            });
        }

        // Move uploaded file to organized location
        const finalPath = path.join(uploadDir, 'fio_results.json');
        fs.renameSync(file.path, finalPath);
        
        logInfo('File moved to organized location', {
            requestId: req.requestId,
            originalPath: file.path,
            finalPath,
            fileSize: fs.statSync(finalPath).size
        });
        
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

        logInfo('Metadata file created', {
            requestId: req.requestId,
            metadataPath,
            metadataKeys: Object.keys(metadata)
        });

        // Parse FIO JSON data
        logInfo('Parsing FIO JSON data', {
            requestId: req.requestId,
            filePath: finalPath
        });

        const fioData = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
        const jobs = fioData.jobs || [];
        const globalOpts = fioData['global options'] || {};

        logInfo('FIO data parsed successfully', {
            requestId: req.requestId,
            totalJobs: jobs.length,
            fioVersion: fioData['fio version'],
            globalOptions: Object.keys(globalOpts)
        });

        const importedTestRuns = [];
        let completedJobs = 0;
        let skippedJobs = 0;
        let errorJobs = 0;
        let successfulDbInserts = 0;
        let failedDbInserts = 0;

        // Process each job
        jobs.forEach((job, jobIndex) => {
            logInfo('Processing job', {
                requestId: req.requestId,
                jobIndex: jobIndex + 1,
                totalJobs: jobs.length,
                jobName: job.jobname || `fio_job_${jobIndex + 1}`,
                hasError: job.error && job.error !== 0
            });

            // Skip jobs with errors or no valid data
            if (job.error && job.error !== 0) {
                logWarning('Skipping job with error', {
                    requestId: req.requestId,
                    jobIndex: jobIndex + 1,
                    jobName: job.jobname || `fio_job_${jobIndex + 1}`,
                    error: job.error
                });
                skippedJobs++;
                completedJobs++;
                if (completedJobs === jobs.length) {
                    const totalTime = Date.now() - startTime;
                    logInfo('Import completed with skipped jobs', {
                        requestId: req.requestId,
                        username: req.user.username,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        },
                        statistics: {
                            totalJobs: jobs.length,
                            importedJobs: importedTestRuns.length,
                            skippedJobs,
                            errorJobs,
                            successfulDbInserts,
                            failedDbInserts
                        },
                        totalTime: `${totalTime}ms`
                    });
                    res.json({ 
                        message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                        test_run_ids: importedTestRuns,
                        skipped_jobs: skippedJobs
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

            logInfo('Job parameters extracted', {
                requestId: req.requestId,
                jobIndex: jobIndex + 1,
                testName: test_name,
                blockSize: block_size,
                readWritePattern: rw,
                ioDepth: iodepth,
                duration,
                rwMixRead: rwmixread
            });

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

            logInfo('Updating latest flags for job', {
                requestId: req.requestId,
                jobIndex: jobIndex + 1,
                testName: test_name,
                uniqueKey: `${drive_type}|${drive_model}|${hostname}|${protocol}|${block_size}|${rw}`
            });

            // Update existing tests to is_latest = 0 for same configuration
            updateLatestFlags(testRunData, (err) => {
                if (err) {
                    logError('Error updating latest flags for job', err, {
                        requestId: req.requestId,
                        jobIndex: jobIndex + 1,
                        testName: test_name,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        }
                    });
                    errorJobs++;
                    completedJobs++;
                    if (completedJobs === jobs.length) {
                        const totalTime = Date.now() - startTime;
                        logInfo('Import completed with errors', {
                            requestId: req.requestId,
                            username: req.user.username,
                            hardware: {
                                driveModel: drive_model,
                                driveType: drive_type,
                                hostname: hostname || 'unknown',
                                protocol: protocol || 'unknown'
                            },
                            statistics: {
                                totalJobs: jobs.length,
                                importedJobs: importedTestRuns.length,
                                skippedJobs,
                                errorJobs,
                                successfulDbInserts,
                                failedDbInserts
                            },
                            totalTime: `${totalTime}ms`
                        });
                        res.json({ 
                            message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                            test_run_ids: importedTestRuns,
                            skipped_jobs: skippedJobs
                        });
                    }
                    return;
                }

                logInfo('Latest flags updated successfully', {
                    requestId: req.requestId,
                    jobIndex: jobIndex + 1,
                    testName: test_name
                });

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
                    logError('Database insertion failed for job', err, {
                        requestId: req.requestId,
                        jobIndex: jobIndex + 1,
                        testName: test_name,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        },
                        dbOperation: 'INSERT_TEST_RUN'
                    });
                    failedDbInserts++;
                    errorJobs++;
                    completedJobs++;
                    if (completedJobs === jobs.length) {
                        const totalTime = Date.now() - startTime;
                        logInfo('Import completed with database errors', {
                            requestId: req.requestId,
                            username: req.user.username,
                            hardware: {
                                driveModel: drive_model,
                                driveType: drive_type,
                                hostname: hostname || 'unknown',
                                protocol: protocol || 'unknown'
                            },
                            statistics: {
                                totalJobs: jobs.length,
                                importedJobs: importedTestRuns.length,
                                skippedJobs,
                                errorJobs,
                                successfulDbInserts,
                                failedDbInserts
                            },
                            totalTime: `${totalTime}ms`
                        });
                        res.json({ 
                            message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                            test_run_ids: importedTestRuns,
                            skipped_jobs: skippedJobs
                        });
                    }
                    return;
                }

                const testRunId = this.lastID;
                importedTestRuns.push(testRunId);
                successfulDbInserts++;

                logInfo('Database insertion successful for job', {
                    requestId: req.requestId,
                    jobIndex: jobIndex + 1,
                    testName: test_name,
                    testRunId,
                    lastID: this.lastID,
                    hardware: {
                        driveModel: drive_model,
                        driveType: drive_type,
                        hostname: hostname || 'unknown',
                        protocol: protocol || 'unknown'
                    },
                    dbOperation: 'INSERT_TEST_RUN',
                    success: true
                });

                // Insert performance metrics for read operations
                if (job.read && job.read.iops > 0) {
                    logInfo('Inserting read metrics', {
                        requestId: req.requestId,
                        jobIndex: jobIndex + 1,
                        testRunId,
                        readIOPS: job.read.iops,
                        readLatency: job.read.lat_ns?.mean,
                        readBandwidth: job.read.bw_bytes,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        }
                    });
                    insertFioMetrics(testRunId, job.read, 'read');
                }

                // Insert performance metrics for write operations  
                if (job.write && job.write.iops > 0) {
                    logInfo('Inserting write metrics', {
                        requestId: req.requestId,
                        jobIndex: jobIndex + 1,
                        testRunId,
                        writeIOPS: job.write.iops,
                        writeLatency: job.write.lat_ns?.mean,
                        writeBandwidth: job.write.bw_bytes,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        }
                    });
                    insertFioMetrics(testRunId, job.write, 'write');
                }

                // Insert latency percentiles
                if (job.read?.clat_ns?.percentile) {
                    logInfo('Inserting read latency percentiles', {
                        requestId: req.requestId,
                        jobIndex: jobIndex + 1,
                        testRunId,
                        percentileCount: Object.keys(job.read.clat_ns.percentile).length,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        }
                    });
                    
                    // Insert each percentile individually
                    const percentiles = job.read.clat_ns.percentile;
                    let percentileCount = 0;
                    const totalPercentiles = Object.keys(percentiles).length;
                    
                    Object.entries(percentiles).forEach(([percentile, latencyNs]) => {
                        if (latencyNs && typeof latencyNs === 'number' && latencyNs > 0) {
                            db.run(
                                'INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns) VALUES (?, ?, ?, ?)',
                                [testRunId, 'read', parseFloat(percentile), Math.floor(latencyNs)],
                                (err) => {
                                    if (err) {
                                        logError('Error inserting read latency percentile', err, {
                                            requestId: req.requestId,
                                            testRunId,
                                            percentile,
                                            latencyNs,
                                            operationType: 'read'
                                        });
                                    }
                                    percentileCount++;
                                    if (percentileCount === totalPercentiles) {
                                        logInfo('Read latency percentiles insertion completed', {
                                            requestId: req.requestId,
                                            testRunId,
                                            inserted: percentileCount,
                                            total: totalPercentiles
                                        });
                                    }
                                }
                            );
                        } else {
                            logWarning('Skipping invalid read latency percentile', {
                                requestId: req.requestId,
                                testRunId,
                                percentile,
                                latencyNs,
                                reason: 'invalid_value'
                            });
                            percentileCount++;
                            if (percentileCount === totalPercentiles) {
                                logInfo('Read latency percentiles insertion completed', {
                                    requestId: req.requestId,
                                    testRunId,
                                    inserted: percentileCount,
                                    total: totalPercentiles
                                });
                            }
                        }
                    });
                }
                
                if (job.write?.clat_ns?.percentile) {
                    logInfo('Inserting write latency percentiles', {
                        requestId: req.requestId,
                        jobIndex: jobIndex + 1,
                        testRunId,
                        percentileCount: Object.keys(job.write.clat_ns.percentile).length,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        }
                    });
                    
                    // Insert each percentile individually
                    const percentiles = job.write.clat_ns.percentile;
                    let percentileCount = 0;
                    const totalPercentiles = Object.keys(percentiles).length;
                    
                    Object.entries(percentiles).forEach(([percentile, latencyNs]) => {
                        if (latencyNs && typeof latencyNs === 'number' && latencyNs > 0) {
                            db.run(
                                'INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns) VALUES (?, ?, ?, ?)',
                                [testRunId, 'write', parseFloat(percentile), Math.floor(latencyNs)],
                                (err) => {
                                    if (err) {
                                        logError('Error inserting write latency percentile', err, {
                                            requestId: req.requestId,
                                            testRunId,
                                            percentile,
                                            latencyNs,
                                            operationType: 'write'
                                        });
                                    }
                                    percentileCount++;
                                    if (percentileCount === totalPercentiles) {
                                        logInfo('Write latency percentiles insertion completed', {
                                            requestId: req.requestId,
                                            testRunId,
                                            inserted: percentileCount,
                                            total: totalPercentiles
                                        });
                                    }
                                }
                            );
                        } else {
                            logWarning('Skipping invalid write latency percentile', {
                                requestId: req.requestId,
                                testRunId,
                                percentile,
                                latencyNs,
                                reason: 'invalid_value'
                            });
                            percentileCount++;
                            if (percentileCount === totalPercentiles) {
                                logInfo('Write latency percentiles insertion completed', {
                                    requestId: req.requestId,
                                    testRunId,
                                    inserted: percentileCount,
                                    total: totalPercentiles
                                });
                            }
                        }
                    });
                }

                completedJobs++;
                if (completedJobs === jobs.length) {
                    const totalTime = Date.now() - startTime;
                    logInfo('Import completed successfully', {
                        requestId: req.requestId,
                        username: req.user.username,
                        hardware: {
                            driveModel: drive_model,
                            driveType: drive_type,
                            hostname: hostname || 'unknown',
                            protocol: protocol || 'unknown'
                        },
                        statistics: {
                            totalJobs: jobs.length,
                            importedJobs: importedTestRuns.length,
                            skippedJobs,
                            errorJobs,
                            successfulDbInserts,
                            failedDbInserts
                        },
                        totalTime: `${totalTime}ms`,
                        testRunIds: importedTestRuns
                    });
                    res.json({ 
                        message: `FIO results imported successfully. Processed ${importedTestRuns.length} out of ${jobs.length} jobs.`,
                        test_run_ids: importedTestRuns,
                        skipped_jobs: skippedJobs
                    });
                }
                });
            });
        });

    } catch (error) {
        const totalTime = Date.now() - startTime;
        logError('Import failed with exception', error, {
            requestId: req.requestId,
            username: req.user?.username,
            hardware: {
                driveModel: req.body?.drive_model,
                driveType: req.body?.drive_type,
                hostname: req.body?.hostname || 'unknown',
                protocol: req.body?.protocol || 'unknown'
            },
            totalTime: `${totalTime}ms`
        });
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
            if (err) {
                logError('Error inserting metric', err, {
                    testRunId,
                    operationType,
                    metricType: metric[1],
                    value: metric[2],
                    unit: metric[3],
                    dbOperation: 'INSERT_METRIC',
                    hardware: {
                        // Note: We don't have direct access to hardware info here,
                        // but the parent function logs will show the context
                        testRunId: testRunId
                    }
                });
            } else {
                logInfo('Metric inserted successfully', {
                    testRunId,
                    operationType,
                    metricType: metric[1],
                    value: metric[2],
                    unit: metric[3],
                    dbOperation: 'INSERT_METRIC',
                    success: true
                });
            }
        });
    });
}

module.exports = router;
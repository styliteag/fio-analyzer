const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database');
const { requireAuth } = require('../auth');
const { logInfo, logError, logWarning, requestIdMiddleware } = require('../utils');
const { processFioFile, discoverUploadedFiles } = require('../scripts/import-utils');

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
        const isodate = testDate.toISOString().substring(0, 10);
        const isotime = testDate.toISOString().substring(11, 16).replace(/[:.]/g, '-');
        const hostDir = hostname || 'unknown-host';
        const protocolDir = protocol || 'unknown-protocol';
        const driveTypeDir = drive_type || 'unknown-drive-type';
        const driveModelDir = drive_model || 'unknown-drive-model';
        //const testPattern = || 'unknown-test-pattern';
        const uploadDir = path.join(__dirname, '..', 'uploads', hostDir, protocolDir, isodate , isotime, driveTypeDir, driveModelDir);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            logInfo('Created organized upload directory', {
                requestId: req.requestId,
                uploadDir
            });
        }

        // Move uploaded file to organized location
        const finalPath = path.join(uploadDir, 'fio_results_' + timestamp + '.json');
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
        const metadataPath = path.join(uploadDir, 'fio_results_' + timestamp + '.info');
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
            // Get duration from multiple possible sources, prefer actual runtime over configured
            const duration = Math.round((job.job_runtime || 0) / 1000) || // Actual runtime in ms -> seconds
                           parseInt(opts.runtime || globalOpts.runtime || '0'); // Configured runtime in seconds
            const test_name = opts.name || job.jobname || `fio_job_${jobIndex + 1}`;
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



            logInfo('Processing job for database insertion', {
                requestId: req.requestId,
                jobIndex: jobIndex + 1,
                testName: test_name,
                uniqueKey: `${drive_type}|${drive_model}|${hostname}|${protocol}|${block_size}|${rw}`
            });

                // Prepare data for insertion into both tables
                const insertData = [
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
                ];

                // Calculate performance metrics from job data
                const readData = job.read || {};
                const writeData = job.write || {};

                // Use read data if available, otherwise write data, otherwise null
                const avgLatency = (readData.lat_ns?.mean || writeData.lat_ns?.mean) ?
                    (readData.lat_ns?.mean || writeData.lat_ns?.mean) / 1000000 : null; // Convert ns to ms
                const bandwidth = (readData.bw_bytes || writeData.bw_bytes) ?
                    (readData.bw_bytes || writeData.bw_bytes) / (1024 * 1024) : null; // Convert to MB/s
                const iops = readData.iops || writeData.iops || null;
                const p95Latency = (readData.lat_ns?.percentile?.p95 || writeData.lat_ns?.percentile?.p95) ?
                    (readData.lat_ns?.percentile?.p95 || writeData.lat_ns?.percentile?.p95) / 1000000 : null;
                const p99Latency = (readData.lat_ns?.percentile?.p99 || writeData.lat_ns?.percentile?.p99) ?
                    (readData.lat_ns?.percentile?.p99 || writeData.lat_ns?.percentile?.p99) / 1000000 : null;

                // Add performance metrics to insertData
                const insertDataWithMetrics = [...insertData, avgLatency, bandwidth, iops, p95Latency, p99Latency];

                // Insert test run into latest table with is_latest = 1 (use REPLACE to handle duplicates)
                const insertTestRun = `
                    INSERT OR REPLACE INTO test_runs 
                    (timestamp, test_date, drive_model, drive_type, test_name, block_size, 
                     read_write_pattern, queue_depth, duration, fio_version, 
                     job_runtime, rwmixread, total_ios_read, total_ios_write, 
                     usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
                     output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                     avg_latency, bandwidth, iops, p95_latency, p99_latency)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
                `;

                // Insert test run into historical table with is_latest = 1
                const insertTestRunAll = `
                    INSERT INTO test_runs_all 
                    (timestamp, test_date, drive_model, drive_type, test_name, block_size, 
                     read_write_pattern, queue_depth, duration, fio_version, 
                     job_runtime, rwmixread, total_ios_read, total_ios_write, 
                     usr_cpu, sys_cpu, hostname, protocol, description, uploaded_file_path,
                     output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                     avg_latency, bandwidth, iops, p95_latency, p99_latency)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
                `;

                const db = getDatabase();
                db.run(insertTestRun, insertDataWithMetrics, function(err) {
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

                // Now insert into test_runs_all (historical data)
                db.run(insertTestRunAll, insertDataWithMetrics, function(errAll) {
                    const testRunIdAll = this.lastID;

                    if (errAll) {
                        logError('Database insertion failed for test_runs_all', errAll, {
                            requestId: req.requestId,
                            jobIndex: jobIndex + 1,
                            testName: test_name,
                            testRunId,
                            dbOperation: 'INSERT_TEST_RUN_ALL'
                        });
                        // Continue anyway - we have the main record
                    } else {
                        logInfo('Database insertion successful for both tables', {
                            requestId: req.requestId,
                            jobIndex: jobIndex + 1,
                            testName: test_name,
                            testRunId,
                            testRunIdAll,
                            hardware: {
                                driveModel: drive_model,
                                driveType: drive_type,
                                hostname: hostname || 'unknown',
                                protocol: protocol || 'unknown'
                            },
                            dbOperation: 'INSERT_TEST_RUN_DUAL',
                            success: true
                        });
                    }

                    importedTestRuns.push(testRunId);
                    successfulDbInserts++;

                    // Performance metrics are now included in the main INSERT statements
                    // No need for separate metric insertion

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
        }); // Close jobs.forEach loop

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



/**
 * @swagger
 * /api/import/bulk:
 *   post:
 *     summary: Bulk import all uploaded FIO files
 *     description: Process all uploaded FIO JSON files in the uploads directory
 *     tags: [Import]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               overwrite:
 *                 type: boolean
 *                 description: Whether to overwrite existing files
 *                 default: false
 *               dryRun:
 *                 type: boolean
 *                 description: Preview what would be imported without making changes
 *                 default: false
 *     responses:
 *       200:
 *         description: Bulk import completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bulk import completed. Processed 5 files, 20 test runs imported."
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: integer
 *                       example: 5
 *                     processedFiles:
 *                       type: integer
 *                       example: 5
 *                     totalTestRuns:
 *                       type: integer
 *                       example: 20
 *                     skippedFiles:
 *                       type: integer
 *                       example: 0
 *                     errorFiles:
 *                       type: integer
 *                       example: 0
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/bulk', requireAuth, async (req, res) => {
    const startTime = Date.now();
    const { overwrite = false, dryRun = false } = req.body;

    try {
        logInfo('Bulk import request started', {
            requestId: req.requestId,
            username: req.user.username,
            userRole: req.user.role,
            action: 'BULK_IMPORT_FIO_RESULTS',
            options: {
                overwrite,
                dryRun
            }
        });

        if (dryRun) {
            logInfo('Bulk import dry run mode', {
                requestId: req.requestId,
                username: req.user.username
            });
        }

        if (overwrite) {
            logInfo('Bulk import overwrite mode enabled', {
                requestId: req.requestId,
                username: req.user.username
            });
        }

        // Discover uploaded files
        const uploadsDir = path.join(__dirname, '..', 'uploads');

        if (!fs.existsSync(uploadsDir)) {
            logError('Bulk import failed - uploads directory does not exist', null, {
                requestId: req.requestId,
                username: req.user.username,
                uploadsDir
            });
            return res.status(400).json({ error: 'Uploads directory does not exist' });
        }

        const filePairs = await discoverUploadedFiles(uploadsDir);

        if (filePairs.length === 0) {
            logInfo('Bulk import - no files found', {
                requestId: req.requestId,
                username: req.user.username
            });
            return res.json({
                message: 'No FIO JSON files found to import.',
                statistics: {
                    totalFiles: 0,
                    processedFiles: 0,
                    totalTestRuns: 0,
                    skippedFiles: 0,
                    errorFiles: 0
                }
            });
        }

        logInfo('Bulk import - files discovered', {
            requestId: req.requestId,
            username: req.user.username,
            fileCount: filePairs.length
        });

        if (dryRun) {
            const dryRunResults = filePairs.map(pair => ({
                path: pair.jsonPath,
                metadata: pair.metadata
            }));

            return res.json({
                message: `Dry run completed. ${filePairs.length} files would be processed.`,
                statistics: {
                    totalFiles: filePairs.length,
                    processedFiles: 0,
                    totalTestRuns: 0,
                    skippedFiles: 0,
                    errorFiles: 0
                },
                dryRunResults
            });
        }

        // Process files in chronological order
        let totalProcessed = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let totalTestRuns = 0;

        for (let i = 0; i < filePairs.length; i++) {
            const pair = filePairs[i];
            const fileNumber = i + 1;

            try {
                logInfo('Bulk import - processing file', {
                    requestId: req.requestId,
                    username: req.user.username,
                    fileNumber,
                    totalFiles: filePairs.length,
                    filePath: pair.jsonPath,
                    metadata: pair.metadata
                });

                // Process the file
                const result = await processFioFile(pair.jsonPath, pair.metadata, {
                    overwrite,
                    requestId: `${req.requestId}-${fileNumber}`
                });

                totalProcessed++;
                totalTestRuns += result.testRuns.length;

                if (result.skipped > 0) {
                    totalSkipped += result.skipped;
                }

                logInfo('Bulk import - file processed successfully', {
                    requestId: req.requestId,
                    username: req.user.username,
                    fileNumber,
                    totalFiles: filePairs.length,
                    testRunsImported: result.testRuns.length,
                    skippedJobs: result.skipped
                });

            } catch (error) {
                totalErrors++;
                logError('Bulk import - file processing failed', error, {
                    requestId: req.requestId,
                    username: req.user.username,
                    fileNumber,
                    totalFiles: filePairs.length,
                    filePath: pair.jsonPath
                });
            }
        }

        const totalTime = Date.now() - startTime;

        logInfo('Bulk import completed', {
            requestId: req.requestId,
            username: req.user.username,
            statistics: {
                totalFiles: filePairs.length,
                processedFiles: totalProcessed,
                totalTestRuns,
                skippedFiles: totalSkipped,
                errorFiles: totalErrors
            },
            totalTime: `${totalTime}ms`
        });

        res.json({
            message: `Bulk import completed. Processed ${totalProcessed} files, ${totalTestRuns} test runs imported.`,
            statistics: {
                totalFiles: filePairs.length,
                processedFiles: totalProcessed,
                totalTestRuns,
                skippedFiles: totalSkipped,
                errorFiles: totalErrors
            }
        });

    } catch (error) {
        const totalTime = Date.now() - startTime;
        logError('Bulk import failed with exception', error, {
            requestId: req.requestId,
            username: req.user?.username,
            totalTime: `${totalTime}ms`
        });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

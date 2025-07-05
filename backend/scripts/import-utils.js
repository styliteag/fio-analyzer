const fs = require('fs');
const path = require('path');
const { getDatabase, updateLatestFlags, insertMetric, insertLatencyPercentiles } = require('../database');
const { logInfo, logError, logWarning, calculateUniqueKey } = require('../utils');

/**
 * Core FIO import utilities extracted from routes/import.js
 * These functions can be used both by the web API and CLI import tools
 */

/**
 * Check if a test run with the same unique configuration already exists in the database
 * @param {Object} testRunData - Test run configuration object
 * @returns {Promise<boolean>} - True if file exists, false otherwise
 */
async function checkFileExistsInDb(testRunData) {
    return new Promise((resolve, reject) => {
        const uniqueKey = calculateUniqueKey(testRunData);
        const db = getDatabase();
        
        const query = `
            SELECT id FROM test_runs 
            WHERE drive_type = ? AND drive_model = ? AND hostname = ? AND protocol = ? 
            AND block_size = ? AND read_write_pattern = ? AND output_file = ? AND num_jobs = ? 
            AND direct = ? AND test_size = ? AND sync = ? AND iodepth = ?
            LIMIT 1
        `;
        
        const params = [
            testRunData.drive_type || null,
            testRunData.drive_model || null,
            testRunData.hostname || null,
            testRunData.protocol || null,
            testRunData.block_size || null,
            testRunData.read_write_pattern || null,
            testRunData.output_file || null,
            testRunData.num_jobs || null,
            testRunData.direct || null,
            testRunData.test_size || null,
            testRunData.sync || null,
            testRunData.iodepth || null
        ];
        
        db.get(query, params, (err, row) => {
            if (err) {
                logError('Error checking file existence in database', err, { uniqueKey });
                reject(err);
                return;
            }
            resolve(!!row);
        });
    });
}

/**
 * Process a single FIO JSON file with its metadata
 * @param {string} jsonFilePath - Path to the FIO JSON file
 * @param {Object} metadata - Metadata from the .info file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Import result with statistics
 */
async function processFioFile(jsonFilePath, metadata, options = {}) {
    const requestId = options.requestId || 'cli-import';
    
    try {
        logInfo('Processing FIO file', {
            requestId,
            filePath: jsonFilePath,
            driveModel: metadata.drive_model,
            driveType: metadata.drive_type,
            hostname: metadata.hostname,
            protocol: metadata.protocol
        });

        // Parse FIO JSON data
        const fioData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        const jobs = fioData.jobs || [];
        const globalOpts = fioData['global options'] || {};

        logInfo('FIO data parsed successfully', {
            requestId,
            totalJobs: jobs.length,
            fioVersion: fioData['fio version'],
            globalOptions: Object.keys(globalOpts)
        });

        const importedTestRuns = [];
        let completedJobs = 0;
        let skippedJobs = 0;
        let errorJobs = 0;

        // Store relative path for database
        const relativeFilePath = path.relative(path.join(__dirname, '..'), jsonFilePath);
        
        // Parse test date
        const testDate = metadata.test_date ? new Date(metadata.test_date) : new Date();

        // Process each job
        const processJobPromises = jobs.map((job, jobIndex) => {
            return new Promise((resolve) => {
                logInfo('Processing job', {
                    requestId,
                    jobIndex: jobIndex + 1,
                    totalJobs: jobs.length,
                    jobName: job.jobname || `fio_job_${jobIndex + 1}`,
                    hasError: job.error && job.error !== 0
                });

                // Skip jobs with errors or no valid data
                if (job.error && job.error !== 0) {
                    logWarning('Skipping job with error', {
                        requestId,
                        jobIndex: jobIndex + 1,
                        jobName: job.jobname || `fio_job_${jobIndex + 1}`,
                        error: job.error
                    });
                    skippedJobs++;
                    resolve({ status: 'skipped', reason: 'fio_error' });
                    return;
                }

                const opts = job['job options'] || {};

                // Extract test parameters
                const bs = opts.bs || globalOpts.bs || '4k';
                const bsStr = bs.toString().toUpperCase();
                const block_size = bsStr;
                const rw = opts.rw || globalOpts.rw || 'read';
                const iodepth = parseInt(opts.iodepth || globalOpts.iodepth || '1');
                
                // Get duration from multiple possible sources, prefer actual runtime over configured
                const duration = Math.round((job.job_runtime || 0) / 1000) || // Actual runtime in ms -> seconds
                               parseInt(opts.runtime || globalOpts.runtime || '0'); // Configured runtime in seconds
                
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
                    drive_type: metadata.drive_type,
                    drive_model: metadata.drive_model,
                    hostname: metadata.hostname,
                    protocol: metadata.protocol,
                    block_size,
                    read_write_pattern: rw,
                    output_file,
                    num_jobs,
                    direct,
                    test_size,
                    sync,
                    iodepth
                };

                logInfo('Job parameters extracted', {
                    requestId,
                    jobIndex: jobIndex + 1,
                    testName: test_name,
                    blockSize: block_size,
                    readWritePattern: rw,
                    ioDepth: iodepth,
                    duration,
                    rwMixRead: rwmixread
                });

                // Check if file already exists (if not overwriting)
                if (!options.overwrite) {
                    checkFileExistsInDb(testRunData).then(exists => {
                        if (exists) {
                            logInfo('Skipping job - already exists in database', {
                                requestId,
                                jobIndex: jobIndex + 1,
                                testName: test_name,
                                uniqueKey: calculateUniqueKey(testRunData)
                            });
                            skippedJobs++;
                            resolve({ status: 'skipped', reason: 'already_exists' });
                            return;
                        }
                        
                        // Process the job if it doesn't exist
                        processJob();
                    }).catch(err => {
                        logError('Error checking file existence', err, {
                            requestId,
                            jobIndex: jobIndex + 1,
                            testName: test_name
                        });
                        errorJobs++;
                        resolve({ status: 'error', reason: 'db_check_failed', error: err.message });
                    });
                } else {
                    // Process the job (overwrite mode)
                    processJob();
                }

                function processJob() {
                    // Update existing tests to is_latest = 0 for same configuration
                    updateLatestFlags(testRunData, (err) => {
                        if (err) {
                            logError('Error updating latest flags for job', err, {
                                requestId,
                                jobIndex: jobIndex + 1,
                                testName: test_name
                            });
                            errorJobs++;
                            resolve({ status: 'error', reason: 'update_flags_failed', error: err.message });
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
                            metadata.drive_model,
                            metadata.drive_type,
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
                            metadata.hostname,
                            metadata.protocol,
                            metadata.description,
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
                                    requestId,
                                    jobIndex: jobIndex + 1,
                                    testName: test_name
                                });
                                errorJobs++;
                                resolve({ status: 'error', reason: 'db_insert_failed', error: err.message });
                                return;
                            }

                            const testRunId = this.lastID;
                            importedTestRuns.push(testRunId);

                            logInfo('Database insertion successful for job', {
                                requestId,
                                jobIndex: jobIndex + 1,
                                testName: test_name,
                                testRunId,
                                success: true
                            });

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
                                insertLatencyPercentilesFromJob(testRunId, job.read.clat_ns.percentile, 'read', requestId);
                            }
                            
                            if (job.write?.clat_ns?.percentile) {
                                insertLatencyPercentilesFromJob(testRunId, job.write.clat_ns.percentile, 'write', requestId);
                            }

                            resolve({ status: 'success', testRunId });
                        });
                    });
                }
            });
        });

        // Wait for all jobs to complete
        const results = await Promise.all(processJobPromises);

        // Calculate final statistics
        const successCount = results.filter(r => r.status === 'success').length;
        const skipCount = results.filter(r => r.status === 'skipped').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        return {
            status: 'completed',
            totalJobs: jobs.length,
            successCount,
            skipCount,
            errorCount,
            importedTestRuns: results.filter(r => r.testRunId).map(r => r.testRunId),
            filePath: jsonFilePath
        };

    } catch (error) {
        logError('FIO file processing failed', error, {
            requestId,
            filePath: jsonFilePath
        });
        return {
            status: 'error',
            error: error.message,
            filePath: jsonFilePath
        };
    }
}

/**
 * Insert FIO metrics (extracted from routes/import.js)
 */
function insertFioMetrics(testRunId, data, operationType) {
    const metrics = [
        [testRunId, 'iops', data.iops, 'IOPS', operationType],
        [testRunId, 'avg_latency', data.lat_ns.mean / 1000000, 'ms', operationType], // Convert ns to ms
        [testRunId, 'bandwidth', data.bw_bytes / (1024 * 1024), 'MB/s', operationType] // Convert bytes/s to MB/s
    ];

    metrics.forEach(metric => {
        insertMetric(metric[0], metric[1], metric[2], metric[3], metric[4], (err) => {
            if (err) {
                logError('Error inserting metric', err, {
                    testRunId,
                    operationType,
                    metricType: metric[1],
                    value: metric[2],
                    unit: metric[3]
                });
            } else {
                logInfo('Metric inserted successfully', {
                    testRunId,
                    operationType,
                    metricType: metric[1],
                    value: metric[2],
                    unit: metric[3]
                });
            }
        });
    });
}

/**
 * Insert latency percentiles from job data
 */
function insertLatencyPercentilesFromJob(testRunId, percentiles, operationType, requestId) {
    const db = getDatabase();
    
    Object.entries(percentiles).forEach(([percentile, latencyNs]) => {
        if (latencyNs && typeof latencyNs === 'number' && latencyNs > 0) {
            db.run(
                'INSERT INTO latency_percentiles (test_run_id, operation_type, percentile, latency_ns) VALUES (?, ?, ?, ?)',
                [testRunId, operationType, parseFloat(percentile), Math.floor(latencyNs)],
                (err) => {
                    if (err) {
                        logError('Error inserting latency percentile', err, {
                            requestId,
                            testRunId,
                            percentile,
                            latencyNs,
                            operationType
                        });
                    }
                }
            );
        } else {
            logWarning('Skipping invalid latency percentile', {
                requestId,
                testRunId,
                percentile,
                latencyNs,
                reason: 'invalid_value'
            });
        }
    });
}

/**
 * Discover all uploaded files in the uploads directory
 * @param {string} uploadsDir - Path to uploads directory
 * @returns {Array} - Array of file pairs with JSON and info paths
 */
async function discoverUploadedFiles(uploadsDir) {
    const filePairs = [];
    
    function scanDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.json') && item.startsWith('fio_results_')) {
                // Find corresponding .info file
                const infoFile = item.replace('fio_results_', 'upload_').replace('.json', '.info');
                const infoPath = path.join(dir, infoFile);
                
                if (fs.existsSync(infoPath)) {
                    try {
                        const metadata = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                        filePairs.push({
                            jsonPath: fullPath,
                            infoPath: infoPath,
                            metadata: metadata,
                            uploadTimestamp: new Date(metadata.upload_timestamp)
                        });
                    } catch (err) {
                        logWarning('Skipping file with invalid metadata', {
                            jsonPath: fullPath,
                            infoPath: infoPath,
                            error: err.message
                        });
                    }
                } else {
                    logWarning('Skipping JSON file without corresponding info file', {
                        jsonPath: fullPath,
                        expectedInfoPath: infoPath
                    });
                }
            }
        }
    }
    
    scanDirectory(uploadsDir);
    
    // Sort by upload timestamp to process in chronological order
    filePairs.sort((a, b) => a.uploadTimestamp - b.uploadTimestamp);
    
    logInfo('File discovery completed', {
        totalFiles: filePairs.length,
        uploadsDir
    });
    
    return filePairs;
}

module.exports = {
    processFioFile,
    checkFileExistsInDb,
    discoverUploadedFiles,
    insertFioMetrics,
    insertLatencyPercentilesFromJob
};
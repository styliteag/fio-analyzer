#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../database');
const { logInfo, logError, generateRequestId } = require('../utils');
const { processFioFile, discoverUploadedFiles } = require('./import-utils');

/**
 * FIO Analyzer Bulk Import Tool
 * Processes all uploaded FIO JSON files in the backend/uploads directory
 */

// CLI argument parsing
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
        overwrite: false,
        dryRun: false,
        verbose: false,
        uploadsDir: path.join(__dirname, '..', 'uploads')
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--overwrite':
                options.overwrite = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--uploads-dir':
                if (i + 1 < args.length) {
                    options.uploadsDir = args[i + 1];
                    i++; // Skip next argument
                } else {
                    console.error('Error: --uploads-dir requires a directory path');
                    process.exit(1);
                }
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
            default:
                console.error(`Error: Unknown argument: ${arg}`);
                showHelp();
                process.exit(1);
        }
    }

    return options;
}

function showHelp() {
    console.log(`
🔄 FIO Analyzer Bulk Import Tool
================================

Usage: node scripts/import-all.js [options]

Options:
  --overwrite           Reimport files that already exist in database
  --dry-run            Preview what would be imported without making changes
  --verbose            Show detailed progress information
  --uploads-dir <path> Specify custom uploads directory (default: backend/uploads)
  --help, -h           Show this help message

Examples:
  npm run importall                    # Import new files only
  npm run importall:overwrite          # Import all files, overwriting existing
  npm run importall:dry-run            # Preview without importing
  
  node scripts/import-all.js --verbose                    # Detailed output
  node scripts/import-all.js --overwrite --uploads-dir ./custom-uploads
`);
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function main() {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const options = parseArguments();

    console.log(`
🔄 FIO Analyzer Bulk Import Tool
================================
`);

    if (options.dryRun) {
        console.log('🔍 DRY RUN MODE: No changes will be made to the database\n');
    }

    if (options.overwrite) {
        console.log('⚠️  OVERWRITE MODE: Existing files will be reimported\n');
    }

    try {
        // Initialize database connection
        logInfo('Initializing database connection', { requestId });
        if (!options.dryRun) {
            initDatabase();
            // Wait a moment for database initialization
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Discover uploaded files
        console.log(`🔍 Discovering files in ${options.uploadsDir}...`);

        if (!fs.existsSync(options.uploadsDir)) {
            console.error(`❌ Error: Uploads directory does not exist: ${options.uploadsDir}`);
            process.exit(1);
        }

        const filePairs = await discoverUploadedFiles(options.uploadsDir);

        if (filePairs.length === 0) {
            console.log('📭 No FIO JSON files found to import.');
            process.exit(0);
        }

        console.log(`📁 Found ${filePairs.length} JSON files with metadata\n`);

        if (options.verbose) {
            console.log('Files to process (in chronological order):');
            filePairs.forEach((pair, index) => {
                const relativePath = path.relative(options.uploadsDir, pair.jsonPath);
                console.log(`  [${index + 1}] ${relativePath} (${pair.metadata.upload_timestamp})`);
            });
            console.log('');
        }

        if (options.dryRun) {
            console.log('🔍 DRY RUN: The following files would be processed:');
            filePairs.forEach((pair, index) => {
                const relativePath = path.relative(options.uploadsDir, pair.jsonPath);
                console.log(`  [${index + 1}] ${relativePath}`);
                if (options.verbose) {
                    console.log(`      Drive: ${pair.metadata.drive_model} (${pair.metadata.drive_type})`);
                    console.log(`      Server: ${pair.metadata.hostname || 'unknown'} (${pair.metadata.protocol || 'unknown'})`);
                    console.log(`      Uploaded: ${pair.metadata.upload_timestamp}`);
                    console.log(`      By: ${pair.metadata.uploaded_by || 'unknown'}`);
                }
            });
            console.log(`\n✅ DRY RUN completed. ${filePairs.length} files would be processed.`);
            return;
        }

        // Process files in chronological order
        console.log('⚙️  Processing files in chronological order...\n');

        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let totalTestRuns = 0;
        let totalFileSize = 0;

        for (let i = 0; i < filePairs.length; i++) {
            const pair = filePairs[i];
            const fileNumber = i + 1;
            const relativePath = path.relative(options.uploadsDir, pair.jsonPath);

            try {
                // Get file size for statistics
                const fileStats = fs.statSync(pair.jsonPath);
                totalFileSize += fileStats.size;

                const fileStartTime = Date.now();

                console.log(`[${fileNumber}/${filePairs.length}] 🔄 Processing: ${relativePath}`);

                if (options.verbose) {
                    console.log(`    Drive: ${pair.metadata.drive_model} (${pair.metadata.drive_type})`);
                    console.log(`    Server: ${pair.metadata.hostname || 'unknown'} (${pair.metadata.protocol || 'unknown'})`);
                    console.log(`    Size: ${formatBytes(fileStats.size)}`);
                }

                // Process the file
                const result = await processFioFile(pair.jsonPath, pair.metadata, {
                    overwrite: options.overwrite,
                    requestId: `${requestId}-${fileNumber}`
                });

                const fileProcessingTime = Date.now() - fileStartTime;

                if (result.status === 'completed') {
                    totalSuccess++;
                    totalTestRuns += result.successCount;
                    totalSkipped += result.skipCount;
                    totalErrors += result.errorCount;

                    console.log(`[${fileNumber}/${filePairs.length}] ✅ Completed: ${relativePath}`);

                    if (options.verbose || result.skipCount > 0 || result.errorCount > 0) {
                        console.log(`    Jobs: ${result.successCount} imported, ${result.skipCount} skipped, ${result.errorCount} errors`);
                        console.log(`    Processing time: ${formatDuration(fileProcessingTime)}`);
                    }
                } else {
                    totalErrors++;
                    console.log(`[${fileNumber}/${filePairs.length}] ❌ Failed: ${relativePath}`);
                    console.log(`    Error: ${result.error}`);
                }

                totalProcessed++;

                // Add small delay to prevent overwhelming the database
                if (i < filePairs.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (error) {
                totalErrors++;
                totalProcessed++;

                console.log(`[${fileNumber}/${filePairs.length}] ❌ Error: ${relativePath}`);
                console.log(`    ${error.message}`);

                logError('File processing failed', error, {
                    requestId,
                    filePath: pair.jsonPath,
                    fileNumber
                });
            }
        }

        // Final summary
        const totalTime = Date.now() - startTime;

        console.log(`
📊 Import Summary
================
Files processed:     ${totalProcessed}/${filePairs.length}
Successfully imported: ${totalSuccess}
Test runs imported:   ${totalTestRuns}
Jobs skipped:         ${totalSkipped}
Errors:              ${totalErrors}
Total data size:     ${formatBytes(totalFileSize)}
Processing time:     ${formatDuration(totalTime)}
`);

        if (totalErrors > 0) {
            console.log('⚠️  Some files had errors. Check the logs above for details.');
            process.exit(1);
        } else {
            console.log('🎉 Import completed successfully!');
        }

        logInfo('Bulk import completed', {
            requestId,
            totalFiles: filePairs.length,
            successfulFiles: totalSuccess,
            totalTestRuns,
            totalSkipped,
            totalErrors,
            totalTime: `${totalTime}ms`,
            uploadsDir: options.uploadsDir,
            overwrite: options.overwrite
        });

    } catch (error) {
        const totalTime = Date.now() - startTime;

        console.error(`\n❌ Import failed: ${error.message}`);

        logError('Bulk import failed', error, {
            requestId,
            totalTime: `${totalTime}ms`,
            uploadsDir: options.uploadsDir,
            overwrite: options.overwrite
        });

        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️  Import interrupted by user');
    process.exit(130);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️  Import terminated');
    process.exit(143);
});

// Run the import tool
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    });
}

module.exports = { main, parseArguments };

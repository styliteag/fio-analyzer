#!/usr/bin/env node

/**
 * Simplified Schema Migration Script
 *
 * This script migrates from the old dual-table structure with separate performance_metrics
 * to a simplified structure where performance metrics are stored directly in the main tables.
 *
 * Usage:
 *   node run-simplified-migration.js [database-path]
 *
 * If no database path is provided, it will use the default location.
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db', 'storage_performance.db');
const MIGRATION_SQL_PATH = path.join(__dirname, 'migrate-to-simplified-schema.sql');

class SimplifiedSchemaMigrator {
    constructor(dbPath) {
        this.dbPath = dbPath || DEFAULT_DB_PATH;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(new Error(`Failed to open database: ${err.message}`));
                } else {
                    console.log(`Connected to SQLite database: ${this.dbPath}`);
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('Database connection closed.');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async checkCurrentSchema() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                AND name IN ('test_runs', 'test_runs_all', 'performance_metrics', 'performance_metrics_all')
                ORDER BY name
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const tables = rows.map(row => row.name);
                    resolve({
                        hasTestRuns: tables.includes('test_runs'),
                        hasTestRunsAll: tables.includes('test_runs_all'),
                        hasPerformanceMetrics: tables.includes('performance_metrics'),
                        hasPerformanceMetricsAll: tables.includes('performance_metrics_all'),
                        hasOldStructure: tables.includes('performance_metrics') || tables.includes('performance_metrics_all')
                    });
                }
            });
        });
    }

    async createBackup() {
        const backupPath = this.dbPath + '.backup.' + Date.now();
        return new Promise((resolve, reject) => {
            fs.copyFile(this.dbPath, backupPath, (err) => {
                if (err) {
                    reject(new Error(`Failed to create backup: ${err.message}`));
                } else {
                    console.log(`✓ Database backup created: ${backupPath}`);
                    resolve(backupPath);
                }
            });
        });
    }

    async executeMigrationSQL() {
        return new Promise((resolve, reject) => {
            fs.readFile(MIGRATION_SQL_PATH, 'utf8', (err, sql) => {
                if (err) {
                    reject(new Error(`Failed to read migration SQL: ${err.message}`));
                    return;
                }

                console.log('Executing simplified schema migration...');
                this.db.exec(sql, (err) => {
                    if (err) {
                        reject(new Error(`Migration failed: ${err.message}`));
                    } else {
                        console.log('✓ Simplified schema migration executed successfully');
                        resolve();
                    }
                });
            });
        });
    }

    async validateMigration() {
        return new Promise((resolve, reject) => {
            console.log('\nValidating migration...');

            // Check if performance metrics columns exist
            this.db.all(`
                PRAGMA table_info(test_runs_all)
            `, (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }

                const hasMetrics = columns.some(col => 
                    ['avg_latency', 'bandwidth', 'iops', 'p95_latency', 'p99_latency'].includes(col.name)
                );

                if (hasMetrics) {
                    console.log('✓ Performance metrics columns added to main tables');
                } else {
                    console.log('✗ Performance metrics columns not found');
                }

                // Check if old tables are gone
                this.db.all(`
                    SELECT name FROM sqlite_master 
                    WHERE type='table' 
                    AND name IN ('performance_metrics', 'performance_metrics_all')
                `, (err, oldTables) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (oldTables.length === 0) {
                        console.log('✓ Old performance_metrics tables removed');
                    } else {
                        console.log('✗ Old performance_metrics tables still exist');
                    }

                    // Show sample data
                    this.db.all(`
                        SELECT id, hostname, drive_model, iops, avg_latency, bandwidth
                        FROM test_runs_all 
                        WHERE iops IS NOT NULL OR avg_latency IS NOT NULL
                        LIMIT 3
                    `, (err, sampleData) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        if (sampleData.length > 0) {
                            console.log('✓ Sample migrated data:');
                            console.table(sampleData);
                        } else {
                            console.log('⚠ No migrated data found');
                        }

                        resolve();
                    });
                });
            });
        });
    }

    async migrate() {
        try {
            console.log('🚀 Starting Simplified Schema Migration...\n');

            // Check current schema
            const schema = await this.checkCurrentSchema();
            console.log('Current schema:', schema);

            if (!schema.hasOldStructure) {
                console.log('⚠ No old performance_metrics tables found. Migration may not be needed.');
                return;
            }

            // Create backup
            await this.createBackup();

            // Execute migration
            await this.executeMigrationSQL();

            // Validate migration
            await this.validateMigration();

            console.log('\n✅ Simplified schema migration completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('   1. Restart your application');
            console.log('   2. Test the API endpoints');
            console.log('   3. Verify data integrity');
            console.log('   4. Remove backup files when confident');

        } catch (error) {
            console.error('\n❌ Migration failed:', error.message);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const dbPath = process.argv[2];

    if (dbPath && !fs.existsSync(dbPath)) {
        console.error(`Error: Database file not found: ${dbPath}`);
        process.exit(1);
    }

    const migrator = new SimplifiedSchemaMigrator(dbPath);

    try {
        await migrator.migrate();
        process.exit(0);
    } catch (error) {
        console.error('\nMigration failed. Please check the error message above.');
        process.exit(1);
    } finally {
        await migrator.close();
    }
}

// Handle CLI execution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = SimplifiedSchemaMigrator; 
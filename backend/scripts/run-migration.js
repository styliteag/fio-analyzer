#!/usr/bin/env node

/**
 * Database Migration Script for Dual-Table Architecture
 * 
 * This script converts the old single-table database structure to the new
 * dual-table architecture that separates latest vs historical data.
 * 
 * Usage:
 *   node run-migration.js [database-path]
 * 
 * If no database path is provided, it will use the default location.
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db', 'storage_performance.db');
const MIGRATION_SQL_PATH = path.join(__dirname, 'migrate-to-dual-table.sql');
const VALIDATION_SQL_PATH = path.join(__dirname, 'validate-migration.sql');

class DatabaseMigrator {
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
                AND name IN ('test_runs', 'test_runs_all', 'performance_metrics_all')
                ORDER BY name
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const tables = rows.map(row => row.name);
                    resolve({
                        hasTestRuns: tables.includes('test_runs'),
                        hasTestRunsAll: tables.includes('test_runs_all'),
                        hasPerformanceMetricsAll: tables.includes('performance_metrics_all'),
                        isAlreadyMigrated: tables.includes('test_runs_all') && tables.includes('performance_metrics_all')
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

                console.log('Executing migration SQL...');
                this.db.exec(sql, (err) => {
                    if (err) {
                        reject(new Error(`Migration failed: ${err.message}`));
                    } else {
                        console.log('✓ Migration SQL executed successfully');
                        resolve();
                    }
                });
            });
        });
    }

    async validateMigration() {
        return new Promise((resolve, reject) => {
            fs.readFile(VALIDATION_SQL_PATH, 'utf8', (err, sql) => {
                if (err) {
                    console.warn('Validation SQL not found, skipping validation');
                    resolve();
                    return;
                }

                console.log('\nRunning migration validation...');
                
                // Split SQL into individual statements and execute them
                const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
                let currentIndex = 0;

                const executeNext = () => {
                    if (currentIndex >= statements.length) {
                        console.log('✓ Validation completed');
                        resolve();
                        return;
                    }

                    const statement = statements[currentIndex].trim();
                    if (statement.startsWith('SELECT') || statement.startsWith('WITH')) {
                        this.db.all(statement, (err, rows) => {
                            if (err && !err.message.includes('no such')) {
                                console.warn(`Validation query failed: ${err.message}`);
                            } else if (rows && rows.length > 0) {
                                console.table(rows);
                            }
                            currentIndex++;
                            executeNext();
                        });
                    } else {
                        currentIndex++;
                        executeNext();
                    }
                };

                executeNext();
            });
        });
    }

    async migrate() {
        try {
            console.log('🚀 Starting database migration to dual-table architecture...\n');

            // Initialize database connection
            await this.init();

            // Check current schema
            const schema = await this.checkCurrentSchema();
            console.log('Current schema status:', schema);

            if (schema.isAlreadyMigrated) {
                console.log('⚠️  Database appears to already be migrated to dual-table structure');
                console.log('   If you want to re-run the migration, please restore from a backup first');
                return;
            }

            if (!schema.hasTestRuns) {
                throw new Error('No test_runs table found. This doesn\'t appear to be a valid FIO analyzer database.');
            }

            // Create backup
            const backupPath = await this.createBackup();

            // Execute migration
            await this.executeMigrationSQL();

            // Validate migration
            await this.validateMigration();

            console.log('\n🎉 Migration completed successfully!');
            console.log('\nNext steps:');
            console.log('1. Test your application thoroughly');
            console.log('2. If everything works correctly, you can remove the backup file:');
            console.log(`   rm "${backupPath}"`);
            console.log('3. Run VACUUM to optimize the database:');
            console.log(`   sqlite3 "${this.dbPath}" "VACUUM;"`);

        } catch (error) {
            console.error('\n❌ Migration failed:', error.message);
            console.error('\nRecommendations:');
            console.error('1. Restore from backup if one was created');
            console.error('2. Check the error message above for specific issues');
            console.error('3. Ensure the database is not in use by another process');
            throw error;
        } finally {
            await this.close();
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

    const migrator = new DatabaseMigrator(dbPath);
    
    try {
        await migrator.migrate();
        process.exit(0);
    } catch (error) {
        console.error('\nMigration failed. Please check the error message above.');
        process.exit(1);
    }
}

// Handle CLI execution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DatabaseMigrator;
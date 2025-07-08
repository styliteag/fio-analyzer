# Database Migration Scripts

This directory contains scripts to migrate your FIO Analyzer database from the old single-table structure to the new dual-table architecture that separates latest vs historical data.

## 🚨 Important: Backup First!

**ALWAYS backup your database before running any migration!**

```bash
cp /path/to/your/storage_performance.db /path/to/your/storage_performance.db.backup
```

## Migration Scripts

### 1. `migrate-to-dual-table.sql` - Main Migration Script

Complete SQL migration script that converts the old database structure to the new dual-table architecture.

**What it does:**
- Creates new historical tables (`test_runs_all`, `performance_metrics_all`, `latency_percentiles_all`)
- Preserves ALL existing data in historical tables
- Creates new latest-only tables with unique constraints
- Populates latest tables with only the most recent test per configuration
- Creates proper indexes for performance
- Creates backup tables for safety

**Usage:**
```bash
# Method 1: Direct SQL execution
sqlite3 your_database.db < migrate-to-dual-table.sql

# Method 2: Interactive execution
sqlite3 your_database.db
.read migrate-to-dual-table.sql
.quit
```

### 2. `run-migration.js` - Node.js Migration Runner

A safer Node.js script that performs the migration with additional checks and validation.

**Features:**
- Automatic database backup creation
- Pre-migration schema validation
- Better error handling and rollback support
- Post-migration validation
- Detailed progress reporting

**Usage:**
```bash
# Use default database location
node run-migration.js

# Specify custom database path
node run-migration.js /path/to/your/database.db
```

**Requirements:**
- Node.js with sqlite3 package installed
- Write permissions to database directory

### 3. `validate-migration.sql` - Validation Script

Comprehensive validation script to verify the migration was successful.

**What it checks:**
- Table structure correctness
- Data integrity (no data loss)
- Unique constraint validation
- Foreign key integrity
- Data recency verification (latest runs are actually the most recent)
- Sample data comparison

**Usage:**
```bash
sqlite3 your_database.db < validate-migration.sql
```

### 4. `rollback-dual-table.sql` - Rollback Script

Emergency rollback script to revert back to the old single-table structure.

**⚠️ Warning:** This script will lose the benefits of the dual-table separation!

**Usage:**
```bash
sqlite3 your_database.db < rollback-dual-table.sql
```

## Migration Process

### Recommended Steps:

1. **Backup your database**
   ```bash
   cp storage_performance.db storage_performance.db.backup
   ```

2. **Stop your application** to ensure no active database connections

3. **Run the migration** (choose one method):
   ```bash
   # Option A: Use the Node.js script (recommended)
   node run-migration.js

   # Option B: Use SQL directly
   sqlite3 storage_performance.db < migrate-to-dual-table.sql
   ```

4. **Validate the migration**
   ```bash
   sqlite3 storage_performance.db < validate-migration.sql
   ```

5. **Test your application** thoroughly with the new database

6. **Optimize the database** (optional but recommended)
   ```bash
   sqlite3 storage_performance.db "VACUUM;"
   ```

7. **Clean up backup tables** (only after confirming everything works)
   ```sql
   DROP TABLE IF EXISTS test_runs_backup;
   DROP TABLE IF EXISTS performance_metrics_backup;
   ```

## New Database Structure

After migration, your database will have:

### Latest Data Tables (Optimized for fast queries):
- `test_runs` - Only the most recent test per unique configuration
- `performance_metrics` - Metrics for latest tests only  
- `latency_percentiles` - Latency data for latest tests only

### Historical Data Tables (Complete data archive):
- `test_runs_all` - ALL test runs (complete history)
- `performance_metrics_all` - ALL performance metrics
- `latency_percentiles_all` - ALL latency percentiles

### Key Benefits:
- **Faster queries** for latest data (most common use case)
- **Complete history preserved** for analysis and reporting
- **Unique constraints** prevent duplicate latest configurations
- **Better indexing** for both latest and historical queries

## API Changes

After migration, the application will use:
- `/api/test-runs` - Returns only latest test runs (no `include_historical` parameter)
- `/api/time-series/all` - Returns complete historical data with filtering

## Troubleshooting

### Common Issues:

1. **"Database is locked" error**
   - Stop all applications using the database
   - Check for any remaining connections
   - Wait a moment and try again

2. **Migration fails partway through**
   - The migration uses transactions, so partial changes should be rolled back
   - Restore from your backup and investigate the error
   - Check disk space and permissions

3. **Data appears missing after migration**
   - Run the validation script to check data integrity
   - Latest tables only contain the most recent test per configuration (this is expected)
   - All historical data is preserved in `*_all` tables

4. **Application errors after migration**
   - Ensure you're using the updated application code that supports dual-table structure
   - Check that API endpoints are working correctly
   - Verify database schema matches expectations

### Recovery:

If something goes wrong:

1. **Restore from backup:**
   ```bash
   cp storage_performance.db.backup storage_performance.db
   ```

2. **Use rollback script:**
   ```bash
   sqlite3 storage_performance.db < rollback-dual-table.sql
   ```

3. **Contact support** with error details and validation results

## Files Summary

| File | Purpose | When to Use |
|------|---------|-------------|
| `migrate-to-dual-table.sql` | Main migration script | Direct SQL execution |
| `run-migration.js` | Safer migration with validation | Recommended for production |
| `validate-migration.sql` | Verify migration success | After any migration |
| `rollback-dual-table.sql` | Emergency rollback | If migration fails |
| `README.md` | This documentation | For understanding the process |

## Support

For issues or questions about the migration:

1. Check the validation script output for specific problems
2. Review the error messages carefully
3. Ensure you have backups before any migration attempts
4. Test the migration on a copy of your database first
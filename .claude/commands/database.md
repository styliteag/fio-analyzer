# Database Management Assistant

Manage SQLite database operations for $ARGUMENTS.

## Task

I'll help you with database operations by:

1. Executing SQL queries against the SQLite database
2. Managing database schema and migrations  
3. Importing/exporting data and test results
4. Database backup and recovery operations
5. Performance analysis and optimization
6. User authentication data management

## Process

I'll follow these steps:

1. Identify the database location (backend/db/storage_performance.db)
2. Understand the current schema and table structure
3. Execute appropriate SQL commands safely
4. Validate results and handle errors properly
5. Ensure data integrity throughout operations

## Database Schema

The project uses two main tables:
- **test_runs**: Latest test results (unique per host/drive/config)
- **test_runs_all**: Complete historical data
- Performance metrics stored directly in main tables

## Common Operations

### Database Access
```bash
cd backend
sqlite3 db/storage_performance.db
```

### Schema Inspection
```sql
.tables                    -- List all tables
.schema test_runs         -- Show table structure
.schema test_runs_all     -- Show historical table structure
```

### Data Queries
```sql
-- View latest test runs
SELECT hostname, drive_type, test_type, created_at FROM test_runs LIMIT 10;

-- Historical performance data
SELECT hostname, created_at, read_iops, write_iops FROM test_runs_all 
WHERE hostname = 'specific-host' ORDER BY created_at DESC;

-- Filter by drive type
SELECT * FROM test_runs WHERE drive_type = 'NVMe';
```

### Maintenance Operations
```bash
cd backend
rm db/storage_performance.db  # Reset database (regenerates on restart)
cp db/storage_performance.db db/backup_$(date +%Y%m%d).db  # Backup
```

### User Management Tables
The authentication system uses separate files:
- `.htpasswd` - Admin users
- `.htuploaders` - Upload-only users

## Safety Notes

- Always backup before major operations
- Use transactions for multi-step operations  
- Validate queries before execution on production data
- Monitor database size and performance

I'll ensure all database operations follow best practices and maintain data integrity.
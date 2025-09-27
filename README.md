# Storage Performance Visualizer

A full-stack web application that analyzes and visualizes FIO (Flexible I/O Tester) benchmark results. The application provides comprehensive storage performance analysis with interactive charts and supports automated performance testing workflows.

## Features

### 📊 **Performance Visualization**
- Interactive charts powered by Chart.js with advanced controls
- Support for IOPS, bandwidth, latency, and latency percentiles
- Separate visualization of read and write operations
- Multiple chart templates with sorting, grouping, and filtering
- Export capabilities (PNG/CSV) and fullscreen mode
- Series visibility toggles and real-time chart manipulation

### 🔧 **FIO Integration**
- Import FIO JSON results directly through web interface
- Support for multi-job FIO test files
- Automated extraction of performance metrics and latency percentiles
- Command-line upload via curl/API

### 🏗️ **Infrastructure Metadata**
- Track server hostname, storage protocol (NFS, iSCSI, etc.)
- Custom test descriptions and categorization
- Filter and organize tests by infrastructure details

### 🚀 **Automated Testing**
- Production-ready shell script with .env file configuration
- Multiple block sizes (4k, 64k, 1M) and I/O patterns
- Configurable test parameters and automatic upload
- Comprehensive error handling and progress reporting
- Environment variable override support
- Direct download from application server

### 🗄️ **Data Management**
- SQLite database with comprehensive schema
- Test run management with edit/delete capabilities
- Performance metrics with operation-type separation, including p95/p99 latency values

### 🔐 **Authentication & Security**
- Role-based access control (admin vs upload-only users)
- bcrypt password hashing with secure credential storage
- Custom authentication forms (no browser popups)
- Comprehensive request logging and user activity tracking
- External authentication file management via Docker volumes

## Prerequisites

### For Development
- **Python** (v3.8+) and pip
- **SQLite3** 
- **FIO** (for performance testing)
- **curl** (for script uploads)

### For Production (Docker)
- **Docker** and Docker Compose
- **FIO** (on client machines for testing)
- **curl** or **wget** (for script downloads)

## Setup

### 🐳 Production Setup (Docker - Recommended)

The application runs in a single consolidated Docker container:

```bash
# Clone repository
git clone <repository-url>
cd fio-analyzer

# Build and run with Docker Compose
cd docker
docker compose up --build

# For production deployment
docker compose -f compose.prod.yml up -d
```

The application will be available at `http://localhost:80`.

#### Authentication Setup
```bash
# Create authentication directories
mkdir -p docker/data/auth

# Setup admin users (full access)
docker exec -it fio-app python scripts/manage_users.py add --admin --username admin --password your_password

# Setup upload-only users (restricted access)
docker exec -it fio-app python scripts/manage_users.py add --username uploader --password your_password
```

#### Download Testing Script
```bash
# Download from your running application
wget http://your-server/fio-analyzer-tests.sh
wget http://your-server/.env.example

# Setup configuration
cp .env.example .env
# Edit .env with your settings
chmod +x fio-analyzer-tests.sh
```

### 🛠️ Development Setup

For local development with separate frontend/backend:

#### Frontend

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

4. **Code Quality & Linting**:
   ```bash
   npm run lint        # Run ESLint for code quality checks
   npm run type-check  # Run TypeScript compiler for type checking
   npm run build       # Build for production (includes type checking)
   ```

#### Backend

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create Python Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies** (choose one):
   
   **Option A - Using uv (recommended, faster)**:
   ```bash
   uv sync
   ```
   
   **Option B - Using traditional pip**:
   ```bash
   pip install fastapi uvicorn python-multipart bcrypt python-jose
   ```

4. **Run the Backend Server**:
   
   **With uv**:
   ```bash
   uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   **With traditional setup**:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   The API will be available at `http://localhost:8000`.

5. **Code Quality & Linting**:
   
   **With uv (recommended)**:
   ```bash
   uv run flake8 --max-line-length=180 .          # Python linting
   uv run black . && uv run isort .              # Auto-format code
   uv run python -m py_compile main.py           # Syntax check
   ```
   
   **With traditional setup** (if flake8, black, isort installed):
   ```bash
   flake8 --max-line-length=180 .                 # Python linting
   black . && isort .                            # Auto-format code
   python -m py_compile main.py                  # Syntax check
   ```

### Database Setup

The application uses SQLite for data storage. The database is initialized automatically when the backend server starts, creating:

- **`test_runs`** - Test execution metadata including drive info, test parameters, hostname, protocol, and description
- **`performance_metrics`** - All performance data (IOPS, avg_latency, bandwidth, p95_latency, p99_latency) with operation-type separation

Sample data is populated automatically if the database is empty.

#### Migrating Old Databases (≤ v0.9)
Older databases stored latency percentiles in a dedicated table `latency_percentiles`. Use the script below once to migrate existing records into `performance_metrics` and drop the obsolete table:

```sql
BEGIN;

INSERT INTO performance_metrics
        (test_run_id, metric_type, value, unit, operation_type)
SELECT  lp.test_run_id,
        CASE lp.percentile
             WHEN 95 THEN 'p95_latency'
             WHEN 99 THEN 'p99_latency'
        END                                    AS metric_type,
        ROUND(lp.latency_ns / 1e6, 3)          AS value,
        'ms'                                   AS unit,
        lp.operation_type
FROM    latency_percentiles lp
WHERE   lp.percentile IN (95,99)
  AND NOT EXISTS (
        SELECT 1
        FROM   performance_metrics pm
        WHERE  pm.test_run_id   = lp.test_run_id
          AND  pm.metric_type   = CASE lp.percentile
                                     WHEN 95 THEN 'p95_latency'
                                     WHEN 99 THEN 'p99_latency'
                                  END
          AND  pm.operation_type = lp.operation_type
);

DROP TABLE IF EXISTS latency_percentiles;

COMMIT;
```

After migration, restart the backend and the new percentile metrics will be available through all `/api/time-series/` endpoints.

## Usage

### Web Interface
- Access the frontend at `http://localhost:5173` to interact with the visualizer
- Upload FIO JSON files via the web interface with metadata forms
- Select test runs and visualize performance data with interactive charts

### Automated Testing Script

The FIO testing script is available for download directly from your application server and provides automated testing with configurable parameters.

#### Download and Setup
```bash
# Download script and configuration template
wget http://your-server/fio-analyzer-tests.sh
wget http://your-server/.env.example

# Make executable and setup configuration
chmod +x fio-analyzer-tests.sh
cp .env.example .env
# Edit .env with your specific settings
```

#### Configuration with .env File
Create a `.env` file for persistent configuration:
```bash
# Server Information
HOSTNAME=myserver
PROTOCOL=NVMe
DESCRIPTION=Production performance test

# Test Parameters  
TEST_SIZE=10M
NUM_JOBS=4
RUNTIME=30

# Backend Configuration
BACKEND_URL=http://your-server
USERNAME=admin
PASSWORD=admin

# Advanced Options
BLOCK_SIZES=4k,64k,1M
TEST_PATTERNS=read,write,randread,randwrite
```

#### Usage Examples
```bash
# Basic usage (uses .env configuration)
./fio-analyzer-tests.sh

# Override specific parameters
TEST_SIZE="1M" RUNTIME="5" ./fio-analyzer-tests.sh

# Custom configuration with environment variables
HOSTNAME="web01" PROTOCOL="iSCSI" DESCRIPTION="Production test" ./fio-analyzer-tests.sh

# View help and all configuration options
./fio-analyzer-tests.sh --help
```

#### Script Configuration Variables
| Variable | Description | Default Value |
|----------|-------------|---------------|
| `HOSTNAME` | Server hostname | Current hostname |
| `PROTOCOL` | Storage protocol (NFS, iSCSI, Local, etc.) | `NFS` |
| `DESCRIPTION` | Test description | `"Automated performance test"` |
| `TEST_SIZE` | Size of test file | `1G` |
| `NUM_JOBS` | Number of parallel jobs | `4` |
| `RUNTIME` | Test runtime in seconds | `60` |
| `BACKEND_URL` | Backend API URL | `http://localhost:8000` |
| `TARGET_DIR` | Directory for test files | `/tmp/fio_test` |

#### What the Script Tests
The script automatically tests **12 combinations**:
- **Block Sizes**: 4k, 64k, 1M
- **I/O Patterns**: read, write, randread, randwrite  
- **Total Tests**: 3 × 4 = 12 tests per execution

#### Script Output
The script provides colored progress output showing:
- Configuration summary
- Individual test progress (X/12)
- Upload status for each test
- Final summary with success/failure counts
- Automatic cleanup of temporary files

### Automated Cron Job Setup

For continuous performance monitoring, you can set up a cron job to run FIO tests automatically on an hourly, daily, or custom schedule.

#### Basic Hourly Cron Setup
```bash
# Edit your crontab
crontab -e

# Add entry for hourly tests (runs at the top of every hour)
0 * * * * cd /path/to/your/scripts && ./fio-analyzer-tests.sh >> /var/log/fio-tests.log 2>&1

# Add entry for daily tests (runs at 2 AM every day)
0 2 * * * cd /path/to/your/scripts && ./fio-analyzer-tests.sh >> /var/log/fio-tests.log 2>&1

# Add entry for business hours only (9 AM to 5 PM, Monday-Friday)
0 9-17 * * 1-5 cd /path/to/your/scripts && ./fio-analyzer-tests.sh >> /var/log/fio-tests.log 2>&1
```

#### Advanced Cron Setup with Environment Variables
Create a wrapper script for better control and logging:

```bash
# Create /path/to/your/scripts/fio-cron-wrapper.sh
#!/bin/bash

# Set environment variables
export PATH="/usr/local/bin:/usr/bin:/bin"
export HOSTNAME="$(hostname)"
export PROTOCOL="NVMe"
export DESCRIPTION="Automated hourly performance test"
export BACKEND_URL="http://your-server"
export USERNAME="your-upload-user"
export PASSWORD="your-password"

# Add timestamp to logs
echo "$(date): Starting FIO performance test" >> /var/log/fio-tests.log

# Run the test with timeout (kill after 30 minutes if stuck)
timeout 1800 /path/to/your/scripts/fio-analyzer-tests.sh >> /var/log/fio-tests.log 2>&1

# Log completion
echo "$(date): FIO test completed with exit code $?" >> /var/log/fio-tests.log
```

```bash
# Make wrapper executable
chmod +x /path/to/your/scripts/fio-cron-wrapper.sh

# Add to crontab (hourly execution)
0 * * * * /path/to/your/scripts/fio-cron-wrapper.sh
```

#### Cron Schedule Examples
```bash
# Every 15 minutes
*/15 * * * * /path/to/your/scripts/fio-cron-wrapper.sh

# Every 6 hours
0 */6 * * * /path/to/your/scripts/fio-cron-wrapper.sh

# Twice daily (6 AM and 6 PM)
0 6,18 * * * /path/to/your/scripts/fio-cron-wrapper.sh

# Weekly on Sundays at 3 AM
0 3 * * 0 /path/to/your/scripts/fio-cron-wrapper.sh

# Monthly on the 1st at midnight
0 0 1 * * /path/to/your/scripts/fio-cron-wrapper.sh
```

#### Log Rotation for Automated Tests
To prevent log files from growing too large:

```bash
# Create /etc/logrotate.d/fio-tests
/var/log/fio-tests.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}

# Test log rotation
sudo logrotate -d /etc/logrotate.d/fio-tests
```

#### Monitoring Cron Job Health
Create a monitoring script to check if tests are running successfully:

```bash
# Create /path/to/your/scripts/check-fio-health.sh
#!/bin/bash

LOG_FILE="/var/log/fio-tests.log"
BACKEND_URL="http://your-server"

# Check if log was updated in last 2 hours
if [ $(find "$LOG_FILE" -mmin -120 | wc -l) -eq 0 ]; then
    echo "WARNING: FIO tests may not be running - no recent log activity"
fi

# Check backend connectivity
if ! curl -s "$BACKEND_URL/api/info" > /dev/null; then
    echo "ERROR: Cannot reach FIO Analyzer backend at $BACKEND_URL"
fi

# Check for recent error patterns in logs
if tail -100 "$LOG_FILE" | grep -q "ERROR\|FAILED\|timeout"; then
    echo "WARNING: Recent errors found in FIO test logs"
    tail -20 "$LOG_FILE" | grep -E "ERROR|FAILED|timeout"
fi
```

#### Setup Checklist for Production Cron Jobs

1. **Test Script Manually First**
   ```bash
   # Ensure script works before adding to cron
   ./fio-analyzer-tests.sh
   ```

2. **Create Dedicated User (Recommended)**
   ```bash
   # Create user for FIO testing
   sudo useradd -m -s /bin/bash fio-tester
   sudo su - fio-tester
   
   # Setup script and cron for this user
   crontab -e
   ```

3. **Configure Permissions**
   ```bash
   # Ensure test directory is writable
   mkdir -p /tmp/fio_test
   chmod 755 /tmp/fio_test
   
   # Ensure log directory exists
   sudo mkdir -p /var/log
   sudo touch /var/log/fio-tests.log
   sudo chown fio-tester:fio-tester /var/log/fio-tests.log
   ```

4. **Test Cron Environment**
   ```bash
   # Add temporary test to cron
   * * * * * env > /tmp/cron-env.txt
   
   # Compare with shell environment
   diff <(env | sort) <(sort /tmp/cron-env.txt)
   ```

5. **Monitor and Validate**
   ```bash
   # Check cron service is running
   sudo systemctl status cron
   
   # View cron logs
   sudo journalctl -u cron -f
   
   # Verify tests appear in FIO Analyzer
   curl -u username:password "http://your-server/api/time-series/latest"
   ```

#### Troubleshooting
```bash
# Check if FIO is installed
fio --version

# Test backend connectivity
curl http://localhost:8000/api/test-runs

# Run with verbose output (if issues occur)
# Edit the script and remove '2>/dev/null' from the fio command

# Check available space in target directory
df -h /tmp/fio_test
```

### Manual FIO Testing

Generate FIO results and upload manually:

```bash
# Generate FIO JSON output
fio --name=test --rw=randwrite --bs=4k --size=1G \
    --iodepth=16 --runtime=60 --time_based --group_reporting \
    --output-format=json --output=result.json

# Upload via API with metadata
curl -X POST -F "file=@result.json" \
     -F "drive_model=Samsung 980 PRO" \
     -F "drive_type=NVMe SSD" \
     -F "hostname=server01" \
     -F "protocol=NFS" \
     -F "description=Production benchmark" \
     http://localhost:8000/api/import
```

## API Endpoints

### Authentication
All API endpoints require authentication. Use basic authentication with username/password.

### Test Runs (Admin Only)
- **GET /api/test-runs** - Retrieve all test runs with metadata
- **PUT /api/test-runs/:id** - Update test run drive information
- **DELETE /api/test-runs/:id** - Delete test run and associated data

### Performance Data (Admin Only)
- **GET /api/test-runs/performance-data** - Retrieve performance data for specific test runs
  - Query params: `test_run_ids` (comma-separated), `metric_types` (optional)
  - Returns: Test metadata, separated read/write metrics, latency percentiles

### Data Import (Admin + Upload Users)
- **POST /api/import** - Import FIO JSON results with metadata
  - Form data: `file` (FIO JSON), `drive_model`, `drive_type`, `hostname`, `protocol`, `description`
  - Available to both admin users and upload-only users

### Filters (Admin Only)
- **GET /api/filters** - Get available filter options for drive types, models, patterns, and block sizes

### Static Downloads (Public)
- **GET /fio-analyzer-tests.sh** - Download the FIO testing script
- **GET /.env.example** - Download the configuration template

## Performance Testing Examples

### Multi-Server Testing
Deploy the script across multiple servers for comprehensive infrastructure analysis:

```bash
# Server 1 - NFS storage
HOSTNAME="web01" PROTOCOL="NFS" DESCRIPTION="Web server NFS test" ./scripts/performance_test.sh

# Server 2 - iSCSI storage  
HOSTNAME="db01" PROTOCOL="iSCSI" DESCRIPTION="Database server iSCSI test" ./scripts/performance_test.sh

# Server 3 - Local SSD
HOSTNAME="app01" PROTOCOL="Local" DESCRIPTION="Application server local SSD test" ./scripts/performance_test.sh
```

### Load Testing
Run extended performance tests:

```bash
# Extended test with larger files and longer runtime
TEST_SIZE="50G" RUNTIME="600" NUM_JOBS="16" \
HOSTNAME="storage-test" PROTOCOL="iSCSI" \
DESCRIPTION="Extended load test - 50GB over 10 minutes" \
./scripts/performance_test.sh
```

## Data Analysis Features

The application provides comprehensive performance analysis:

### Performance Metrics
- **IOPS** - Input/Output Operations Per Second for read and write operations
- **Bandwidth** - Throughput in KB/s for read and write operations  
- **Latency** - Average latency in milliseconds for read and write operations
- **Latency Percentiles** - P1, P5, P10, P20, P30, P40, P50, P60, P70, P80, P90, P95, P99, P99.5, P99.9, P99.95, P99.99

### Filtering and Organization
- Filter by drive model, drive type, storage protocol
- Search by hostname, test description
- Organize by block size and I/O patterns
- Time-based filtering and sorting

## Architecture

### Frontend (React + TypeScript)
- **App.tsx** - Main application orchestrating data flow
- **TestRunSelector** - Multi-select dropdown for test runs
- **TemplateSelector** - Chart template/visualization picker
- **InteractiveChart** - Chart.js-powered data visualization
- **Upload.tsx** - FIO file upload interface with metadata forms

### Backend (Python FastAPI)
- **main.py** - FastAPI application with modular routers and database logic
- **Database Schema** - SQLite with test_runs, performance_metrics, and latency_percentiles tables
- **Multi-job Import** - Processes all jobs from FIO JSON files
- **Metadata Support** - Full infrastructure context tracking

### Database Schema
```sql
-- Test execution metadata
test_runs (id, timestamp, drive_model, drive_type, test_name, block_size, 
          read_write_pattern, queue_depth, duration, fio_version, job_runtime,
          rwmixread, total_ios_read, total_ios_write, usr_cpu, sys_cpu,
          hostname, protocol, description)

-- Performance metrics with operation separation          
performance_metrics (id, test_run_id, metric_type, value, unit, operation_type)

-- Detailed latency percentile data
latency_percentiles (id, test_run_id, operation_type, percentile, latency_ns)
```

## Docker Architecture

The application uses a consolidated single-container architecture:

### Container Structure
- **Frontend**: React app served by nginx on port 80
- **Backend**: FastAPI API running internally on port 8000  
- **Reverse Proxy**: nginx proxies `/api/*` requests to backend
- **Static Files**: Testing script and config served by nginx
- **Build**: Multi-stage Docker build for optimized production deployment

### Volume Mounts
```yaml
volumes:
  - ./data/backend/db:/app/db                    # Database persistence
  - ./data/backend/uploads:/app/uploads          # Uploaded files
  - ./data/auth/.htpasswd:/app/.htpasswd         # Admin users
  - ./data/auth/.htuploaders:/app/.htuploaders   # Upload-only users
```

### Deployment Options
```bash
# Development build
docker compose up --build

# Production deployment  
docker compose -f compose.prod.yml up -d

# Using pre-built registry images
IMAGE_TAG=latest docker compose -f compose.prod.yml up -d
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Submit a pull request with a clear description

### Roadmap
- [ ] Real-time performance monitoring
- [ ] Advanced statistical analysis
- [ ] Performance regression detection
- [ ] Multi-tenancy support
- [ ] REST API documentation with OpenAPI/Swagger 

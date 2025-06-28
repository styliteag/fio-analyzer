# Storage Performance Visualizer

A full-stack web application that analyzes and visualizes FIO (Flexible I/O Tester) benchmark results. The application provides comprehensive storage performance analysis with interactive charts and supports automated performance testing workflows.

## Features

### 📊 **Performance Visualization**
- Interactive charts powered by Chart.js
- Support for IOPS, bandwidth, latency, and latency percentiles
- Separate visualization of read and write operations
- Multiple chart templates and visualization options

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
- Production-ready shell script for automated FIO testing
- Multiple block sizes (4k, 64k, 1M) and I/O patterns
- Configurable test parameters and automatic upload
- Comprehensive error handling and progress reporting

### 🗄️ **Data Management**
- SQLite database with comprehensive schema
- Test run management with edit/delete capabilities
- Performance metrics with operation-type separation
- Detailed latency percentile storage

## Prerequisites

- **Node.js** (v16+) and npm
- **SQLite3** 
- **FIO** (for performance testing)
- **curl** (for script uploads)

## Setup

### Frontend

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**: Run the following command to install the necessary Node.js packages:

   ```bash
   npm install
   ```

3. **Start the Development Server**: Use the following command to start the Vite development server:

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`.

### Backend

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install Dependencies**: Run the following command to install the necessary Node.js packages:
   ```bash
   npm install
   ```

3. **Run the Backend Server**: Start the Express server with:
   ```bash
   npm start
   ```

   The API will be available at `http://localhost:8000`.

### Database Setup

The application uses SQLite for data storage. The database is initialized automatically when the backend server starts, creating:

- **`test_runs`** - Test execution metadata including drive info, test parameters, hostname, protocol, and description
- **`performance_metrics`** - Performance data (IOPS, latency, throughput) with operation type separation
- **`latency_percentiles`** - Detailed latency percentile data for performance analysis

Sample data is populated automatically if the database is empty.

## Usage

### Web Interface
- Access the frontend at `http://localhost:5173` to interact with the visualizer
- Upload FIO JSON files via the web interface with metadata forms
- Select test runs and visualize performance data with interactive charts

### Automated Testing Script

The performance testing script is located at `scripts/performance_test.sh` and provides automated FIO testing with upload to the backend.

#### Prerequisites
- **FIO** installed on the target server
- **curl** for API uploads
- **Executable permissions** on the script

#### Installation
```bash
# Make the script executable
chmod +x scripts/performance_test.sh

# Copy to target servers (optional)
scp scripts/performance_test.sh user@server:/path/to/script/
```

#### Basic Usage
```bash
# Run from project root directory
./scripts/performance_test.sh

# Or run from any location with full path
/path/to/fio-analyzer/scripts/performance_test.sh

# View help and configuration options
./scripts/performance_test.sh --help
```

#### Configuration Examples
```bash
# Custom configuration with environment variables
HOSTNAME="web01" PROTOCOL="iSCSI" DESCRIPTION="Production test" ./scripts/performance_test.sh

# Advanced configuration
TEST_SIZE="10G" RUNTIME="300" NUM_JOBS="8" BACKEND_URL="http://your-server:8000" ./scripts/performance_test.sh

# Quick test for development
TEST_SIZE="1M" RUNTIME="10" NUM_JOBS="1" ./scripts/performance_test.sh
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

### Test Runs
- **GET /api/test-runs** - Retrieve all test runs with metadata
- **PUT /api/test-runs/:id** - Update test run drive information
- **DELETE /api/test-runs/:id** - Delete test run and associated data

### Performance Data
- **GET /api/performance-data** - Retrieve performance data for specific test runs
  - Query params: `test_run_ids` (comma-separated), `metric_types` (optional)
  - Returns: Test metadata, separated read/write metrics, latency percentiles

### Data Import
- **POST /api/import** - Import FIO JSON results with metadata
  - Form data: `file` (FIO JSON), `drive_model`, `drive_type`, `hostname`, `protocol`, `description`

### Filters
- **GET /api/filters** - Get available filter options for drive types, models, patterns, and block sizes

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

### Backend (Express.js/Node.js)
- **index.js** - Single file containing all API endpoints and database logic
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

## Running with Docker

You can also run the application using Docker Compose:

```bash
dokcer compose up --build
```

This will build and start the frontend and backend services.
- Frontend will be available at `http://localhost:3000`
- Backend will be available at `http://localhost:8000`

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

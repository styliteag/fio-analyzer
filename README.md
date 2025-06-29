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
- Performance metrics with operation-type separation
- Detailed latency percentile storage

### 🔐 **Authentication & Security**
- Role-based access control (admin vs upload-only users)
- bcrypt password hashing with secure credential storage
- Custom authentication forms (no browser popups)
- Comprehensive request logging and user activity tracking
- External authentication file management via Docker volumes

## Prerequisites

### For Development
- **Node.js** (v16+) and npm
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
docker exec -it fio-app node scripts/manage-users.js

# Setup upload-only users (restricted access)
docker exec -it fio-app node scripts/manage-uploaders.js
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

#### Backend

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run the Backend Server**:
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
- **GET /api/performance-data** - Retrieve performance data for specific test runs
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

## Docker Architecture

The application uses a consolidated single-container architecture:

### Container Structure
- **Frontend**: React app served by nginx on port 80
- **Backend**: Express.js API running internally on port 8000  
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

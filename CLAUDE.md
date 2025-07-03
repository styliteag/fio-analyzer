# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Storage Performance Visualizer** - a full-stack web application that analyzes and visualizes FIO (Flexible I/O Tester) benchmark results. The application consists of:

- **Frontend**: React + TypeScript + Vite application with interactive charts (in `frontend/` directory)
- **Backend**: Express.js Node.js server with SQLite database (in `backend/` directory) 
- **Database**: SQLite with test runs and performance metrics tables
- **Authentication**: Role-based access control with admin and upload-only users
- **Testing Script**: Automated FIO testing script with configurable parameters

## Key Commands

### Development
```bash
# Frontend development (in frontend/ directory)
cd frontend
npm install                    # Install frontend dependencies  
npm run dev                   # Start Vite dev server (http://localhost:5173)
npm run build                 # Build frontend for production
npm run lint                  # Run ESLint on TypeScript files

# Backend development (in backend/ directory)
cd backend
npm install                   # Install Node.js dependencies
npm run start                 # Start Express server (http://localhost:8000)
rm db/storage_performance.db  # Remove the db, it will be regenerated on the next run

# Docker deployment (single container)
cd docker
docker compose up --build     # Run combined container (from docker/ directory)
docker compose -f compose.prod.yml up -d  # Production deployment
```

### Run the Server

if the backend and frontend server need to be run you can ask the User to start them. He Maybe will start ./start-frontend-backend.sh to run the servers

### Run the Server as docker-compose
cd docker
docker compose up -d

Now the frontend and backend is availabel at http://example.interm

### Authentication & User Management
```bash
# Admin users (full access to all features)
node backend/scripts/manage-users.js

# Upload-only users (can only upload FIO test data)
node backend/scripts/manage-uploaders.js
```

### Testing Script
```bash
# Download the automated testing script
wget http://example.intern/script.sh
wget http://example.intern/.env

# Setup and run tests
chmod +x fio-analyzer-tests.sh
cp .env.example .env
# Edit .env with your settings
./fio-analyzer-tests.sh
```

### Database
- SQLite database auto-initializes with sample data on first run
- Database path: `backend/db/storage_performance.db` 
- Docker volume mounts:
  - `./data/backend/db:/app/db` (database)
  - `./data/backend/uploads:/app/uploads` (uploaded files)
  - `./data/auth/.htpasswd:/app/.htpasswd` (admin users)
  - `./data/auth/.htuploaders:/app/.htuploaders` (upload-only users)

## Architecture

### Backend (Express.js/Node.js)
- **index.js**: Single file containing all API endpoints, authentication, and database logic
- **Authentication**: Role-based access control with bcrypt password hashing
- **Logging**: Structured human-readable logging to stdout for monitoring
- **Database Schema**:
  - `test_runs`: Test execution metadata (drive info, test params, timestamps)
  - `performance_metrics`: Performance data (IOPS, latency, throughput)
- **Key Endpoints**:
  - `GET /api/test-runs`: List all test runs (admin only)
  - `GET /api/performance-data`: Get metrics for specific test runs (admin only)
  - `POST /api/import`: Upload FIO test results (admin or uploader)
  - `GET /api/filters`: Get filter options (admin only)
  - `PUT /api/test-runs/:id`: Update test run metadata (admin only)

### Frontend (React + TypeScript)
- **App.tsx**: Main application component orchestrating data flow
- **Authentication**: Custom login forms with React context-based authentication
- **Components**:
  - `TestRunSelector`: Multi-select dropdown for choosing test runs
  - `TemplateSelector`: Chart template/visualization picker  
  - `InteractiveChart`: Chart.js-powered data visualization with interactive controls
  - `LoginForm`: Custom authentication interface
- **Interactive Features**:
  - Sorting by multiple criteria (name, IOPS, latency, etc.)
  - Grouping by drive model, test type, block size, etc.
  - Series visibility toggles
  - Chart export (PNG/CSV)
  - Fullscreen mode
- **Types**: All TypeScript interfaces defined in `src/types/index.ts`

### Data Flow
1. User authenticates via custom login form
2. User selects test runs via `TestRunSelector`
3. User picks visualization template via `TemplateSelector` 
4. User configures interactive controls (sorting, grouping, etc.)
5. `App.tsx` fetches performance data from backend API with authentication
6. `InteractiveChart` renders data using Chart.js with custom templates and user controls

### Docker Setup (Consolidated Architecture)
- **Single Container**: Combined frontend (nginx) and backend (Node.js) in one container
- **Port**: Container runs on port 80
- **Static Files**: Scripts and configs served by nginx at `/fio-analyzer-tests.sh` and `/.env.example`
- **API**: Backend runs internally on port 8000, proxied by nginx
- **Build**: Multi-stage Docker build for optimized production deployment

## Supported Metrics
- IOPS (Input/Output Operations Per Second)
- Average latency (ms)
- Throughput (MB/s) 
- P95/P99 latency percentiles (ms)

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Chart.js, Lucide React icons
- **Backend**: Express.js, Node.js, SQLite3, CORS, bcryptjs for authentication
- **Infrastructure**: Nginx (static files & reverse proxy), Docker (single container)
- **Development**: ESLint for linting, Docker for containerization
- **Testing**: Automated FIO testing script with .env configuration

## Authentication System

### User Roles
- **Admin Users** (`.htpasswd`): Full access to all features including viewing data, uploading tests, and managing system
- **Upload-Only Users** (`.htuploaders`): Restricted access to upload FIO test results only

### Security Features
- bcrypt password hashing with salt rounds
- Role-based API endpoint protection
- Custom authentication forms (no browser basic auth popups)
- Request logging with user activity tracking
- Secure credential management via external volume mounts

## Automated Testing Script

### Features
- **Configuration**: .env file support with environment variable override
- **Customizable Tests**: Configurable block sizes, test patterns, runtime, and jobs
- **Multiple Patterns**: Supports read, write, randread, randwrite operations
- **Automated Upload**: Direct integration with FIO Analyzer API
- **Comprehensive Logging**: Colored output with test progress and results
- **Error Handling**: Graceful failure handling and cleanup

### Configuration Options
```bash
HOSTNAME=myserver           # Server identifier
PROTOCOL=NVMe              # Storage protocol  
DESCRIPTION=test_run       # Test description
TEST_SIZE=10M              # Test file size
NUM_JOBS=4                 # Parallel jobs
RUNTIME=30                 # Test duration (seconds)
BACKEND_URL=http://localhost:8000  # FIO Analyzer URL (local)
BACKEND_URL=http://example.intern  # FIO Analyzer URL (In the docker container)
USERNAME=admin             # Authentication username (default for dev)
PASSWORD=admin             # Authentication password (default for dev)
BLOCK_SIZES=4k,64k,1M      # Test block sizes
TEST_PATTERNS=read,write   # Test patterns
```

## Memories

### Project Template Understanding
- Memorized the 3D Template structure for the project, which is crucial for understanding the visualization and data representation capabilities of the FIO Analyzer
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Storage Performance Visualizer** - a full-stack web application that analyzes and visualizes FIO (Flexible I/O Tester) benchmark results. The application consists of:

- **Frontend**: React + TypeScript + Vite application with interactive charts (in `frontend/` directory)
- **Backend**: Python FastAPI server with SQLite database (in `backend/` directory) 
- **Database**: SQLite with test runs and performance metrics tables
- **Authentication**: Role-based access control with admin and upload-only users
- **Testing Script**: Automated FIO testing script with configurable parameters

## Migration Note
The backend has been migrated from Node.js/Express to Python FastAPI for improved performance and developer experience. All API endpoints remain identical for frontend compatibility.

## Key Commands

#### CHANGELOG Maintenance
⚠️ **IMPORTANT**: Always update `CHANGELOG.md` when making commits!
- Add new changes under `[Unreleased]` section before committing
- Move to new version section when releasing
- Use semantic versioning format


### Development
```bash
# Frontend development (in frontend/ directory)
cd frontend
npm install                    # Install frontend dependencies  
npm run dev                   # Start Vite dev server (http://localhost:5173)
npm run build                 # Build frontend for production
npm run lint                  # Run ESLint on TypeScript files

# Backend development (Python FastAPI in backend/ directory)
cd backend

# Using uv (recommended - fast package manager)
uv sync                       # Install Python dependencies with uv
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000  # Start FastAPI server with uv

# Alternative: Traditional pip/venv approach
python3 -m venv venv          # Create virtual environment (first time only)
source venv/bin/activate      # Activate virtual environment
pip install -r requirements.txt  # Install Python dependencies
uvicorn main:app --reload --host 0.0.0.0 --port 8000  # Start FastAPI server

# Utilities
rm db/storage_performance.db  # Remove the db, it will be regenerated on the next run
./setup-backend-uv.sh         # One-time setup with uv (recommended)
./setup-backend-venv.sh       # One-time setup with traditional venv

# Docker deployment (single container)
cd docker
docker compose up --build     # Run combined container (from docker/ directory)
docker compose -f compose.prod.yml up -d  # Production deployment
```

### Run the Server

The easiest way to run both frontend and backend is using the automated startup script:

```bash
./start-frontend-backend.sh    # Automatically sets up Python venv and starts both servers
```

This script will:
- Create a Python virtual environment if needed
- Install Python dependencies
- Start FastAPI backend (http://localhost:8000)
- Start React frontend (http://localhost:5173)

Alternative manual startup:
```bash
# Terminal 1 - Backend (with uv)
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Run the Server as docker-compose
cd docker
docker compose up -d

Now the frontend and backend is available at http://example.interm

### Authentication & User Management
```bash
# Using uv (recommended)
cd backend
uv run python scripts/manage_users.py add --username admin --password secret
uv run python scripts/manage_users.py list
uv run python scripts/manage_users.py remove --username admin

# Upload-only users (can only upload FIO test data)
uv run python scripts/manage_users.py add --username uploader --password secret --uploader
uv run python scripts/manage_users.py list --uploader
uv run python scripts/manage_users.py remove --username uploader --uploader

# Alternative: Using traditional venv
cd backend
source venv/bin/activate
python scripts/manage_users.py add --username admin --password secret
python scripts/manage_users.py list
```

### Testing Script
```bash
# Download the automated testing script
wget http://example.intern/script.sh
wget http://example.intern/env.example

# Setup and run tests
chmod +x script.sh
cp .env.example .env
# Edit .env with your settings
./srcript.sh
```

### Database
- SQLite database with simplified schema - performance metrics stored directly in main tables
- Auto-initializes with sample data on first run if database is empty
- Database path: `backend/db/storage_performance.db`
- Two main tables: `test_runs` (latest data) and `test_runs_all` (historical data)
- Docker volume mounts:
  - `./data/backend/db:/app/db` (database)
  - `./data/backend/uploads:/app/uploads` (uploaded files)
  - `./data/auth/.htpasswd:/app/.htpasswd` (admin users)
  - `./data/auth/.htuploaders:/app/.htuploaders` (upload-only users)

## Database Schema

The application uses a simplified SQLite schema with two main tables:

- **`test_runs`**: Latest test results only (unique per host/drive/configuration)
- **`test_runs_all`**: Complete historical data for all test runs
- Performance metrics (iops, latency, bandwidth, p95/p99 latency) are stored directly in these tables
- No separate performance_metrics tables - everything consolidated for better performance

## API Endpoints

Key endpoints for data access:
- `GET /api/test-runs` - Get test runs with optional filtering (hostname, drive_type, etc.)
- `GET /api/filters` - Get available filter options
- `GET /api/time-series/*` - Historical time-series data endpoints
- `POST /api/import` - Upload new FIO test results
- `GET /health` - Health check endpoint

## API Documentation

The FastAPI backend automatically generates comprehensive API documentation:
- **Swagger UI**: http://localhost:8000/docs (interactive API testing)
- **ReDoc**: http://localhost:8000/redoc (clean documentation)
- **OpenAPI JSON**: http://localhost:8000/openapi.json (machine-readable spec)

For complete API reference, see: **[API_DOCUMENTATION.md](./docs/api/API_DOCUMENTATION.md)**

## Backend Technology Stack

- **Framework**: FastAPI (Python 3.11+)
- **Package Manager**: uv (fast Rust-based Python package installer)
- **Server**: Uvicorn ASGI server
- **Database**: SQLite with direct connection
- **Authentication**: HTTP Basic Auth with bcrypt
- **Validation**: Pydantic models with type checking
- **Documentation**: Auto-generated OpenAPI/Swagger

**MANDATORY WORKFLOW**: After modifying any frontend code (*.ts, *.tsx files):
1. Use the appropriate specialized agent (frontend-developer/javascript-pro/ui-ux-designer)
2. Use **error-detective** agent to run `npm run lint` and `npx tsc --noEmit` for validation
3. Fix any syntax/lint errors before proceeding

These agents should be used PROACTIVELY whenever working on relevant file types to ensure high-quality, optimized code.

## Project Documentation

The following documentation files provide detailed information about various aspects of the project:

### API Documentation
- **[API_DOCUMENTATION.md](./docs/api/API_DOCUMENTATION.md)** - Complete API reference with all endpoints, parameters, examples, and usage guides

### Development Documentation
- **[DEVELOPMENT_SETUP.md](./docs/development/DEVELOPMENT_SETUP.md)** - Complete development setup guide with tools and best practices
- **[FASTAPI_README.md](./docs/development/FASTAPI_README.md)** - FastAPI backend development guide and setup instructions

### Migration Documentation
- **[MIGRATION_SUMMARY.md](./docs/migration/MIGRATION_SUMMARY.md)** - Historical migration notes from Node.js to FastAPI

### Frontend Documentation  
- **[frontend/PERFORMANCE_OPTIMIZATIONS.md](./frontend/PERFORMANCE_OPTIMIZATIONS.md)** - Comprehensive guide to React performance optimizations, memoization strategies, and chart optimization techniques
- **[frontend/ABORT_CONTROLLER_SUPPORT.md](./frontend/ABORT_CONTROLLER_SUPPORT.md)** - Documentation for request cancellation implementation with AbortController
- **[frontend/src/PERFORMANCE_OPTIMIZATIONS.md](./frontend/src/PERFORMANCE_OPTIMIZATIONS.md)** - Additional performance optimization details and code examples

### Recent Improvements (2024)
- Refactored frontend with reusable components (MetricsCard, TestRunFormFields)
- Optimized filter hooks from O(n²) to O(n) complexity
- Enhanced TypeScript type safety (eliminated all 'any' types)
- Added comprehensive request cancellation support
- Broke down large components (Host.tsx: 632 → 204 lines)
- Removed 700+ lines of unused code
- Enhanced API documentation with Swagger/OpenAPI

## Memories
- Always use "2025-06-31" as date and 20:00:00 as time and "2025-06-31 20:00:00" as datetime
- If you want to start the backend, use `./start-frontend-backend.sh` or ask the user to start it for you
- The backend uses Python FastAPI with uv package manager - use `uv run` to execute commands in the virtual environment
- For manual backend commands, prefer `uv run <command>` over activating venv
- If you want to do something in the FrontEnd which is hard to do, you can also add functions to the backend
- Use the auto-generated API documentation at http://localhost:8000/docs for testing endpoints
- Before running the backend check the syntax!

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
python3 -m venv venv          # Create virtual environment (first time only)
source venv/bin/activate      # Activate virtual environment
pip install -r requirements.txt  # Install Python dependencies
uvicorn main:app --reload --host 0.0.0.0 --port 8000  # Start FastAPI server
rm db/storage_performance.db  # Remove the db, it will be regenerated on the next run

# Quick backend setup script
./setup-backend-venv.sh       # One-time setup of Python virtual environment

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
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

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
# Activate Python virtual environment first
cd backend
source venv/bin/activate

# Admin users (full access to all features)
python scripts/manage_users.py add --username admin --password secret --admin
python scripts/manage_users.py list --admin
python scripts/manage_users.py remove --username admin --admin

# Upload-only users (can only upload FIO test data)
python scripts/manage_users.py add --username uploader --password secret
python scripts/manage_users.py list
python scripts/manage_users.py remove --username uploader
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

## Backend Technology Stack

- **Framework**: FastAPI (Python 3.11+)
- **Server**: Uvicorn ASGI server
- **Database**: SQLite with direct connection
- **Authentication**: HTTP Basic Auth with bcrypt
- **Validation**: Pydantic models with type checking
- **Documentation**: Auto-generated OpenAPI/Swagger

## Memories
- Always use "2025-06-31" as date and 20:00:00 as time and "2025-06-31 20:00:00" as datetime
- If you want to start the backend, use `./start-frontend-backend.sh` or ask the user to start it for you
- The backend uses Python FastAPI with virtual environment - ensure venv is activated when running manual commands
- If you want to do something in the FrontEnd which is hard to do, you can also add functions to the backend
- Use the auto-generated API documentation at http://localhost:8000/docs for testing endpoints
- Before running the backend check the syntax!
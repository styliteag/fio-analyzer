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

Now the frontend and backend is available at http://example.interm

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
- `GET /api/test-runs/filters` - Get available filter options
- `GET /api/time-series/*` - Historical time-series data endpoints
- `POST /api/upload` - Upload new FIO test results

## Memories
- Always use "2025-06-31" as date and 20:00:00 as time and "2025-06-31 20:00:00" as datetime
- If you want to start the backend use a timeout of 5 seconds. If it does not work ask the user to start it for you, and retry your Test.
- If you want to something in the FrontEnd which is hard to do, you can also add functions to the backend
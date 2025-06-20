# Docker Setup for FIO Analyzer

This directory contains Docker configuration for running the FIO Analyzer application.

## Services

- **Backend**: FastAPI Python server running on port 8000
- **Frontend**: React TypeScript application running on port 3000

## Quick Start

1. **Build and run all services:**
   ```bash
   docker compose up --build
   ```

2. **Run in background:**
   ```bash
   docker compose up -d --build
   ```

3. **Stop services:**
   ```bash
   docker compose down
   ```

## Access Points

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Development

For development with hot reloading:

1. **Backend only:**
   ```bash
   docker compose up backend
   ```

2. **Frontend only:**
   ```bash
   docker compose up frontend
   ```

## Volumes

The backend service mounts the `backend/` directory as a volume for development, allowing code changes without rebuilding the container.

**Database Persistence**: The SQLite database (`storage_performance.db`) is stored in a Docker volume (`docker_sqlite_data`) to persist data between container restarts.

## Environment Variables

- `VITE_API_URL`: API endpoint for frontend (default: http://localhost:8000)
- `PYTHONPATH`: Python path for backend (default: /app) 
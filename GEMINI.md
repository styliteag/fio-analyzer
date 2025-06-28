# About This Project

This project is a web-based application for visualizing and analyzing storage performance data from `fio`, a popular tool for benchmarking and stress testing I/O performance. The application consists of a Node.js backend that provides a RESTful API for managing and retrieving performance data, and a React frontend that allows users to upload `fio` output files, view interactive charts of performance metrics, and compare different test runs.

## Tech Stack

### Frontend

- **Framework:** React
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charting:** Chart.js
- **Routing:** React Router

### Backend

- **Framework:** Express.js
- **Language:** JavaScript
- **Database:** SQLite
- **File Uploads:** Multer

## Key Files

- `backend/index.js`: The main entry point for the Node.js backend, defining the Express server and API endpoints.
- `backend/db/database.db`: The SQLite database file where performance data is stored.
- `frontend/src/App.tsx`: The main React component that sets up the application's routing and layout.
- `frontend/src/pages/Dashboard.tsx`: The React component for the main dashboard, which displays the interactive charts.
- `frontend/src/pages/Upload.tsx`: The React component for the file upload page.
- `frontend/src/components/InteractiveChart.tsx`: The React component that renders the performance charts using Chart.js.
- `docker/compose.yml`: The Docker Compose file for building and running the application in containers.

## Commands

- `npm start` (in `backend`): Starts the Node.js backend server.
- `npm run dev` (in `frontend`): Starts the Vite development server for the frontend.
- `npm run build` (in `frontend`): Builds the frontend for production.
- `docker-compose up` (in `docker`): Builds and starts the entire application using Docker Compose.# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Storage Performance Visualizer** - a full-stack web application that analyzes and visualizes FIO (Flexible I/O Tester) benchmark results. The application consists of:

- **Frontend**: React + TypeScript + Vite application with interactive charts (in `frontend/` directory)
- **Backend**: Express.js Node.js server with SQLite database (in `backend/` directory)
- **Database**: SQLite with test runs and performance metrics tables

## Key Commands

### Development
```bash
# Frontend development (in frontend/ directory)
cd frontend
npm install                    # Install frontend dependencies  
npm run dev                   # Start Vite dev server (http://localhost:5173)
npm run build                 # Build frontend for production
npm run lint                  # Run ESLint on TypeScript files
npm run preview               # Preview production build

# Backend development (in backend/ directory)
cd backend
npm install                   # Install Node.js dependencies
npm start                     # Start Express server (http://localhost:8000)

# Docker deployment
docker-compose up --build     # Run full stack in containers (from docker/ directory)
```

### Run the Server

if the backend and frontend server need to be run you can ask the User to start them. He Maybe will start ./start-frontend-backend.sh to run the servers

### Database
- SQLite database auto-initializes with sample data on first run
- Database path: `backend/db/storage_performance.db` 
- Docker volume mount: `./data/backend/db:/app/db`

## Architecture

### Backend (Express.js/Node.js)
- **index.js**: Single file containing all API endpoints and database logic
- **Database Schema**:
  - `test_runs`: Test execution metadata (drive info, test params, timestamps)
  - `performance_metrics`: Performance data (IOPS, latency, throughput)
- **Key Endpoints**:
  - `GET /api/test-runs`: List all test runs
  - `GET /api/performance-data`: Get metrics for specific test runs

### Frontend (React + TypeScript)
- **App.tsx**: Main application component orchestrating data flow
- **Components**:
  - `TestRunSelector`: Multi-select dropdown for choosing test runs
  - `TemplateSelector`: Chart template/visualization picker  
  - `InteractiveChart`: Chart.js-powered data visualization
- **Types**: All TypeScript interfaces defined in `src/types/index.ts`

### Data Flow
1. User selects test runs via `TestRunSelector`
2. User picks visualization template via `TemplateSelector` 
3. `App.tsx` fetches performance data from backend API
4. `InteractiveChart` renders data using Chart.js with custom templates

### Docker Setup
- Frontend runs on port 3000 in containers
- Backend runs on port 8000 in containers  
- Services communicate via internal `fio-network`
- Backend API URL for frontend: `http://backend:8000` (in containers)

## Supported Metrics
- IOPS (Input/Output Operations Per Second)
- Average latency (ms)
- Throughput (MB/s) 
- P95/P99 latency percentiles (ms)

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Chart.js, Lucide React icons
- **Backend**: Express.js, Node.js, SQLite3, CORS
- **Development**: ESLint for linting, Docker for containerization
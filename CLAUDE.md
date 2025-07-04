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
- **API Documentation**: Comprehensive Swagger UI available at:
  - Development: http://localhost:8000/api-docs
  - Docker: http://localhost/api-docs (or your server URL + /api-docs)
- **Database Schema**:
  - `test_runs`: Test execution metadata (drive info, test params, timestamps)
  - `performance_metrics`: Performance data (IOPS, latency, throughput)
- **Key Endpoints**:
  - `GET /api/test-runs`: List all test runs (admin only)
  - `GET /api/test-runs/performance-data`: Get metrics for specific test runs (admin only)
  - `POST /api/import`: Upload FIO test results (admin or uploader)
  - `GET /api/filters`: Get filter options (admin only)
  - `PUT /api/test-runs/:id`: Update test run metadata (admin only)
  - **Time-series endpoints** (admin only):
    - `GET /api/time-series/servers`: List servers with test statistics
    - `GET /api/time-series/latest`: Latest test results per server
    - `GET /api/time-series/history`: Historical data with time range filtering
    - `GET /api/time-series/trends`: Trend analysis with moving averages
  - **Full API reference**: See Swagger UI at `/api-docs` for all 14 documented endpoints

### Important: Swagger Documentation Maintenance
- **ALWAYS update Swagger JSDoc comments** when adding/modifying API endpoints in `backend/index.js`
- All endpoints must have proper `@swagger` documentation blocks
- Swagger UI provides interactive testing and comprehensive API reference
- Use existing endpoints as templates for consistent documentation style
- **Docker nginx configuration**: The nginx proxy requires a specific rule for `/api-docs` since it doesn't match the `/api/` pattern

### Frontend (React + TypeScript) - Modular Architecture

#### **Core Structure (Refactored 2024)**
```
frontend/src/
├── services/           # Business logic layer
│   ├── api/           # API communication
│   ├── data/          # Data transformation & validation
│   └── config/        # Configuration & constants
├── hooks/             # Custom React hooks
│   └── api/           # API operation hooks
├── components/        # UI components
│   ├── ui/            # Reusable UI components
│   ├── charts/        # Chart-specific components
│   ├── forms/         # Form components
│   └── layout/        # Layout components
├── features/          # Feature-specific components
└── types/             # TypeScript type definitions
```

#### **Services Layer (`src/services/`)**
- **API Services** (`api/`): Modular API clients
  - `base.ts` - Authentication & common API utilities
  - `testRuns.ts` - Test run CRUD operations
  - `performance.ts` - Performance data fetching
  - `timeSeries.ts` - Time-series specific APIs
  - `upload.ts` - File upload with validation
- **Data Services** (`data/`): Data processing utilities
  - `transforms.ts` - Chart data transformation
  - `validators.ts` - Data validation utilities
  - `formatters.ts` - Display formatting functions
- **Configuration** (`config/`): Application configuration
  - `constants.ts` - App constants & validation rules
  - `chartTemplates.ts` - Chart template definitions
  - `theme.ts` - Theme configuration

#### **Custom Hooks (`src/hooks/`)**
- **API Hooks** (`api/`): State management for API operations
  - `useTestRuns.ts` - Test run data management
  - `usePerformanceData.ts` - Performance data with filtering
  - `useTimeSeries.ts` - Time-series data operations
  - `useUpload.ts` - File upload state management

#### **UI Components (`src/components/`)**
- **Core UI Library** (`ui/`): Reusable components
  - `Button.tsx` - Configurable button component
  - `Card.tsx` - Container component with variants
  - `Modal.tsx` - Modal with confirmation variants
  - `Input.tsx` - Form input components
  - `Loading.tsx` - Loading states & skeletons
  - `ErrorDisplay.tsx` - Error handling components
- **Chart Components** (`charts/`): Modular chart system
  - `ChartContainer.tsx` - Main chart orchestrator
  - `ChartControls.tsx` - Interactive controls (sort/group)
  - `ChartRenderer.tsx` - Chart.js rendering with themes
  - `SeriesToggle.tsx` - Series visibility management
  - `ChartExport.tsx` - Export functionality (PNG/CSV/JSON)
  - `ChartStats.tsx` - Chart statistics display
  - `chartProcessors.ts` - Data processing utilities

#### **Legacy Components (Still in use)**
- `TestRunSelector.tsx`: Multi-select dropdown for test runs (614 lines - needs refactoring)
- `TemplateSelector.tsx`: Chart template picker
- `TimeSeriesChart.tsx`: Time-series monitoring (needs refactoring)
- `LoginForm.tsx`: Authentication interface

#### **Interactive Features**
- Sorting by multiple criteria (name, IOPS, latency, block size, etc.)
- Grouping by drive model, test type, protocol, hostname
- Series visibility toggles with bulk controls
- Chart export (PNG/CSV/JSON) with download management
- Fullscreen mode for detailed analysis
- **Time-series monitoring**: Server selection, trend analysis, moving averages
- Theme support (light/dark) with Chart.js integration

#### **Key Architectural Improvements**
- **Separation of Concerns**: Business logic separated from UI components
- **Reusability**: UI components can be used across features
- **Type Safety**: Comprehensive TypeScript interfaces
- **Performance**: Custom hooks with optimized state management
- **Maintainability**: Single responsibility principle applied throughout
- **Testing**: Components can be tested in isolation

### Data Flow (Updated Architecture)
1. **Authentication**: User authenticates via `LoginForm` component
2. **Test Selection**: User selects test runs via `TestRunSelector` (614 lines - legacy)
3. **Template Selection**: User picks visualization template via `TemplateSelector`
4. **Data Fetching**: Custom hooks (`useTestRuns`, `usePerformanceData`) handle API calls
5. **Data Processing**: Service layer (`services/data/`) transforms data for visualization
6. **Chart Rendering**: Modular chart system renders via `ChartContainer` → `ChartRenderer`
7. **User Interaction**: `ChartControls` manage sorting/grouping, `SeriesToggle` manages visibility

#### **Modern Component Usage Pattern**
```typescript
// Using the new modular architecture
import { ChartContainer } from './components/charts';
import { usePerformanceData } from './hooks';

const Dashboard = () => {
    const { data, loading } = usePerformanceData({ testRunIds: [1,2,3] });
    
    return (
        <ChartContainer 
            template={selectedTemplate}
            data={data}
            showControls={true}
            showExport={true}
        />
    );
};
```

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
# BACKEND_URL=http://example.intern  # FIO Analyzer URL (In the docker container)
USERNAME=admin             # Authentication username (default for dev)
PASSWORD=admin             # Authentication password (default for dev)
BLOCK_SIZES=4k,64k,1M      # Test block sizes
TEST_PATTERNS=read,write   # Test patterns
```

## Development Notes & Memories

### Frontend Refactoring Progress (2024)
- ✅ **Services Layer**: Complete modular API, data processing, and configuration
- ✅ **Custom Hooks**: API operations with loading/error states  
- ✅ **UI Component Library**: Reusable Button, Card, Modal, Input, Loading, Error components
- ✅ **Chart System**: Broke down 1076-line `InteractiveChart.tsx` into 7 focused components
- 🔄 **Legacy Components**: `TestRunSelector.tsx` (614 lines) and `TimeSeriesChart.tsx` need refactoring
- ⭐ **Key Achievement**: Transformed monolithic components into maintainable, testable modules

### File Location Quick Reference
```bash
# API Services (NEW)
frontend/src/services/api/{base,testRuns,performance,timeSeries,upload}.ts

# Data Processing (NEW)  
frontend/src/services/data/{transforms,validators,formatters}.ts

# Configuration (NEW)
frontend/src/services/config/{constants,chartTemplates,theme}.ts

# Custom Hooks (NEW)
frontend/src/hooks/api/{useTestRuns,usePerformanceData,useTimeSeries,useUpload}.ts

# UI Components (NEW)
frontend/src/components/ui/{Button,Card,Modal,Input,Loading,ErrorDisplay}.tsx

# Chart System (NEW - replaces old InteractiveChart.tsx)
frontend/src/components/charts/{ChartContainer,ChartControls,ChartRenderer,SeriesToggle,ChartExport,ChartStats}.tsx

# Legacy (needs refactoring)
frontend/src/components/{TestRunSelector,TimeSeriesChart}.tsx
```

### Backend Architecture (Modular)
- **Routes**: `backend/routes/` - API endpoints separated by feature
- **Database**: `backend/database/` - Schema and connection management
- **Utils**: `backend/utils/` - Helper functions and utilities
- **Config**: `backend/config/` - Application configuration

## Memories

- Never try to run "npm run dev" It will block. run "cd frontend ; npm run build" to check for errors or run "cd frontend; npm run dev &" to detach it. Better ask the user to start the frontend!
- To test four build errors run "cd frontend ; npm run build"
- To run the frontend ask the user, or run "cd frontend ; npm run dev &"
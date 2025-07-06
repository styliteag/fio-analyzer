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

## Latest Updates & Architectural Improvements (January 2025)

### Server-Side Filtering Implementation ✅ COMPLETED
**Major Performance Enhancement** - Implemented comprehensive server-side filtering to handle large datasets efficiently:

#### **Backend Enhancements:**
- **Enhanced `/api/test-runs` endpoint** with comprehensive filter parameters:
  - Added support for: `hostnames`, `protocols`, `drive_types`, `drive_models`, `patterns`, `block_sizes`, `syncs`, `queue_depths`, `directs`, `num_jobs`, `test_sizes`, `durations`
  - Parameterized SQL queries for security and performance
  - Updated Swagger documentation with all filter parameters

- **Fixed Time Series Filtering** - Resolved critical disconnect between main test run selection and time series charts:
  - **Problem**: Time series showed unfiltered historical data regardless of main selection filters
  - **Solution**: Extended `/api/time-series/history` and `/api/time-series/trends` endpoints with missing filter parameters (`test_size`, `sync`, `direct`, `num_jobs`, `duration`)
  - **Result**: Perfect alignment between main selection and time series data

#### **Frontend Enhancements:**
- **New `useServerSideTestRuns` hook** with 300ms debouncing for optimal performance
- **Progressive enhancement approach** with feature flags for gradual rollout
- **Admin page integration** with basic server-side filter controls (hostnames, protocols, drive_types)
- **Dashboard preparation** for optional server-side filtering (disabled by default for stability)
- **Updated filter conversion utilities** to support all time series parameters

#### **Filter Flow Architecture:**
```
Main Selection Filters → convertActiveFiltersToTimeSeriesFilters() → 
loadTimeSeriesData() → fetchTimeSeriesHistory() → 
Backend API with ALL parameters → Filtered Time Series Data
```

### Admin Interface Modernization ✅ COMPLETED
**Complete redesign** of the admin interface for better usability and functionality:

#### **Key Features:**
- **Dual View System**: Toggle between "Latest Tests" and "Historical Data" views
- **Advanced Server-Side Filtering**: Real-time filtering with debouncing for performance
- **Bulk Operations**: 
  - Bulk edit metadata fields (hostname, protocol, description, test_name, drive_type, drive_model)
  - Bulk delete with confirmation
- **Historical Data Management**:
  - Timeline view showing test evolution over time
  - History line editing (bulk update historical runs in groups)
  - History deletion (remove historical runs while keeping latest)
- **Enhanced UX**: 
  - Clean card-based design with dark mode support
  - Real-time search and filtering
  - Responsive layout for mobile devices
  - Progress indicators and loading states

#### **Component Replacement:**
- **Removed**: Legacy `Admin.tsx` (complex, hard to maintain)
- **Replaced with**: New streamlined `Admin.tsx` (clean, modular architecture)
- **Updated routing**: Seamless transition maintaining `/admin` path

## Development Notes & Memories

### Frontend Refactoring Progress (2024) - COMPLETED ✅
- ✅ **Services Layer**: Complete modular API, data processing, and configuration
- ✅ **Custom Hooks**: API operations with loading/error states  
- ✅ **UI Component Library**: Reusable Button, Card, Modal, Input, Loading, Error components
- ✅ **Chart System**: Broke down 1076-line `InteractiveChart.tsx` into 7 focused components
- ✅ **TestRunSelector Refactored**: Split 614-line component into modular hooks + components
- ✅ **TimeSeriesChart Refactored**: Split 591-line component into 8 focused components with utilities
- ✅ **Dashboard Layout**: Improved with focused layout components (Header, Footer, WelcomeGuide, ChartArea)
- ✅ **Performance Optimization**: Fixed chart flickering with React.useMemo optimizations
- ✅ **Build & Lint Clean**: Zero TypeScript errors, zero ESLint warnings
- ⭐ **Key Achievement**: Complete transformation from monolithic to modular, maintainable architecture

### Comprehensive Frontend Refactoring (December 2024)

#### **Completed Major Refactoring**
This project underwent a complete frontend architectural transformation, breaking down large monolithic components into focused, maintainable modules:

**Before vs After:**
- **InteractiveChart.tsx**: 1076 lines → 7 focused chart components + utilities
- **TestRunSelector.tsx**: 614 lines → modular hooks + component architecture  
- **TimeSeriesChart.tsx**: 591 lines → 8 focused components + utilities
- **Dashboard.tsx**: Improved with 4 dedicated layout components

#### **New Modular Component Architecture**

**Chart System (`components/charts/`):**
- `ChartContainer.tsx` - Main orchestrator (replaces old InteractiveChart)
- `ChartControls.tsx` - Interactive controls for sorting/grouping
- `ChartRenderer.tsx` - Chart.js rendering with theme integration
- `SeriesToggle.tsx` - Series visibility management with bulk controls
- `ChartExport.tsx` - Export functionality (PNG/CSV/JSON)
- `ChartStats.tsx` - Chart statistics display
- `chartProcessors.ts` - Data processing utilities

**TestRun Components (`components/testRuns/`):**
- `TestRunSelector.tsx` - Main orchestrator (much smaller)
- `TestRunFilters.tsx` - Filter controls for drive types, models, patterns
- `TestRunGrid.tsx` - Responsive grid display for selected runs
- `TestRunActions.tsx` - Action buttons for bulk operations
- Custom hooks: `useTestRunFilters.ts`, `useTestRunSelection.ts`, `useTestRunOperations.ts`

**TimeSeries Components (`components/timeSeries/`):**
- `TimeSeriesContainer.tsx` - Main orchestrator
- `TimeSeriesControls.tsx` - Control panel (server selection, time range, metrics)
- `TimeSeriesChart.tsx` - Pure chart rendering component
- `TimeSeriesStats.tsx` - Server statistics display
- Custom hooks: `useTimeSeriesData.ts`, `useTimeSeriesChart.ts`
- Utilities: `timeSeriesHelpers.ts` - Data processing functions

**Layout Components (`components/layout/`):**
- `DashboardHeader.tsx` - Navigation and user controls
- `DashboardFooter.tsx` - Links and information
- `WelcomeGuide.tsx` - Getting started guide for new users
- `ChartArea.tsx` - Chart rendering area with loading states

#### **Performance Improvements**
- **Chart Flickering Fixed**: Added React.useMemo optimizations to prevent unnecessary re-renders
- **Stable Hook Options**: Memoized hook parameters to prevent API call loops
- **Efficient State Management**: Custom hooks with proper dependency arrays
- **Optimized Data Processing**: Separated data transformation from UI components

#### **Developer Experience Improvements**
- **Type Safety**: Comprehensive TypeScript interfaces throughout
- **Error Handling**: Consistent error states and user feedback
- **Testing Ready**: Components can be unit tested in isolation
- **Documentation**: Clear separation of concerns with focused responsibilities
- **ESLint Clean**: All linting issues resolved (including React Three Fiber false positives)

### File Location Quick Reference
```bash
# API Services
frontend/src/services/api/{base,testRuns,performance,timeSeries,upload}.ts

# Data Processing  
frontend/src/services/data/{transforms,validators,formatters}.ts

# Configuration
frontend/src/services/config/{constants,chartTemplates,theme}.ts

# Custom Hooks
frontend/src/hooks/api/{useTestRuns,usePerformanceData,useTimeSeries,useUpload}.ts
frontend/src/hooks/{useTestRunFilters,useTestRunSelection,useTestRunOperations}.ts
frontend/src/hooks/{useTimeSeriesData,useTimeSeriesChart}.ts

# UI Components
frontend/src/components/ui/{Button,Card,Modal,Input,Loading,ErrorDisplay}.tsx

# Chart System (Modular - replaces old 1076-line InteractiveChart.tsx)
frontend/src/components/charts/{ChartContainer,ChartControls,ChartRenderer,SeriesToggle,ChartExport,ChartStats}.tsx

# TestRun System (Modular - replaces old 614-line TestRunSelector.tsx)
frontend/src/components/testRuns/{TestRunSelector,TestRunFilters,TestRunGrid,TestRunActions}.tsx

# TimeSeries System (Modular - replaces old 591-line TimeSeriesChart.tsx)
frontend/src/components/timeSeries/{TimeSeriesContainer,TimeSeriesControls,TimeSeriesChart,TimeSeriesStats}.tsx
frontend/src/utils/timeSeriesHelpers.ts

# Layout Components
frontend/src/components/layout/{DashboardHeader,DashboardFooter,WelcomeGuide,ChartArea}.tsx

# Legacy Components (Still used but modernized)
frontend/src/components/{TemplateSelector,LoginForm,ThemeToggle}.tsx
```

### Backend Architecture (Modular)
- **Routes**: `backend/routes/` - API endpoints separated by feature
- **Database**: `backend/database/` - Schema and connection management
- **Utils**: `backend/utils/` - Helper functions and utilities
- **Config**: `backend/config/` - Application configuration

## Important Technical Considerations & Workflow

### **Build & Development**
- **Building**: Always run `npm run build` from the frontend root (not `cd frontend; npm run build`)
- **Development Server**: Never run `npm run dev` directly - it will block. Either:
  - Ask the user to start the frontend server
  - Run `cd frontend; npm run dev &` to detach it
- **Error Checking**: Use `npm run build` to check for TypeScript/build errors
- **Linting**: Always run `npm run lint` to ensure code quality (zero warnings policy)

### **Server-Side vs Client-Side Filtering**
- **Admin Page**: Uses server-side filtering by default (`useServerSideFiltering = true`)
- **Dashboard Page**: Uses client-side filtering by default (`useServerSideFiltering = false`) for stability
- **Time Series**: Always respects main selection filters through unified filter conversion
- **Performance**: Server-side filtering essential for large datasets (>10K records)

### **Critical Bug Fix Applied (Jan 2025)**
- **Time Series Filtering**: Fixed major disconnect where time series charts ignored main selection filters
- **Root Cause**: Missing filter parameters in time series API endpoints
- **Impact**: Now ensures data consistency across all views - main selection filters properly apply to time series historical data

## Memories
- Always use "2025-06-31" as date and 20:00:00 as time and "2025-06-31 20:00:00" as datetime
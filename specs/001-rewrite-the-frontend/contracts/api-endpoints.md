# API Contracts for Vue Frontend

## Core Endpoints (No Changes - Backend Unchanged)

### Authentication
- `POST /api/auth/login` - User authentication
- `GET /api/auth/logout` - User logout

### Data Retrieval
- `GET /api/test-runs` - List test runs with filtering
- `GET /api/test-runs/performance-data` - Performance metrics
- `GET /api/time-series/*` - Time-series data endpoints
- `GET /api/filters` - Available filter options
- `GET /api/info` - System information

### Upload & Admin
- `POST /api/import` - Upload FIO JSON files
- `POST /api/users/` - Create user (admin)
- `PUT /api/users/{username}` - Update user (admin)
- `DELETE /api/users/{username}` - Delete user (admin)

## Vue Component Mapping

### Pages to Endpoints
- **Home**: `/api/info`
- **Filters**: `/api/filters`
- **TestRuns**: `/api/test-runs`
- **Performance**: `/api/test-runs/performance-data`
- **Compare**: `/api/test-runs` + filtering
- **History**: `/api/time-series/*`
- **Upload**: `POST /api/import`
- **Admin Users**: `/api/users/*`

## Chart Data Contracts

### Radar Chart Data
- **Endpoint**: `/api/test-runs/performance-data`
- **Response**: Performance metrics for radar visualization
- **Requirements**: ≤5 datasets × ≤200 points for <500ms render
- **Format**: Compatible with Chart.js radar data structure

### 3D Chart Data
- **Endpoint**: `/api/test-runs` with aggregation params
- **Response**: X/Y/Z coordinate data with performance metrics
- **Format**: Three.js compatible geometry data

### Performance Benchmarks
- **Chart Render Time**: <500ms for typical datasets
- **Data Loading**: Request cancellation support via AbortController
- **Memory Usage**: Optimize for large dataset visualization
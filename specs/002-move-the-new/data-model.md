# Data Model: Vue Frontend Migration

## Entities Overview

This migration preserves the existing data model from the React frontend. No new entities are created, but Vue-specific interfaces and types are defined for TypeScript support.

## Frontend Data Entities

### TestRun
**Purpose**: Represents a performance benchmark test result
**Fields**:
- `id`: number (unique identifier)
- `hostname`: string (system hostname)
- `drive_type`: string (storage device type)
- `test_type`: string (FIO test configuration)
- `timestamp`: string (ISO 8601 datetime)
- `iops_read`: number (read IOPS)
- `iops_write`: number (write IOPS)
- `latency_read_avg`: number (average read latency ms)
- `latency_write_avg`: number (average write latency ms)
- `latency_read_p95`: number (95th percentile read latency ms)
- `latency_write_p95`: number (95th percentile write latency ms)
- `latency_read_p99`: number (99th percentile read latency ms)
- `latency_write_p99`: number (99th percentile write latency ms)
- `bandwidth_read`: number (read bandwidth MB/s)
- `bandwidth_write`: number (write bandwidth MB/s)

**Validation Rules**:
- All numeric fields must be positive
- Timestamp must be valid ISO 8601 format
- Backend API handles all validation

**Relationships**:
- Belongs to a Host (hostname)
- Part of historical test data collection

### HostConfiguration
**Purpose**: System specifications and metadata
**Fields**:
- `hostname`: string (primary key)
- `cpu_model`: string (processor information)
- `memory_gb`: number (RAM capacity)
- `os_version`: string (operating system)
- `drive_type`: string (storage type)
- `last_test_date`: string (most recent test timestamp)

**Validation Rules**:
- Hostname must be unique
- Memory must be positive number
- Backend API handles validation

### ChartData
**Purpose**: Formatted data for chart visualizations
**Fields**:
- `labels`: string[] (chart axis labels)
- `datasets`: ChartDataset[] (chart data series)
- `options`: ChartOptions (chart configuration)

**Chart Data Types**:
- `RadarChartData`: Multi-metric performance comparison
- `LineChartData`: Time-series performance trends
- `BarChartData`: Comparative performance metrics
- `ScatterChartData`: Multi-dimensional analysis

### UserSession
**Purpose**: Authentication and user state
**Fields**:
- `username`: string (user identifier)
- `role`: 'admin' | 'uploader' (permission level)
- `isAuthenticated`: boolean (login status)
- `token`: string | null (auth token)

**Validation Rules**:
- Username required when authenticated
- Role must be valid enum value
- Backend handles authentication logic

### FilterState
**Purpose**: Data filtering and selection state
**Fields**:
- `hostnames`: string[] (selected hosts)
- `driveTypes`: string[] (selected drive types)
- `testTypes`: string[] (selected test types)
- `dateRange`: { start: string, end: string } (time filter)
- `activeFilters`: Record<string, any> (dynamic filters)

**State Management**:
- Reactive refs in Vue composables
- Persisted to localStorage for user preference
- Synchronized with URL query parameters

### ExportConfiguration
**Purpose**: Data export settings and formats
**Fields**:
- `format`: 'csv' | 'json' | 'excel' (export type)
- `includeCharts`: boolean (include visualizations)
- `dateRange`: { start: string, end: string } (data scope)
- `selectedMetrics`: string[] (performance metrics to include)

## Vue-Specific Type Definitions

### Reactive Data Types
```typescript
// Vue composition API types
type TestRunRef = Ref<TestRun[]>
type FilterStateRef = Ref<FilterState>
type LoadingStateRef = Ref<boolean>
type ErrorStateRef = Ref<string | null>
```

### Component Props Interfaces
```typescript
interface ChartComponentProps {
  data: ChartData
  height?: number
  options?: ChartOptions
}

interface FilterComponentProps {
  modelValue: FilterState
  availableOptions: FilterOptions
}

interface TableComponentProps {
  testRuns: TestRun[]
  sortable?: boolean
  paginated?: boolean
}
```

### Composable Return Types
```typescript
interface UseTestRunsReturn {
  testRuns: TestRunRef
  loading: LoadingStateRef
  error: ErrorStateRef
  fetchTestRuns: () => Promise<void>
  refreshData: () => Promise<void>
}

interface UseAuthReturn {
  user: Ref<UserSession | null>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  isAuthenticated: ComputedRef<boolean>
}
```

## State Transitions

### Authentication Flow
1. **Unauthenticated** → Login attempt → **Authenticating**
2. **Authenticating** → Success → **Authenticated**
3. **Authenticating** → Failure → **Unauthenticated**
4. **Authenticated** → Logout → **Unauthenticated**
5. **Authenticated** → Token expiry → **Unauthenticated**

### Data Loading Flow
1. **Initial** → Fetch request → **Loading**
2. **Loading** → Success → **Loaded**
3. **Loading** → Error → **Error**
4. **Loaded** → Refresh → **Loading**
5. **Error** → Retry → **Loading**

### Filter Application Flow
1. **Default** → User selection → **Filtering**
2. **Filtering** → Apply filters → **Filtered**
3. **Filtered** → Clear filters → **Default**
4. **Filtered** → Modify filters → **Filtering**

## Data Relationships

```
TestRun ──┐
          ├── HostConfiguration (hostname)
          └── FilterState (selection criteria)

ChartData ── TestRun[] (aggregated data)

UserSession ── Authentication state
             └── Permission level (admin/uploader)

ExportConfiguration ── TestRun[] (selected data)
                    └── ChartData (optional visualizations)
```

## Migration Considerations

### Data Compatibility
- All data structures compatible with existing React frontend
- API response formats unchanged
- Database schema unchanged
- TypeScript interfaces preserve type safety

### Performance Impact
- Vue reactivity system automatically tracks data changes
- Computed properties optimize derived data calculations
- Ref/reactive minimize unnecessary re-renders
- Same data loading patterns as React version

### Validation Strategy
- Frontend validation minimal (basic type checking)
- Backend API provides comprehensive validation
- Vue TypeScript checking prevents type errors
- Runtime validation handled by API responses
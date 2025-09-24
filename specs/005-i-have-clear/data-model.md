# Data Model: Vue.js Frontend Dashboard

## Overview
Data models and interfaces for the Vue.js frontend dashboard, defining TypeScript interfaces for API integration, state management, and component props.

## Core Entities

### TestRun
Performance test execution record containing configuration parameters, performance metrics, and system metadata.

```typescript
interface TestRun {
  // Identity
  id: number;
  timestamp: string; // ISO 8601 format

  // System Information
  hostname: string;
  drive_model: string;
  drive_type: string; // "NVMe", "SATA", "SAS"
  protocol: string; // "Local", "iSCSI", "NFS"

  // Test Configuration
  test_name: string;
  description?: string;
  block_size: string; // "4K", "8K", "64K", "1M"
  read_write_pattern: string; // "randread", "randwrite", "read", "write"
  queue_depth: number;
  duration: number; // seconds
  num_jobs: number;
  direct: 0 | 1; // 0=buffered, 1=direct
  sync: 0 | 1; // 0=async, 1=sync
  test_size: string; // "1G", "10G", "100G"

  // Performance Metrics
  iops: number;
  avg_latency: number; // milliseconds
  bandwidth: number; // MB/s
  p95_latency?: number; // milliseconds
  p99_latency?: number; // milliseconds

  // Additional Fields
  fio_version?: string;
  job_runtime?: number;
  rwmixread?: number;
  total_ios_read?: number;
  total_ios_write?: number;
  usr_cpu?: number;
  sys_cpu?: number;
  output_file?: string;
  is_latest?: boolean;
}
```

### FilterOptions
Available filter values for each filterable field, retrieved dynamically from actual test data.

```typescript
interface FilterOptions {
  drive_models: string[];
  host_disk_combinations: string[]; // "hostname - protocol - drive_model"
  block_sizes: string[];
  patterns: string[]; // read_write_pattern values
  syncs: number[]; // 0, 1
  queue_depths: number[];
  directs: number[]; // 0, 1
  num_jobs: number[];
  test_sizes: string[];
  durations: number[]; // seconds
  hostnames: string[];
  protocols: string[];
  drive_types: string[];
}
```

### PerformanceMetrics
Measured performance values with appropriate units and statistical summaries.

```typescript
interface PerformanceMetrics {
  iops: {
    value: number;
    unit: 'IOPS';
  };
  avg_latency: {
    value: number;
    unit: 'ms';
  };
  bandwidth: {
    value: number;
    unit: 'MB/s';
  };
  responsiveness: {
    value: number; // iops / avg_latency
    unit: 'IOPS/ms';
  };
  p95_latency?: {
    value: number;
    unit: 'ms';
  };
  p99_latency?: {
    value: number;
    unit: 'ms';
  };
}

interface PerformanceSummary {
  total_tests: number;
  avg_iops: number;
  avg_latency: number;
  avg_bandwidth: number;
  max_iops: number;
  min_latency: number;
  variance_iops: number;
  variance_latency: number;
}
```

### VisualizationConfig
Chart and heatmap configuration options including view modes, color schemes, and performance zone definitions.

```typescript
interface VisualizationConfig {
  mode: 'absolute' | 'normalized';
  colorScheme: 'default' | 'accessible' | 'high-contrast';
  showLegend: boolean;
  showTooltips: boolean;
  performanceZones: {
    high_performance: {
      color: string;
      threshold: { iops: number; latency: number };
    };
    balanced: {
      color: string;
      threshold: { iops: number; latency: number };
    };
    high_latency: {
      color: string;
      threshold: { iops: number; latency: number };
    };
    low_performance: {
      color: string;
      threshold: { iops: number; latency: number };
    };
  };
}

interface HeatmapConfig extends VisualizationConfig {
  scaling: 'relative' | 'absolute';
  metrics: ('iops' | 'bandwidth' | 'responsiveness')[]; // responsiveness = iops / avg_latency
  cellSize: number;
  colorRange: [string, string]; // [min_color, max_color]
}

interface ChartConfig extends VisualizationConfig {
  type: 'line' | 'bar' | 'scatter' | 'radar' | 'parallel';
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  aggregation?: 'avg' | 'max' | 'min' | 'sum';
}
```

### SystemStatus
Real-time status indicators for backend services with health check results.

```typescript
interface SystemStatus {
  backend_api: ServiceStatus;
  database: ServiceStatus;
  file_storage: ServiceStatus;
  authentication: ServiceStatus;
  last_updated: string; // ISO 8601 format
}

interface ServiceStatus {
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  message?: string;
  response_time?: number; // milliseconds
  last_check: string; // ISO 8601 format
}
```

### UserAccount
User authentication and authorization data including username, role, and permission levels.

```typescript
interface UserAccount {
  username: string;
  role: 'admin' | 'uploader';
  permissions: Permission[];
  created_at?: string;
  last_login?: string;
}

interface Permission {
  resource: string; // 'test-runs', 'users', 'upload', 'filters'
  actions: ('read' | 'write' | 'delete')[];
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserAccount | null;
  token?: string;
  expires_at?: string;
}
```

## Frontend-Specific Models

### UI State Models

```typescript
interface FilterState {
  active: {
    [category: string]: string[]; // OR logic within categories
  };
  available: FilterOptions;
  applied: boolean;
}

interface HostSelection {
  selected: string[]; // hostnames
  available: string[];
  persisted: boolean; // persist across pages
}

interface DashboardStats {
  total_test_runs: number;
  active_servers: number;
  avg_iops: number;
  avg_latency: number;
  last_upload: string; // relative time like "9 days ago"
  total_hostnames: string; // "6 / 6" format
}

interface RecentActivity {
  id: string;
  type: 'upload' | 'analysis';
  description: string;
  timestamp: string; // relative time like "9 days ago"
  hostname?: string;
}
```

### Chart Data Models

```typescript
interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  metadata?: Partial<TestRun>;
}

interface HeatmapCell {
  x: string; // host or configuration
  y: string; // pattern or block size
  value: number;
  color: string;
  tooltip: string;
  metadata: Partial<TestRun>;
}

interface ScatterPoint extends ChartDataPoint {
  zone: 'high_performance' | 'balanced' | 'high_latency' | 'low_performance';
  size?: number;
  color?: string;
}
```

### API Response Models

```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  request_id?: string;
}

interface ApiError {
  error: string;
  request_id?: string;
  status_code: number;
  details?: unknown;
}

interface HealthCheckResponse {
  status: 'OK';
  timestamp: string;
  version: string;
}
```

### Component Props Models

```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

interface FilterSectionProps {
  title: string;
  options: string[] | number[];
  selected: (string | number)[];
  multiSelect: boolean;
  onSelectionChange: (selected: (string | number)[]) => void;
}

interface ChartContainerProps {
  title: string;
  type: ChartConfig['type'];
  data: ChartDataPoint[];
  config: ChartConfig;
  loading?: boolean;
  error?: string;
}
```

## Validation Rules

### TestRun Validation
```typescript
const testRunValidation = {
  id: (value: unknown): value is number => typeof value === 'number' && value > 0,
  hostname: (value: unknown): value is string => typeof value === 'string' && value.length > 0,
  iops: (value: unknown): value is number => typeof value === 'number' && value >= 0,
  avg_latency: (value: unknown): value is number => typeof value === 'number' && value >= 0,
  block_size: (value: unknown): value is string =>
    typeof value === 'string' && ['1K', '2K', '4K', '8K', '16K', '32K', '64K', '128K', '1M'].includes(value),
  read_write_pattern: (value: unknown): value is string =>
    typeof value === 'string' && ['randread', 'randwrite', 'read', 'write', 'rw'].includes(value),
};
```

### FilterOptions Validation
```typescript
const filterOptionsValidation = {
  validateResponse: (data: unknown): data is FilterOptions => {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;

    return Array.isArray(obj.hostnames) &&
           Array.isArray(obj.drive_types) &&
           Array.isArray(obj.protocols) &&
           Array.isArray(obj.block_sizes) &&
           Array.isArray(obj.patterns);
  }
};
```

## State Transitions

### Authentication State
```
Unauthenticated → Authenticating → Authenticated → Authenticated (refresh) → Unauthenticated (logout)
                                ↳ Authentication Failed ↗
```

### Data Loading State
```
Initial → Loading → Loaded → Refreshing → Loaded
        ↳ Error ↗           ↳ Error ↗
```

### Filter State
```
Empty → Selecting → Applied → Modified → Applied
      ↳ Reset ↗             ↳ Reset ↗
```

## Persistence Strategy

### localStorage Schema
```typescript
interface PersistedState {
  auth: {
    token?: string;
    user?: UserAccount;
    expires_at?: string;
  };
  hostSelection: {
    selected: string[];
    timestamp: string;
  };
  userPreferences: {
    theme: 'light' | 'dark';
    defaultVisualization: string;
    chartConfigs: Record<string, ChartConfig>;
  };
  filterHistory: {
    recent: FilterState[];
    favorites: FilterState[];
  };
}
```

### Session Storage Schema
```typescript
interface SessionState {
  currentRoute: string;
  scrollPositions: Record<string, number>;
  temporaryFilters: FilterState;
  chartStates: Record<string, any>;
}
```

## Error Handling Models

### Error Classification
```typescript
type ErrorCategory =
  | 'network'           // Connection failures, timeouts
  | 'authentication'    // 401, 403 errors
  | 'validation'        // 400 errors, malformed data
  | 'server'           // 500 errors
  | 'not_found'        // 404 errors
  | 'rate_limit'       // 429 errors
  | 'unknown';         // Unexpected errors

interface AppError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  details?: unknown;
  timestamp: string;
  context?: {
    url?: string;
    method?: string;
    payload?: unknown;
  };
}
```

### Error State Models
```typescript
interface ErrorState {
  errors: AppError[];
  displayedErrors: string[]; // IDs of errors shown to user
  consoleErrors: string[];   // IDs of errors logged to console
}

interface ComponentErrorState {
  hasError: boolean;
  error?: AppError;
  retry?: () => void;
  fallback?: React.ComponentType;
}
```
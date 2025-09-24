// TypeScript interfaces for FIO Analyzer Vue Frontend
// Re-export shared API contracts so components stay in sync with backend responses
export type { TestRun, FilterOptions, TestRunFilters } from '@/services/apiClient'

export interface TimeSeriesData {
  timestamps: string[]
  values: number[]
  metric: string
  hostname: string
}

// User and Authentication Types
export interface UserSession {
  username: string
  role: 'admin' | 'uploader'
  isAuthenticated: boolean
  token: string | null
}

export interface LoginCredentials {
  username: string
  password: string
}

// Host Configuration
export interface HostConfiguration {
  hostname: string
  cpu_model: string
  memory_gb: number
  os_version: string
  drive_type: string
  last_test_date: string
}

// Chart Data Types
export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
  fill?: boolean
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartOptions {
  responsive?: boolean
  maintainAspectRatio?: boolean
  plugins?: {
    title?: {
      display: boolean
      text: string
    }
    legend?: {
      display: boolean
      position?: 'top' | 'bottom' | 'left' | 'right'
    }
  }
  scales?: {
    x?: {
      display: boolean
      title?: {
        display: boolean
        text: string
      }
    }
    y?: {
      display: boolean
      title?: {
        display: boolean
        text: string
      }
      beginAtZero?: boolean
    }
  }
}

// Specific Chart Types
export interface RadarChartData extends ChartData {
  datasets: (ChartDataset & {
    pointBackgroundColor?: string
    pointBorderColor?: string
    pointHoverBackgroundColor?: string
    pointHoverBorderColor?: string
  })[]
}

export interface LineChartData extends ChartData {
  datasets: (ChartDataset & {
    tension?: number
    pointRadius?: number
    pointHoverRadius?: number
  })[]
}

export interface BarChartData extends ChartData {
  datasets: (ChartDataset & {
    borderRadius?: number
    borderSkipped?: boolean
  })[]
}

export interface ScatterChartData {
  datasets: {
    label: string
    data: { x: number; y: number }[]
    backgroundColor: string
    borderColor: string
  }[]
}

// Filter State Management
export interface FilterState {
  hostnames: string[]
  driveTypes: string[]
  testTypes: string[]
  dateRange: {
    start: string
    end: string
  } | null
  activeFilters: Record<string, string | string[] | number | boolean | null>
}

// Export Configuration
export interface ExportConfiguration {
  format: 'csv' | 'json' | 'excel'
  includeCharts: boolean
  dateRange: {
    start: string
    end: string
  } | null
  selectedMetrics: string[]
}

// Vue Composable Return Types
export interface UseTestRunsReturn {
  testRuns: Ref<TestRun[]>
  filterOptions: Ref<FilterOptions>
  loading: Ref<boolean>
  error: Ref<string | null>
  fetchTestRuns: (filters?: TestRunFilters) => Promise<TestRun[]>
  fetchFilterOptions: () => Promise<void>
  refreshData: () => Promise<void>
  getTestRunById: (id: number) => TestRun | undefined
  getTestRunsByHostname: (hostname: string) => TestRun[]
  getUniqueHostnames: ComputedRef<string[]>
  getUniqueDriveTypes: ComputedRef<string[]>
  getUniqueTestTypes: ComputedRef<string[]>
  getLatestTestRuns: ComputedRef<TestRun[]>
  getPerformanceMetrics: (testRun: TestRun) => PerformanceMetrics
}

export interface UseAuthReturn {
  user: ComputedRef<UserSession | null>
  isAuthenticated: ComputedRef<boolean>
  userRole: ComputedRef<'admin' | 'uploader' | null>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  initializeAuth: () => void
  hasPermission: (requiredRole: 'admin' | 'uploader') => boolean
}

export interface UseFiltersReturn {
  filters: Ref<FilterState>
  applyFilters: (newFilters: Partial<FilterState>) => void
  clearFilters: () => void
  isFilterActive: ComputedRef<boolean>
  getActiveFilterCount: ComputedRef<number>
}

export interface UseErrorHandlerReturn {
  error: Ref<string | null>
  setError: (message: string) => void
  clearError: () => void
  handleApiError: (error: unknown) => void
}

// Performance Metrics Interface
export interface PerformanceMetrics {
  iops: {
    read: number | null
    write: number | null
    total: number | null
  }
  latency: {
    read: {
      avg: number | null
      p95: number | null
      p99: number | null
    }
    write: {
      avg: number | null
      p95: number | null
      p99: number | null
    }
  }
  bandwidth: {
    read: number | null
    write: number | null
    total: number | null
  }
}

// Component Props Interfaces
export interface ChartComponentProps {
  data: ChartData
  height?: number
  width?: number
  options?: ChartOptions
}

export interface FilterComponentProps {
  modelValue: FilterState
  availableOptions: FilterOptions
}

export interface TableComponentProps {
  testRuns: TestRun[]
  sortable?: boolean
  paginated?: boolean
  pageSize?: number
}

export interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  showPageInfo?: boolean
}

// Pagination Emits
export interface PaginationEmits {
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
}

// Vue 3 Composition API imports for type completion
import type { Ref, ComputedRef } from 'vue'

// Export visualization-specific types
export * from './performance'
export * from './filters'
export * from './visualization'

// Route Meta Interface for TypeScript router
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    title?: string
  }
}

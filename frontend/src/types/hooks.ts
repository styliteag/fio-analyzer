/**
 * Hook-specific type definitions
 * Provides proper typing for custom hooks instead of 'any'
 */

// Generic async state
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Extended async state with additional properties
export interface ExtendedAsyncState<T> extends AsyncState<T> {
  isEmpty: boolean;
  lastFetched?: Date;
  refetchCount?: number;
}

// Hook options interface
export interface BaseHookOptions<T = unknown> {
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: string | Error) => void;
  onSettled?: () => void;
  retryCount?: number;
  retryDelay?: number;
}

import type { ValidationResult } from './api';

// Async data hook options
export interface AsyncDataOptions<T> extends BaseHookOptions<T> {
  autoFetch?: boolean;
  validateData?: boolean;
  validator?: (data: T) => ValidationResult;
  enableLogging?: boolean;
  resetDataOnError?: boolean;
  initialData?: T | null;
  refetchInterval?: number;
  staleTime?: number;
}

// API call hook options
export interface ApiCallOptions<T> extends BaseHookOptions<T> {
  onSuccess?: (data: T) => void | Promise<void>;
  resetDataOnError?: boolean;
  initialData?: T | null;
  showProgress?: boolean;
  enableLogging?: boolean;
}

// Progress tracking interface
export interface ProgressState {
  current: number;
  total: number;
  percentage?: number;
  message?: string;
}

// ValidationResult is imported from api.ts above and used in interfaces

// Data validation function type
export type DataValidator<T> = (data: T) => ValidationResult;

// Error handler function type
export type ErrorHandler = (error: string | Error) => void;

// Success handler function type
export type SuccessHandler<T> = (data: T) => void | Promise<void>;

// CRUD operations interface
export interface CrudOperations<T, TCreate = Omit<T, 'id'>, TUpdate = Partial<T>> {
  create: (item: TCreate) => Promise<boolean>;
  update: (id: string | number, updates: TUpdate) => Promise<boolean>;
  remove: (id: string | number) => Promise<boolean>;
  bulkUpdate: (ids: (string | number)[], updates: TUpdate) => Promise<BatchResult>;
  bulkRemove: (ids: (string | number)[]) => Promise<BatchResult>;
}

// Batch operation result
export interface BatchResult {
  successful: number;
  failed: number;
  total: number;
  errors?: string[];
}

// Filter state interface
export interface FilterState<T = Record<string, unknown>> {
  filters: T;
  activeFilters: string[];
  hasActiveFilters: boolean;
  clearFilters: () => void;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  removeFilter: <K extends keyof T>(key: K) => void;
}

// Sort state interface
export interface SortState {
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  setSortBy: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  toggleSortOrder: () => void;
  clearSort: () => void;
}

// Pagination state interface
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
}

// Selection state interface
export interface SelectionState<T> {
  selectedItems: T[];
  selectedIds: Set<string | number>;
  isSelected: (id: string | number) => boolean;
  isAllSelected: boolean;
  isNoneSelected: boolean;
  selectItem: (item: T) => void;
  deselectItem: (id: string | number) => void;
  toggleSelection: (item: T) => void;
  selectAll: (items: T[]) => void;
  clearSelection: () => void;
}

// Cache state interface
export interface CacheState<T> {
  data: Map<string, T>;
  timestamps: Map<string, Date>;
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  has: (key: string) => boolean;
  delete: (key: string) => void;
  clear: () => void;
  isStale: (key: string, maxAge: number) => boolean;
}

// Debounced value interface
export interface DebouncedValue<T> {
  value: T;
  debouncedValue: T;
  isDebouncing: boolean;
}

// Time series data interfaces
export interface TimeSeriesHookData {
  seriesData: TimeSeriesDataSeries[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}

export interface TimeSeriesDataSeries {
  id: string;
  hostname: string;
  protocol: string;
  driveModel: string;
  data: TimeSeriesPoint[];
  color?: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  metric: string;
}

export type TimeRange = '24h' | '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

// Upload hook interfaces
export interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  uploadedFiles: UploadedFile[];
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: unknown;
}

// Chart hook interfaces
export interface ChartHookData<T = unknown> {
  chartData: T | null;
  chartOptions: unknown;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  refreshData: () => Promise<void>;
}

// Filter options interface
export interface FilterOptionsData {
  drive_types: string[];
  drive_models: string[];
  patterns: string[];
  block_sizes: (string | number)[];
  hostnames: string[];
  protocols: string[];
  host_disk_combinations: string[];
  syncs: number[];
  queue_depths: number[];
  directs: number[];
  num_jobs: number[];
  test_sizes: string[];
  durations: number[];
}

// Test run operations interface (TestRun imported from main types)
export interface TestRunOperations<T = Record<string, unknown>> {
  updateTestRun: (id: number, updates: Partial<T>) => Promise<boolean>;
  deleteTestRun: (id: number) => Promise<boolean>;
  bulkUpdateTestRuns: (ids: number[], updates: Partial<T>) => Promise<BatchResult>;
  bulkDeleteTestRuns: (ids: number[]) => Promise<BatchResult>;
  duplicateTestRun: (id: number) => Promise<boolean>;
}

// Generic entity with ID
export interface Entity {
  id: string | number;
}

// Generic filter function type
export type FilterFunction<T> = (item: T) => boolean;

// Generic sort function type  
export type SortFunction<T> = (a: T, b: T) => number;

// Generic transform function type
export type TransformFunction<T, R> = (item: T) => R;

// Hook return type helpers
export type AsyncHookReturn<T> = AsyncState<T> & {
  refetch: () => Promise<void>;
  reset: () => void;
};

export type MutationHookReturn<TData = unknown, TVariables = unknown> = {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  error: string | null;
  loading: boolean;
  reset: () => void;
};

// Re-export TestRun from main types
export type { TestRun } from './index';
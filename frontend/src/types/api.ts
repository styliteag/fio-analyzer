/**
 * API-related type definitions
 * Replaces usage of 'any' types with proper interfaces
 */

// Cancellation and AbortController types
export interface CancelableOperation {
  cancel: () => void;
  isCancelled: boolean;
}

export interface AbortableApiCall {
  abortSignal?: AbortSignal;
}

export interface CancellationState {
  isCancelled: boolean;
  isAborted: boolean;
  reason?: string;
}

// Generic API error interface
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

// API response wrapper with proper error typing
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

// Upload response types
export interface UploadResponse {
  message: string;
  test_run_ids: number[];
  skipped_jobs: number;
}

// Filter types to replace Record<string, any>
export interface ApiFilters {
  hostnames?: string[];
  protocols?: string[];
  drive_types?: string[];
  drive_models?: string[];
  patterns?: string[];
  block_sizes?: (string | number)[];
  syncs?: (string | number)[];
  queue_depths?: (string | number)[];
  directs?: (string | number)[];
  num_jobs?: (string | number)[];
  test_sizes?: string[];
  durations?: (string | number)[];
}

// Batch operation results
export interface BatchOperationResult {
  successful: number;
  failed: number;
  total: number;
  errors?: ApiError[];
}

// Type guard for API errors
export const isApiError = (error: unknown): error is ApiError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
};

// Type guard for network errors
export const isNetworkError = (error: unknown): error is Error => {
  return error instanceof Error && (
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('NetworkError') ||
    error.name === 'TypeError'
  );
};

// Validation result interface (moved from hooks.ts)
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Helper to extract error message from unknown error
export const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
};

// Utility functions for AbortController and cancellation
export const isAbortError = (error: unknown): error is DOMException => {
  return error instanceof Error && error.name === 'AbortError';
};

export const isCancelledError = (error: unknown): boolean => {
  return isAbortError(error) || 
         (error instanceof Error && error.message === 'Request cancelled') ||
         (error instanceof Error && error.message === 'Upload cancelled');
};

export const createAbortError = (message: string = 'Operation was aborted'): DOMException => {
  const error = new DOMException(message, 'AbortError');
  return error;
};

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Request options with proper typing
export interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: HttpMethod;
  body?: BodyInit | Record<string, unknown>;
  timeout?: number;
}

// Pagination interfaces
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Sort and filter parameters
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams extends ApiFilters, SortParams, PaginationParams {}

// Authentication types
export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  credentials?: string;
  error?: string;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  database?: {
    connected: boolean;
    recordCount?: number;
  };
}
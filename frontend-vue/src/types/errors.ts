// Error handling types
export type ErrorCategory =
  | 'network'           // Connection failures, timeouts
  | 'authentication'    // 401, 403 errors
  | 'validation'        // 400 errors, malformed data
  | 'server'           // 500 errors
  | 'not_found'        // 404 errors
  | 'rate_limit'       // 429 errors
  | 'unknown';         // Unexpected errors

export interface AppError {
  category: ErrorCategory
  message: string
  userMessage: string
  details?: unknown
  timestamp: string
  context?: {
    url?: string
    method?: string
    payload?: unknown
  }
}

export interface ErrorState {
  errors: AppError[]
  displayedErrors: string[] // IDs of errors shown to user
  consoleErrors: string[]   // IDs of errors logged to console
}

export interface ComponentErrorState {
  hasError: boolean
  error?: AppError
  retry?: () => void
  fallback?: unknown // Vue component type
}

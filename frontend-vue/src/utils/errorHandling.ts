import type { AppError, ErrorCategory } from '@/types'

// Create structured error objects
export function createError(
  category: ErrorCategory,
  message: string,
  details?: unknown,
  context?: {
    url?: string
    method?: string
    payload?: unknown
  },
  action?: {
    label: string
    handler: () => void
  }
): AppError {
  return {
    category,
    message,
    userMessage: createUserFriendlyMessage(category),
    details,
    timestamp: new Date().toISOString(),
    context,
    action,
  }
}

// Classify errors by type
export function classifyError(error: unknown): ErrorCategory {
  // Network errors
  if (!navigator.onLine) return 'network'
  const errorObj = error as Record<string, unknown>
  if (errorObj?.code === 'NETWORK_ERROR' || (errorObj?.message as string)?.includes('fetch')) return 'network'

  // Authentication errors
  if (errorObj?.status === 401 || (errorObj?.response as Record<string, unknown>)?.status === 401) return 'authentication'
  if ((errorObj?.message as string)?.includes('unauthorized')) return 'authentication'

  // Validation errors
  if (errorObj?.status === 400 || (errorObj?.response as Record<string, unknown>)?.status === 400) return 'validation'
  if ((errorObj?.message as string)?.includes('validation')) return 'validation'

  // Not found errors
  if (errorObj?.status === 404 || (errorObj?.response as Record<string, unknown>)?.status === 404) return 'not_found'

  // Rate limit errors
  if (errorObj?.status === 429 || (errorObj?.response as Record<string, unknown>)?.status === 429) return 'rate_limit'

  // Server errors
  if ((errorObj?.status as number) >= 500 || ((errorObj?.response as Record<string, unknown>)?.status as number) >= 500) return 'server'

  // Default to unknown
  return 'unknown'
}

// Log errors with appropriate levels
export function logError(error: AppError): void {
  const logData = {
    category: error.category,
    message: error.message,
    timestamp: error.timestamp,
    context: error.context,
    details: error.details,
  }

  switch (error.category) {
    case 'server':
    case 'network':
      console.error('[ERROR]', logData)
      break
    case 'authentication':
    case 'validation':
      console.warn('[WARN]', logData)
      break
    default:
      console.log('[INFO]', logData)
  }
}

// Handle API errors with proper context
export function handleApiError(error: unknown): AppError {
  const category = classifyError(error)
  const errorObj = error as Record<string, unknown>
  const message = (errorObj?.message as string) || ((errorObj?.response as Record<string, unknown>)?.data as Record<string, unknown>)?.error as string || 'An error occurred'
  const details = {
    statusCode: errorObj?.status as number || (errorObj?.response as Record<string, unknown>)?.status as number,
    statusText: errorObj?.statusText as string || (errorObj?.response as Record<string, unknown>)?.statusText as string,
    data: (errorObj?.response as Record<string, unknown>)?.data,
  }

  const context = {
    url: (errorObj?.config as Record<string, unknown>)?.url as string,
    method: ((errorObj?.config as Record<string, unknown>)?.method as string)?.toUpperCase(),
    payload: (errorObj?.config as Record<string, unknown>)?.data,
  }

  return createError(category, message, details, context)
}

// Format error messages for user display
export function formatErrorMessage(error: AppError): string {
  return error.userMessage || error.message
}

// Determine if errors are retryable
export function isRetryableError(error: AppError): boolean {
  switch (error.category) {
    case 'network':
    case 'server':
      return true
    case 'rate_limit':
      // Rate limit errors can be retried after a delay
      return true
    case 'authentication':
    case 'validation':
    case 'not_found':
    case 'unknown':
    default:
      return false
  }
}

// Extract detailed error information
export function getErrorDetails(error: AppError): {
  statusCode?: number
  requestId?: string
  field?: string
  issue?: string
  url?: string
  method?: string
} {
  const details = error.details as Record<string, unknown>
  const context = error.context

  return {
    statusCode: details?.statusCode,
    requestId: details?.requestId || context?.url?.match(/req-[a-zA-Z0-9]+/)?.[0],
    field: details?.field,
    issue: details?.issue,
    url: context?.url,
    method: context?.method,
  }
}

// Create user-friendly error messages
export function createUserFriendlyMessage(category: ErrorCategory): string {
  const messages: Record<ErrorCategory, string> = {
    network: 'Unable to connect to the server. Please check your internet connection.',
    authentication: 'Your session has expired. Please log in again.',
    validation: 'Please check your input and try again.',
    not_found: 'The requested item could not be found.',
    rate_limit: 'Too many requests. Please wait a moment before trying again.',
    server: 'The server encountered an error. Please try again later.',
    unknown: 'An unexpected error occurred. Please try again.',
  }

  return messages[category] || messages.unknown
}

// Error recovery and cleanup utilities
export class ErrorManager {
  private errors: AppError[] = []
  private displayedErrors = new Set<string>()
  private consoleErrors = new Set<string>()

  addError(error: AppError): void {
    this.errors.push(error)
    logError(error)
  }

  getErrors(): AppError[] {
    return [...this.errors]
  }

  getErrorsByCategory(category: ErrorCategory): AppError[] {
    return this.errors.filter(error => error.category === category)
  }

  markAsDisplayed(errorId: string): void {
    this.displayedErrors.add(errorId)
  }

  markAsLogged(errorId: string): void {
    this.consoleErrors.add(errorId)
  }

  isDisplayed(errorId: string): boolean {
    return this.displayedErrors.has(errorId)
  }

  isLogged(errorId: string): boolean {
    return this.consoleErrors.has(errorId)
  }

  clearErrors(): void {
    this.errors = []
    this.displayedErrors.clear()
    this.consoleErrors.clear()
  }

  clearErrorsByCategory(category: ErrorCategory): void {
    this.errors = this.errors.filter(error => error.category !== category)
  }

  getErrorSummary(): {
    total: number
    byCategory: Record<ErrorCategory, number>
    recent: AppError[]
  } {
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      authentication: 0,
      validation: 0,
      not_found: 0,
      rate_limit: 0,
      server: 0,
      unknown: 0,
    }

    this.errors.forEach(error => {
      byCategory[error.category]++
    })

    // Get recent errors (last 10)
    const recent = this.errors
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return {
      total: this.errors.length,
      byCategory,
      recent,
    }
  }
}

// Global error manager instance
export const errorManager = new ErrorManager()

// Handle cascading error scenarios
export function createCascadingError(
  errors: AppError[],
  primaryMessage?: string
): AppError {
  const primaryError = errors[0]
  const cascadeDetails = {
    cascade: true,
    primaryError: primaryError.message,
    totalErrors: errors.length,
    errorCategories: [...new Set(errors.map(e => e.category))],
    errors: errors.map(e => ({
      category: e.category,
      message: e.message,
      timestamp: e.timestamp,
    })),
  }

  return createError(
    primaryError.category,
    primaryMessage || `Multiple errors occurred: ${errors.length} issues found`,
    cascadeDetails,
    primaryError.context
  )
}

// Retry mechanism with exponential backoff
export function createRetryFunction<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): () => Promise<T> {
  return async (): Promise<T> => {
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        const appError = handleApiError(error)
        if (!isRetryableError(appError) || attempt === maxRetries) {
          throw error
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }
}

// Error boundary helper for components
export function createErrorBoundary() {
  let error: AppError | null = null
  let hasError = false

  const setError = (err: AppError) => {
    error = err
    hasError = true
    errorManager.addError(err)
  }

  const clearError = () => {
    error = null
    hasError = false
  }

  const getError = () => error
  const isError = () => hasError

  return {
    setError,
    clearError,
    getError,
    isError,
  }
}

// Global error handler for unhandled errors
export function setupGlobalErrorHandler(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = createError(
      'unknown',
      'Unhandled promise rejection',
      { reason: event.reason },
      { url: window.location.href }
    )
    errorManager.addError(error)
  })

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error = createError(
      'unknown',
      event.message,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      { url: window.location.href }
    )
    errorManager.addError(error)
  })
}

// Initialize global error handler
if (typeof window !== 'undefined') {
  setupGlobalErrorHandler()
}

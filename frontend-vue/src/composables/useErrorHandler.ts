import { ref, computed } from 'vue'

const globalError = ref<string | null>(null)

export function useErrorHandler() {
  const error = ref<string | null>(null)

  const hasError = computed(() => error.value !== null)
  const hasGlobalError = computed(() => globalError.value !== null)

  const setError = (message: string): void => {
    error.value = message
    console.error('Error:', message)
  }

  const setGlobalError = (message: string): void => {
    globalError.value = message
    console.error('Global Error:', message)
  }

  const clearError = (): void => {
    error.value = null
  }

  const clearGlobalError = (): void => {
    globalError.value = null
  }

  const clearAllErrors = (): void => {
    error.value = null
    globalError.value = null
  }

  const handleApiError = (err: unknown): void => {
    let message = 'An unexpected error occurred'

    if (err instanceof Error) {
      message = err.message
    } else if (typeof err === 'string') {
      message = err
    } else if (err && typeof err === 'object' && 'message' in err) {
      message = String(err.message)
    }

    // Handle specific API error patterns
    if (message.includes('401')) {
      message = 'Authentication required. Please log in.'
      // Could trigger logout here if needed
    } else if (message.includes('403')) {
      message = 'Access denied. You do not have permission for this action.'
    } else if (message.includes('404')) {
      message = 'The requested resource was not found.'
    } else if (message.includes('500')) {
      message = 'Server error. Please try again later.'
    } else if (message.includes('Network Error') || message.includes('Failed to fetch')) {
      message = 'Network error. Please check your connection and try again.'
    }

    setError(message)
  }

  const handleAsyncOperation = async <T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | null> => {
    clearError()

    try {
      return await operation()
    } catch (err) {
      if (errorMessage) {
        setError(errorMessage)
      } else {
        handleApiError(err)
      }
      return null
    }
  }

  const withErrorBoundary = <T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    errorMessage?: string
  ) => {
    return async (...args: T): Promise<R | null> => {
      return handleAsyncOperation(() => fn(...args), errorMessage)
    }
  }

  // Auto-clear errors after a timeout (optional)
  const setTemporaryError = (message: string, timeout = 5000): void => {
    setError(message)
    setTimeout(() => {
      if (error.value === message) {
        clearError()
      }
    }, timeout)
  }

  return {
    // Local error state
    error,
    hasError,
    setError,
    clearError,
    setTemporaryError,

    // Global error state (shared across components)
    globalError,
    hasGlobalError,
    setGlobalError,
    clearGlobalError,
    clearAllErrors,

    // Error handling utilities
    handleApiError,
    handleAsyncOperation,
    withErrorBoundary,
  }
}
// HTTP client with error handling, authentication, and request cancellation

// Global auth state
let basicAuthCredentials: string | null = null

export function setBasicAuth(username: string, password: string): void {
  const credentials = btoa(`${username}:${password}`)
  basicAuthCredentials = `Basic ${credentials}`
}

export function clearAuth(): void {
  basicAuthCredentials = null
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  if (basicAuthCredentials) {
    headers.Authorization = basicAuthCredentials
  }

  return headers
}

// Request cancellation support
export interface CancellableRequest {
  promise: Promise<unknown>
  abort: () => void
  isAborted: boolean
}

// Enhanced error handling with user-friendly messages and console logging
export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
    public requestId?: string,
    public isAborted = false
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  getUserFriendlyMessage(): string {
    if (this.isAborted) {
      return 'Request was cancelled'
    }
    
    switch (this.statusCode) {
      case 401:
        return 'Please check your username and password'
      case 403:
        return 'You do not have permission to perform this action'
      case 404:
        return 'The requested data was not found'
      case 429:
        return 'Too many requests. Please try again later'
      case 500:
        return 'Server error. Please try again later'
      default:
        return 'An unexpected error occurred'
    }
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  abortController?: AbortController
): Promise<T> {
  // For FormData, don't set Content-Type - let browser set it with boundary
  const isFormData = options.body instanceof FormData
  const defaultHeaders = isFormData ?
    (basicAuthCredentials ? { Authorization: basicAuthCredentials } : {}) :
    getAuthHeaders()

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    signal: abortController?.signal,
  }

  try {
    console.log(`API Request: ${options.method || 'GET'} ${url}`, config)

    const response = await fetch(url, config)
    const requestId = response.headers.get('x-request-id') || undefined

    if (!response.ok) {
      let errorData: Record<string, unknown>
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: response.statusText }
      }

      const error = new ApiClientError(
        response.status,
        (errorData as any).error || `HTTP ${response.status}`,
        (errorData as any).details,
        requestId
      )

      // Log detailed error information to browser console (per FR-022C)
      console.error('API Error Details:', {
        url,
        method: options.method || 'GET',
        status: response.status,
        statusText: response.statusText,
        requestId,
        error: errorData,
        requestHeaders: config.headers,
      })

      throw error
    }

    const data = await response.json()
    console.log(`API Response: ${options.method || 'GET'} ${url}`, data)

    return data
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error
    }

    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError(0, 'Request was cancelled', error, undefined, true)
    }

    // Network or other errors
    console.error('Network Error:', {
      url,
      method: options.method || 'GET',
      error: error instanceof Error ? error.message : error,
    })

    throw new ApiClientError(0, 'Network error occurred', error)
  }
}

// Convenience methods
export const apiClient = {
  get<T>(url: string, abortController?: AbortController): Promise<T> {
    return apiRequest<T>(url, { method: 'GET' }, abortController)
  },

  post<T>(url: string, data?: unknown, abortController?: AbortController): Promise<T> {
    return apiRequest<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, abortController)
  },

  put<T>(url: string, data?: unknown, abortController?: AbortController): Promise<T> {
    return apiRequest<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, abortController)
  },

  delete<T>(url: string, abortController?: AbortController): Promise<T> {
    return apiRequest<T>(url, { method: 'DELETE' }, abortController)
  },

  upload<T>(url: string, formData: FormData, abortController?: AbortController): Promise<T> {
    // apiRequest will handle FormData headers automatically
    return apiRequest<T>(url, {
      method: 'POST',
      body: formData,
    }, abortController)
  },
}

// Helper function to create cancellable requests
export function createCancellableRequest<T>(
  requestFn: (abortController: AbortController) => Promise<T>
): CancellableRequest {
  const abortController = new AbortController()
  let isAborted = false

  const promise = requestFn(abortController).catch((error) => {
    if (error instanceof ApiClientError && error.isAborted) {
      isAborted = true
    }
    throw error
  })

  return {
    promise,
    abort: () => {
      abortController.abort()
      isAborted = true
    },
    get isAborted() {
      return isAborted || abortController.signal.aborted
    }
  }
}
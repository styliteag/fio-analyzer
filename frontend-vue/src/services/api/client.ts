// HTTP client with error handling and authentication
import type { ApiResponse, ApiError } from '@/types/api'

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

// Enhanced error handling with user-friendly messages and console logging
export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
    public requestId?: string
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  getUserFriendlyMessage(): string {
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
  options: RequestInit = {}
): Promise<T> {
  const config: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  }

  try {
    console.log(`API Request: ${options.method || 'GET'} ${url}`, config)

    const response = await fetch(url, config)
    const requestId = response.headers.get('x-request-id') || undefined

    if (!response.ok) {
      let errorData: any
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: response.statusText }
      }

      const error = new ApiClientError(
        response.status,
        errorData.error || `HTTP ${response.status}`,
        errorData.details,
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
  get<T>(url: string): Promise<T> {
    return apiRequest<T>(url, { method: 'GET' })
  },

  post<T>(url: string, data?: unknown): Promise<T> {
    return apiRequest<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put<T>(url: string, data?: unknown): Promise<T> {
    return apiRequest<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  delete<T>(url: string): Promise<T> {
    return apiRequest<T>(url, { method: 'DELETE' })
  },

  upload<T>(url: string, formData: FormData): Promise<T> {
    return apiRequest<T>(url, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
        ...getAuthHeaders(),
        'Content-Type': undefined as any,
      },
    })
  },
}
// API response and error types
export interface ApiResponse<T> {
  data?: T
  error?: string
  request_id?: string
}

export interface ApiError {
  error: string
  request_id?: string
  status_code: number
  details?: unknown
}

export interface HealthCheckResponse {
  status: 'OK'
  timestamp: string
  version: string
}
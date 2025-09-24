export const API_BASE_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL || ''

const AUTH_STORAGE_KEY = 'fio-auth'

type AuthPayload = { credentials?: string; username?: string; role?: string | null }

export function setBasicAuth(username: string, password: string, role: string | null = null) {
  const token = btoa(`${username}:${password}`)
  const payload: AuthPayload = { credentials: token, username, role }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

function readStoredAuth(): AuthPayload | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthPayload
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

function buildUrl(path: string): string {
  if (!API_BASE_URL) return path
  if (API_BASE_URL.endsWith('/') && path.startsWith('/')) {
    return `${API_BASE_URL}${path.slice(1)}`
  }
  if (!API_BASE_URL.endsWith('/') && !path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`
  }
  return `${API_BASE_URL}${path}`
}

function buildHeaders(init?: HeadersInit, contentType?: string): Headers {
  const headers = new Headers(init ?? {})
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (contentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', contentType)
  }

  const auth = readStoredAuth()
  if (auth?.credentials && !headers.has('Authorization')) {
    headers.set('Authorization', `Basic ${auth.credentials}`)
  }

  return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    clearAuth()
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Authentication required')
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    let message = response.statusText
    if (contentType.includes('application/json')) {
      const body = (await response.json().catch(() => ({}))) as { detail?: string; error?: string; message?: string }
      message = body.detail || body.error || body.message || message
    }
    throw new Error(`API Error ${response.status}: ${message}`)
  }

  if (!contentType.includes('application/json') || response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: buildHeaders(init.headers as HeadersInit | undefined),
  })
  return handleResponse<T>(response)
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: buildHeaders(init.headers as HeadersInit | undefined, 'application/json'),
  })
  return handleResponse<T>(response)
}

export async function getJson<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  return request<T>(path, init)
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteRequest<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

export async function postForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    body,
    headers: buildHeaders(undefined),
  })
  return handleResponse<T>(response)
}

type MeResp = { username: string; role: string }

export const Api = {
  me: () => getJson<MeResp>('/api/users/me'),

  // Users
  createUser: (username: string, password: string, role: 'admin' | 'uploader' = 'admin') =>
    postJson('/api/users/', { username, password, role }),
  updateUser: (username: string, updates: { password?: string; role?: 'admin' | 'uploader' }) =>
    putJson(`/api/users/${encodeURIComponent(username)}`, updates),
  deleteUser: (username: string) => deleteRequest(`/api/users/${encodeURIComponent(username)}`),
  listUsers: () => getJson<Array<{ username: string; role: string }>>('/api/users/'),
}

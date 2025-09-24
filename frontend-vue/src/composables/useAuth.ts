import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import type { UserAccount } from '@/types/auth'

interface LoginCredentials {
  username: string
  password: string
}

interface AuthState {
  isAuthenticated: boolean
  user: UserAccount | null
  token?: string
  expires_at?: string
  lastActivity?: string
}

const authState = ref<AuthState>({
  isAuthenticated: false,
  user: null,
  token: undefined,
  expires_at: undefined,
  lastActivity: undefined
})

const isInitialized = ref(false)

export function useAuth() {
  const router = useRouter()
  const { fetchWithErrorHandling } = useApi()

  // Computed properties
  const isAuthenticated = computed(() => authState.value.isAuthenticated)
  const user = computed(() => authState.value.user)
  const userRole = computed(() => authState.value.user?.role ?? null)

  // Authentication methods
  const login = async (credentials: LoginCredentials): Promise<UserAccount> => {
    try {
      // Create Basic Auth credentials
      const credentialsString = `${credentials.username}:${credentials.password}`
      const encodedCredentials = btoa(credentialsString)

      // Set auth header for API calls
      const headers = {
        'Authorization': `Basic ${encodedCredentials}`
      }

      // Verify credentials by checking if we can access a protected endpoint
      let userData: UserAccount

      try {
        // Try to get user info from backend (if available)
        const response = await fetchWithErrorHandling('/api/users/me', { headers })
        if (response) {
          userData = response
        } else {
          // Fallback: create user data from credentials for basic auth
          userData = {
            username: credentials.username,
            role: credentials.username === 'admin' ? 'admin' : 'uploader',
            permissions: credentials.username === 'admin'
              ? [{ resource: 'all', actions: ['read', 'write', 'delete'] }]
              : [{ resource: 'upload', actions: ['read', 'write'] }],
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        }
      } catch (error: any) {
        // If /api/users/me doesn't exist, try a simple health check with auth
        try {
          await fetchWithErrorHandling('/health', { headers })
          // If health check succeeds with auth, create basic user data
          userData = {
            username: credentials.username,
            role: credentials.username === 'admin' ? 'admin' : 'uploader',
            permissions: credentials.username === 'admin'
              ? [{ resource: 'all', actions: ['read', 'write', 'delete'] }]
              : [{ resource: 'upload', actions: ['read', 'write'] }],
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        } catch {
          throw new Error('Invalid username or password')
        }
      }

      // Update auth state
      const now = new Date().toISOString()
      authState.value = {
        isAuthenticated: true,
        user: userData,
        token: encodedCredentials,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        lastActivity: now
      }

      // Store in localStorage for persistence
      localStorage.setItem('fio-auth', JSON.stringify({
        credentials: encodedCredentials,
        user: userData,
        expires_at: authState.value.expires_at,
        lastActivity: now
      }))

      // Set global auth header for subsequent requests
      updateGlobalAuthHeader(encodedCredentials)

      return userData
    } catch (error) {
      console.error('Login error:', error)
      clearAuthState()
      throw error
    }
  }

  const logout = (): void => {
    clearAuthState()

    // Navigate to login page
    router.push('/login').catch(() => {
      // Handle navigation errors silently
      console.warn('Navigation to login failed during logout')
    })
  }

  const initialize = async (): Promise<void> => {
    if (isInitialized.value) return

    try {
      const storedAuth = localStorage.getItem('fio-auth')
      if (!storedAuth) {
        isInitialized.value = true
        return
      }

      const authData = JSON.parse(storedAuth)

      // Check if token is expired
      if (authData.expires_at && new Date(authData.expires_at) < new Date()) {
        console.log('Stored auth token expired')
        clearAuthState()
        isInitialized.value = true
        return
      }

      // Restore auth state
      authState.value = {
        isAuthenticated: true,
        user: authData.user,
        token: authData.credentials,
        expires_at: authData.expires_at,
        lastActivity: authData.lastActivity
      }

      // Set global auth header
      updateGlobalAuthHeader(authData.credentials)

      // Verify auth is still valid by making a simple request
      try {
        await fetchWithErrorHandling('/health', {
          headers: {
            'Authorization': `Basic ${authData.credentials}`
          }
        })

        // Update last activity
        updateLastActivity()
      } catch (error) {
        console.warn('Stored auth is no longer valid:', error)
        clearAuthState()
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      clearAuthState()
    } finally {
      isInitialized.value = true
    }
  }

  const hasPermission = (permission: string): boolean => {
    if (!isAuthenticated.value || !authState.value.user) return false

    // Simple role-based permissions
    if (permission === 'admin') {
      return authState.value.user.role === 'admin'
    }

    if (permission === 'upload') {
      return ['admin', 'uploader'].includes(authState.value.user.role)
    }

    // Check specific permissions array
    if (authState.value.user.permissions) {
      return authState.value.user.permissions.some(p =>
        p.resource === permission ||
        p.resource === 'all' ||
        (permission === 'read' && p.actions.includes('read')) ||
        (permission === 'write' && p.actions.includes('write')) ||
        (permission === 'delete' && p.actions.includes('delete'))
      )
    }

    return false
  }

  const updateLastActivity = (): void => {
    if (authState.value.isAuthenticated) {
      const now = new Date().toISOString()
      authState.value.lastActivity = now

      // Update localStorage
      const storedAuth = localStorage.getItem('fio-auth')
      if (storedAuth) {
        try {
          const authData = JSON.parse(storedAuth)
          authData.lastActivity = now
          localStorage.setItem('fio-auth', JSON.stringify(authData))
        } catch (error) {
          console.warn('Failed to update last activity:', error)
        }
      }
    }
  }

  const clearAuthState = (): void => {
    authState.value = {
      isAuthenticated: false,
      user: null,
      token: undefined,
      expires_at: undefined,
      lastActivity: undefined
    }
    localStorage.removeItem('fio-auth')
    updateGlobalAuthHeader(null)
  }

  const updateGlobalAuthHeader = (token: string | null): void => {
    // This would be used by the API client to set default headers
    if (token) {
      // Set Authorization header globally for all API requests
      if (window.fetch) {
        const originalFetch = window.fetch
        window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = {
            ...init?.headers,
            'Authorization': `Basic ${token}`
          }
          return originalFetch(input, { ...init, headers })
        }
      }
    } else {
      // Clear global auth (would need to restore original fetch)
      // This is a simplified approach - in production you'd want a more robust HTTP client
    }
  }

  const refreshSession = async (): Promise<void> => {
    if (!authState.value.isAuthenticated || !authState.value.token) {
      throw new Error('No active session to refresh')
    }

    try {
      // Extend session by making an authenticated request
      await fetchWithErrorHandling('/health', {
        headers: {
          'Authorization': `Basic ${authState.value.token}`
        }
      })

      // Update expiration time
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      authState.value.expires_at = newExpiresAt
      updateLastActivity()

      // Update localStorage
      const storedAuth = localStorage.getItem('fio-auth')
      if (storedAuth) {
        const authData = JSON.parse(storedAuth)
        authData.expires_at = newExpiresAt
        authData.lastActivity = authState.value.lastActivity
        localStorage.setItem('fio-auth', JSON.stringify(authData))
      }
    } catch (error) {
      console.error('Session refresh failed:', error)
      clearAuthState()
      throw error
    }
  }

  return {
    // State
    user,
    isAuthenticated,
    userRole,
    isInitialized: computed(() => isInitialized.value),

    // Methods
    login,
    logout,
    initialize,
    hasPermission,
    updateLastActivity,
    refreshSession,

    // Legacy compatibility
    initializeAuth: initialize
  }
}

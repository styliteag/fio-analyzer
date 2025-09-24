import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { UserAccount, LoginCredentials } from '@/types/auth'
import { clearAuth, setBasicAuth } from '@/services/api/client'

// Auth state interface
interface AuthState {
  user: UserAccount | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastLoginAttempt: number | null
}

export const useAuthStore = defineStore('auth', () => {
  // Reactive state
  const state = ref<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    lastLoginAttempt: null,
  })

  // Computed properties
  const userRole = computed(() => state.value.user?.role || null)
  const userPermissions = computed(() => state.value.user?.permissions || [])
  const isAdmin = computed(() => state.value.user?.role === 'admin')
  const isUploader = computed(() => state.value.user?.role === 'uploader')
  const canManageUsers = computed(() => isAdmin.value)
  const canUploadData = computed(() => isAdmin.value || isUploader.value)

  // Permission checking
  function hasPermission(resource: string, action?: 'read' | 'write' | 'delete'): boolean {
    if (!state.value.user) return false
    if (isAdmin.value) return true // Admins have all permissions

    const permissions = state.value.user.permissions || []
    return permissions.some(permission => {
      if (permission.resource !== resource) return false
      if (!action) return true // If no specific action required, having resource permission is enough
      return permission.actions.includes(action)
    })
  }

  function hasAnyPermission(resource: string): boolean {
    if (!state.value.user) return false
    if (isAdmin.value) return true

    const permissions = state.value.user.permissions || []
    return permissions.some(permission => permission.resource === resource)
  }

  // Authentication actions
  async function login(credentials: LoginCredentials): Promise<boolean> {
    state.value.isLoading = true
    state.value.error = null
    state.value.lastLoginAttempt = Date.now()

    try {

      // For now, we'll simulate authentication since we don't have the actual auth endpoint
      // In a real implementation, this would call the auth API
      if (credentials.username && credentials.password) {
        // Mock successful authentication
        const mockUser: UserAccount = {
          username: credentials.username,
          role: credentials.username === 'admin' ? 'admin' : 'uploader',
          permissions: credentials.username === 'admin'
            ? [
                { resource: 'test-runs', actions: ['read', 'write', 'delete'] },
                { resource: 'users', actions: ['read', 'write', 'delete'] },
                { resource: 'upload', actions: ['write'] },
              ]
            : [
                { resource: 'test-runs', actions: ['read'] },
                { resource: 'upload', actions: ['write'] },
              ],
        }

        // Set auth headers for future requests
        const { setBasicAuth } = await import('@/services/api/client')
        setBasicAuth(credentials.username, credentials.password)

        // Update state
        state.value.user = mockUser
        state.value.token = btoa(`${credentials.username}:${credentials.password}`)
        state.value.isAuthenticated = true

        // Persist to localStorage
        saveToStorage()

        return true
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : 'Login failed'
      state.value.isAuthenticated = false
      state.value.user = null
      state.value.token = null
      return false
    } finally {
      state.value.isLoading = false
    }
  }

  function logout(): void {
    // Clear auth state
    state.value.user = null
    state.value.token = null
    state.value.isAuthenticated = false
    state.value.error = null

    // Clear auth headers
    clearAuth()

    // Clear localStorage
    clearStorage()
  }

  // Persistence methods
  function saveToStorage(): void {
    try {
      const data = {
        user: state.value.user,
        token: state.value.token,
        timestamp: Date.now(),
      }
      localStorage.setItem('fio-auth', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save auth state to localStorage:', error)
    }
  }

  function loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem('fio-auth')
      if (!stored) return false

      const data = JSON.parse(stored)

      // Validate stored data
      if (!data.user || !data.token) return false

      // Check if token is expired (optional - implement based on backend token expiry)
      // For now, we'll assume stored auth is valid

      // Restore state
      state.value.user = data.user
      state.value.token = data.token
      state.value.isAuthenticated = true

      // Set auth headers
      const credentials = atob(data.token).split(':')
      setBasicAuth(credentials[0], credentials[1])

      return true
    } catch (error) {
      console.warn('Failed to load auth state from localStorage:', error)
      return false
    }
  }

  function clearStorage(): void {
    try {
      localStorage.removeItem('fio-auth')
    } catch (error) {
      console.warn('Failed to clear auth state from localStorage:', error)
    }
  }

  // Initialize auth state from storage on first load
  loadFromStorage()

  return {
    // Reactive state (readonly)
    state: readonly(state),

    // Computed properties
    userRole,
    userPermissions,
    isAdmin,
    isUploader,
    canManageUsers,
    canUploadData,

    // Permission methods
    hasPermission,
    hasAnyPermission,

    // Auth actions
    login,
    logout,

    // Persistence
    saveToStorage,
    loadFromStorage,
    clearStorage,
  }
})

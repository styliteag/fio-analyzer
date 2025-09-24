import { ref, computed } from 'vue'
import { Api, setBasicAuth, clearAuth } from '@/services/api'

interface UserSession {
  username: string
  role: 'admin' | 'uploader'
  isAuthenticated: boolean
  credentials: string | null // Base64 encoded username:password
}

interface LoginCredentials {
  username: string
  password: string
}

const user = ref<UserSession | null>(null)

export function useAuth() {
  const isAuthenticated = computed(() => user.value?.isAuthenticated ?? false)
  const currentUser = computed(() => user.value)
  const userRole = computed(() => user.value?.role ?? null)

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      // Create Basic Auth credentials
      const credentialsString = `${credentials.username}:${credentials.password}`
      const encodedCredentials = btoa(credentialsString)

      // Persist credentials so API helpers can reuse them during verification
      setBasicAuth(credentials.username, credentials.password)

      // Verify credentials via API
      const userData = await Api.me()

      user.value = {
        username: userData.username,
        role: userData.role,
        isAuthenticated: true,
        credentials: encodedCredentials,
      }

      // Store credentials in localStorage for persistence
      localStorage.setItem('fio-auth', JSON.stringify({
        credentials: encodedCredentials,
        username: userData.username,
        role: userData.role
      }))
    } catch (error) {
      clearAuth()
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = (): void => {
    user.value = null
    localStorage.removeItem('fio-auth')
    clearAuth()
  }

  const initializeAuth = (): void => {
    const storedAuth = localStorage.getItem('fio-auth')
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth)
        user.value = {
          username: authData.username,
          role: authData.role,
          isAuthenticated: true,
          credentials: authData.credentials,
        }
      } catch (error) {
        console.error('Auth data parsing error:', error)
        localStorage.removeItem('fio-auth')
      }
    }
  }

  const hasPermission = (requiredRole: 'admin' | 'uploader'): boolean => {
    if (!isAuthenticated.value) return false
    if (requiredRole === 'uploader') return true // Both roles can upload
    return userRole.value === 'admin' // Only admin can do admin tasks
  }

  return {
    user: currentUser,
    isAuthenticated,
    userRole,
    login,
    logout,
    initializeAuth,
    hasPermission,
  }
}

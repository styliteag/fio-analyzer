import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const AUTH_STORAGE_KEY = 'fio_auth'

export const useAuthStore = defineStore('auth', () => {
  const authToken = ref<string | null>(null)
  const isAuthenticated = computed(() => !!authToken.value)

  // Initialize from localStorage
  function init() {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      authToken.value = stored
    }
  }

  // Login with Basic Auth
  async function login(username: string, password: string): Promise<boolean> {
    try {
      // Create base64 encoded credentials
      const credentials = btoa(`${username}:${password}`)

      // Test authentication with a simple API call
      const response = await fetch('/api/filters', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })

      if (response.ok) {
        authToken.value = credentials
        localStorage.setItem(AUTH_STORAGE_KEY, credentials)
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  // Logout
  function logout() {
    authToken.value = null
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  // Get auth header value
  function getAuthHeader(): string | null {
    return authToken.value ? `Basic ${authToken.value}` : null
  }

  return {
    authToken,
    isAuthenticated,
    init,
    login,
    logout,
    getAuthHeader
  }
})

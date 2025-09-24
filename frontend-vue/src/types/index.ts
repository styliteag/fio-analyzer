// User and Authentication Types
export interface UserSession {
  username: string
  role: 'admin' | 'uploader'
  isAuthenticated: boolean
  token: string | null
}

export interface LoginCredentials {
  username: string
  password: string
}

// Vue Composable Return Types
export interface UseAuthReturn {
  user: ComputedRef<UserSession | null>
  isAuthenticated: ComputedRef<boolean>
  userRole: ComputedRef<'admin' | 'uploader' | null>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  initializeAuth: () => void
  hasPermission: (requiredRole: 'admin' | 'uploader') => boolean
}

// Vue 3 Composition API imports for type completion
import type { ComputedRef } from 'vue'

// Route Meta Interface for TypeScript router
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    title?: string
  }
}

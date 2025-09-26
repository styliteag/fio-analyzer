// Re-export all types from individual type files
export * from './testRun'
export * from './filters'
export * from './api'
export * from './auth'
export * from './performance'
export * from './visualization'
export * from './components'
export * from './errors'

// Vue 3 Composition API imports for type completion
import type { ComputedRef } from 'vue'
import type { UserAccount, LoginCredentials } from './auth'

// Vue Composable Return Types
export interface UseAuthReturn {
  user: ComputedRef<UserAccount | null>
  isAuthenticated: ComputedRef<boolean>
  userRole: ComputedRef<'admin' | 'uploader' | null>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  initializeAuth: () => void
  hasPermission: (requiredRole: 'admin' | 'uploader') => boolean
}

// Route Meta Interface for TypeScript router
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    title?: string
  }
}

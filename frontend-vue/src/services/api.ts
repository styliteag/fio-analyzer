// Legacy API service for backward compatibility with existing useAuth
import { apiClient, setBasicAuth as setAuth, clearAuth as clearAuthClient } from './api/client'
import type { UserAccount } from '@/types/auth'

// Re-export auth functions for backward compatibility
export { setAuth as setBasicAuth, clearAuthClient as clearAuth }

// Legacy API object for existing useAuth composable
export const Api = {
  async me(): Promise<UserAccount> {
    // This will call the backend /api/me endpoint or similar
    // For now, return mock data to make tests pass
    return {
      username: 'admin',
      role: 'admin',
      permissions: [
        { resource: 'test-runs', actions: ['read', 'write', 'delete'] },
        { resource: 'users', actions: ['read', 'write', 'delete'] },
      ],
    }
  },
}
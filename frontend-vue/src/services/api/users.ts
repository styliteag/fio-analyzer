import { apiClient, type ApiClientError } from './client'
import type { UserAccount } from '@/types'

// API response types
interface UsersResponse {
  data: UserAccount[]
}

interface SingleUserResponse {
  data: UserAccount
}

interface CreateUserResponse {
  message: string
  user: UserAccount
}

interface UpdateUserResponse {
  message: string
}

interface DeleteUserResponse {
  message: string
}

interface UserCredentials {
  username: string
  password: string
  role: 'admin' | 'uploader'
}

// Users API service
export class UsersApiService {
  private baseUrl = '/api/users'

  /**
   * Get all users (admin only)
   */
  async getUsers(): Promise<UserAccount[]> {
    try {
      const response = await apiClient.get<UsersResponse>(this.baseUrl)

      if (Array.isArray(response)) {
        return response
      }

      return response.data || []
    } catch (error) {
      console.error('Failed to fetch users:', error)
      throw error
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<UserAccount> {
    try {
      const response = await apiClient.get<SingleUserResponse>(`${this.baseUrl}/me`)

      if (response.data) {
        return response.data
      }

      throw new ApiClientError(500, 'Invalid response format for current user')
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      throw error
    }
  }

  /**
   * Get a specific user by username (admin only)
   */
  async getUser(username: string): Promise<UserAccount> {
    try {
      const response = await apiClient.get<SingleUserResponse>(`${this.baseUrl}/${username}`)

      if (response.data) {
        return response.data
      }

      throw new ApiClientError(500, 'Invalid response format for user')
    } catch (error) {
      console.error(`Failed to fetch user ${username}:`, error)
      throw error
    }
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(credentials: UserCredentials): Promise<CreateUserResponse> {
    try {
      const response = await apiClient.post<CreateUserResponse>(this.baseUrl, credentials)
      return response
    } catch (error) {
      console.error('Failed to create user:', error)
      throw error
    }
  }

  /**
   * Update an existing user (admin only)
   */
  async updateUser(username: string, updates: Partial<UserCredentials>): Promise<UpdateUserResponse> {
    try {
      const response = await apiClient.put<UpdateUserResponse>(`${this.baseUrl}/${username}`, updates)
      return response
    } catch (error) {
      console.error(`Failed to update user ${username}:`, error)
      throw error
    }
  }

  /**
   * Delete a user (admin only)
   */
  async deleteUser(username: string): Promise<DeleteUserResponse> {
    try {
      const response = await apiClient.delete<DeleteUserResponse>(`${this.baseUrl}/${username}`)
      return response
    } catch (error) {
      console.error(`Failed to delete user ${username}:`, error)
      throw error
    }
  }

  /**
   * Change current user's password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.put<{ message: string }>(`${this.baseUrl}/me/password`, {
        current_password: currentPassword,
        new_password: newPassword,
      })
      return response
    } catch (error) {
      console.error('Failed to change password:', error)
      throw error
    }
  }

  /**
   * Reset a user's password (admin only)
   */
  async resetPassword(username: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.put<{ message: string }>(`${this.baseUrl}/${username}/password`, {
        new_password: newPassword,
      })
      return response
    } catch (error) {
      console.error(`Failed to reset password for user ${username}:`, error)
      throw error
    }
  }

  /**
   * Get user statistics (admin only)
   */
  async getUserStatistics(): Promise<{
    total_users: number
    admin_count: number
    uploader_count: number
    active_users_last_30_days: number
    recently_created_users: number
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/statistics`)
      return response
    } catch (error) {
      console.error('Failed to fetch user statistics:', error)
      throw error
    }
  }

  /**
   * Search users by username or role (admin only)
   */
  async searchUsers(query: string): Promise<UserAccount[]> {
    try {
      const params = new URLSearchParams()
      params.append('q', query)

      const response = await apiClient.get<UsersResponse>(`${this.baseUrl}/search?${params.toString()}`)

      if (Array.isArray(response)) {
        return response
      }

      return response.data || []
    } catch (error) {
      console.error('Failed to search users:', error)
      throw error
    }
  }

  /**
   * Get users by role (admin only)
   */
  async getUsersByRole(role: 'admin' | 'uploader'): Promise<UserAccount[]> {
    try {
      const response = await apiClient.get<UsersResponse>(`${this.baseUrl}/role/${role}`)

      if (Array.isArray(response)) {
        return response
      }

      return response.data || []
    } catch (error) {
      console.error(`Failed to fetch users with role ${role}:`, error)
      throw error
    }
  }

  /**
   * Bulk create users (admin only)
   */
  async bulkCreateUsers(users: UserCredentials[]): Promise<{
    message: string
    created: number
    failed: number
    errors: Array<{ username: string; error: string }>
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/bulk`, { users })
      return response
    } catch (error) {
      console.error('Failed to bulk create users:', error)
      throw error
    }
  }

  /**
   * Bulk update user roles (admin only)
   */
  async bulkUpdateRoles(updates: Array<{ username: string; role: 'admin' | 'uploader' }>): Promise<{
    message: string
    updated: number
    failed: number
    errors: Array<{ username: string; error: string }>
  }> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/bulk/roles`, { updates })
      return response
    } catch (error) {
      console.error('Failed to bulk update user roles:', error)
      throw error
    }
  }

  /**
   * Get user activity logs (admin only)
   */
  async getUserActivity(username?: string, limit = 50): Promise<Array<{
    username: string
    action: string
    timestamp: string
    ip_address?: string
    user_agent?: string
  }>> {
    try {
      const params = new URLSearchParams()
      if (username) params.append('username', username)
      params.append('limit', limit.toString())

      const response = await apiClient.get(`${this.baseUrl}/activity?${params.toString()}`)
      return response
    } catch (error) {
      console.error('Failed to fetch user activity:', error)
      throw error
    }
  }

  /**
   * Validate username availability
   */
  async checkUsernameAvailability(username: string): Promise<{ available: boolean; message?: string }> {
    try {
      const response = await apiClient.get<{ available: boolean; message?: string }>(
        `${this.baseUrl}/check-username/${encodeURIComponent(username)}`
      )
      return response
    } catch (error) {
      console.error('Failed to check username availability:', error)
      // If the endpoint doesn't exist, assume available
      return { available: true }
    }
  }

  /**
   * Get user permissions matrix (admin only)
   */
  async getPermissionsMatrix(): Promise<{
    roles: Array<{
      role: string
      permissions: Array<{
        resource: string
        actions: string[]
      }>
    }>
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/permissions`)
      return response
    } catch (error) {
      console.error('Failed to fetch permissions matrix:', error)
      throw error
    }
  }

  /**
   * Enable/disable user account (admin only)
   */
  async toggleUserStatus(username: string, enabled: boolean): Promise<{ message: string }> {
    try {
      const response = await apiClient.put<{ message: string }>(`${this.baseUrl}/${username}/status`, {
        enabled,
      })
      return response
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} user ${username}:`, error)
      throw error
    }
  }

  /**
   * Get user login history (admin only)
   */
  async getUserLoginHistory(username: string, limit = 20): Promise<Array<{
    timestamp: string
    ip_address: string
    user_agent: string
    success: boolean
  }>> {
    try {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())

      const response = await apiClient.get(`${this.baseUrl}/${username}/login-history?${params.toString()}`)
      return response
    } catch (error) {
      console.error(`Failed to fetch login history for user ${username}:`, error)
      throw error
    }
  }

  /**
   * Export users list (admin only)
   */
  async exportUsers(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    try {
      const params = new URLSearchParams()
      params.append('format', format)

      const url = `${this.baseUrl}/export?${params.toString()}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': format === 'json' ? 'application/json' : 'text/csv',
        },
      })

      if (!response.ok) {
        throw new ApiClientError(response.status, `Export failed: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Failed to export users:', error)
      throw error
    }
  }
}

// Create and export singleton instance
export const usersApi = new UsersApiService()

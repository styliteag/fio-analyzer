<template>
  <div class="user-manager-page">
    <div class="page-header">
      <h1 class="text-3xl font-bold text-gray-900">User Management</h1>
      <p class="text-gray-600 mt-2">Manage user accounts and permissions</p>
    </div>

    <div class="page-content">
      <!-- Access Control Check -->
      <div v-if="!hasAdminAccess" class="access-denied">
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <h3 class="font-medium">Access Denied</h3>
          <p class="mt-1">You need administrator privileges to access user management.</p>
        </div>
      </div>

      <div v-else>
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p class="text-center text-gray-600 mt-2">Loading users...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {{ error }}
          </div>
        </div>

        <!-- User Management Content -->
        <div v-else class="user-management-content">
          <!-- Action Bar -->
          <div class="action-bar mb-6">
            <div class="flex justify-between items-center">
              <div class="user-stats">
                <span class="text-sm text-gray-600">
                  {{ users.length }} total users ({{ adminUsers.length }} admins, {{ uploaderUsers.length }} uploaders)
                </span>
              </div>
              <button
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                @click="openAddUserModal"
              >
                Add New User
              </button>
            </div>
          </div>

          <!-- Users Table -->
          <div class="users-table">
            <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-300">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="table-header">Username</th>
                      <th class="table-header">Role</th>
                      <th class="table-header">Created</th>
                      <th class="table-header">Last Login</th>
                      <th class="table-header">Status</th>
                      <th class="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    <tr v-for="user in users" :key="user.username" class="hover:bg-gray-50">
                      <td class="table-cell font-medium text-gray-900">
                        <div class="flex items-center">
                          <div class="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <span class="text-xs font-medium text-gray-600">
                              {{ user.username.charAt(0).toUpperCase() }}
                            </span>
                          </div>
                          {{ user.username }}
                        </div>
                      </td>
                      <td class="table-cell">
                        <span
                          :class="[
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          ]"
                        >
                          {{ user.role }}
                        </span>
                      </td>
                      <td class="table-cell">
                        {{ formatDate(user.created_at) }}
                      </td>
                      <td class="table-cell">
                        {{ user.last_login ? formatDate(user.last_login) : 'Never' }}
                      </td>
                      <td class="table-cell">
                        <span
                          :class="[
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          ]"
                        >
                          {{ user.is_active ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td class="table-cell">
                        <div class="flex space-x-2">
                          <button
                            class="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            @click="editUser(user)"
                          >
                            Edit
                          </button>
                          <button
                            :class="[
                              'text-sm font-medium',
                              user.is_active
                                ? 'text-red-600 hover:text-red-900'
                                : 'text-green-600 hover:text-green-900'
                            ]"
                            @click="toggleUserStatus(user)"
                          >
                            {{ user.is_active ? 'Disable' : 'Enable' }}
                          </button>
                          <button
                            class="text-red-600 hover:text-red-900 text-sm font-medium"
                            :disabled="user.username === currentUser?.username"
                            @click="deleteUser(user)"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- User Activity Log -->
          <div class="activity-log mt-8">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent User Activity</h3>
              <div class="space-y-3">
                <div
                  v-for="activity in recentActivity"
                  :key="activity.id"
                  class="flex items-center space-x-3 text-sm"
                >
                  <div class="flex-shrink-0">
                    <div
                      :class="[
                        'h-2 w-2 rounded-full',
                        activity.type === 'login'
                          ? 'bg-green-400'
                          : activity.type === 'logout'
                            ? 'bg-yellow-400'
                            : 'bg-blue-400'
                      ]"
                    ></div>
                  </div>
                  <div class="flex-1 space-y-1">
                    <div class="flex items-center justify-between">
                      <h4 class="text-gray-900 font-medium">{{ activity.username }}</h4>
                      <span class="text-gray-500">{{ formatDate(activity.timestamp) }}</span>
                    </div>
                    <p class="text-gray-600">{{ activity.description }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit User Modal -->
      <div
        v-if="showUserModal"
        class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
        @click="closeUserModal"
      >
        <div
          class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
          @click.stop
        >
          <div class="modal-content">
            <h3 class="text-lg font-medium text-gray-900 mb-4">
              {{ editingUser ? 'Edit User' : 'Add New User' }}
            </h3>
            <form class="space-y-4" @submit.prevent="saveUser">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  v-model="userForm.username"
                  type="text"
                  required
                  :disabled="editingUser !== null"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div v-if="!editingUser">
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  v-model="userForm.password"
                  type="password"
                  required
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  v-model="userForm.role"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="uploader">Uploader</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div class="flex items-center">
                <input
                  v-model="userForm.is_active"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label class="ml-2 text-sm text-gray-700">Active</label>
              </div>
              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  @click="closeUserModal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="userFormLoading"
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {{ userFormLoading ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useErrorHandler } from '@/composables/useErrorHandler'

interface User {
  username: string
  role: 'admin' | 'uploader'
  created_at: string
  last_login?: string
  is_active: boolean
}

interface UserActivity {
  id: string
  username: string
  type: 'login' | 'logout' | 'created' | 'updated'
  description: string
  timestamp: string
}

const { user: currentUser, hasPermission } = useAuth()
const { handleApiError } = useErrorHandler()

// State
const loading = ref(false)
const error = ref<string | null>(null)
const users = ref<User[]>([])
const recentActivity = ref<UserActivity[]>([])

// Modal state
const showUserModal = ref(false)
const editingUser = ref<User | null>(null)
const userFormLoading = ref(false)
const userForm = ref({
  username: '',
  password: '',
  role: 'uploader' as 'admin' | 'uploader',
  is_active: true
})

// Computed
const hasAdminAccess = computed(() => hasPermission('admin'))

const adminUsers = computed(() => users.value.filter(user => user.role === 'admin'))
const uploaderUsers = computed(() => users.value.filter(user => user.role === 'uploader'))

// Methods
const loadUsers = async () => {
  loading.value = true
  error.value = null

  try {
    // Simulate API call for now - in real implementation, this would call the backend
    // const response = await apiClient.getUsers()
    // users.value = response

    // Mock data for demonstration
    users.value = [
      {
        username: 'admin',
        role: 'admin',
        created_at: '2024-01-15T10:00:00Z',
        last_login: '2024-01-20T14:30:00Z',
        is_active: true
      },
      {
        username: 'uploader1',
        role: 'uploader',
        created_at: '2024-01-16T09:00:00Z',
        last_login: '2024-01-19T16:45:00Z',
        is_active: true
      },
      {
        username: 'testuser',
        role: 'uploader',
        created_at: '2024-01-17T11:00:00Z',
        is_active: false
      }
    ]

    await loadRecentActivity()
  } catch (err) {
    error.value = 'Failed to load users'
    handleApiError(err)
  } finally {
    loading.value = false
  }
}

const loadRecentActivity = async () => {
  try {
    // Mock recent activity data
    recentActivity.value = [
      {
        id: '1',
        username: 'admin',
        type: 'login',
        description: 'Logged in successfully',
        timestamp: '2024-01-20T14:30:00Z'
      },
      {
        id: '2',
        username: 'uploader1',
        type: 'logout',
        description: 'Logged out',
        timestamp: '2024-01-19T16:45:00Z'
      },
      {
        id: '3',
        username: 'testuser',
        type: 'updated',
        description: 'Account disabled by admin',
        timestamp: '2024-01-18T12:00:00Z'
      }
    ]
  } catch (err) {
    console.error('Failed to load user activity:', err)
  }
}

const openAddUserModal = () => {
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    role: 'uploader',
    is_active: true
  }
  showUserModal.value = true
}

const editUser = (user: User) => {
  editingUser.value = user
  userForm.value = {
    username: user.username,
    password: '',
    role: user.role,
    is_active: user.is_active
  }
  showUserModal.value = true
}

const closeUserModal = () => {
  showUserModal.value = false
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    role: 'uploader',
    is_active: true
  }
}

const saveUser = async () => {
  userFormLoading.value = true

  try {
    if (editingUser.value) {
      // Update existing user
      // await apiClient.updateUser(editingUser.value.username, userForm.value)

      // Mock update
      const userIndex = users.value.findIndex(u => u.username === editingUser.value!.username)
      if (userIndex !== -1) {
        users.value[userIndex] = {
          ...users.value[userIndex],
          role: userForm.value.role,
          is_active: userForm.value.is_active
        }
      }
    } else {
      // Create new user
      // await apiClient.createUser(userForm.value)

      // Mock create
      const newUser: User = {
        username: userForm.value.username,
        role: userForm.value.role,
        created_at: new Date().toISOString(),
        is_active: userForm.value.is_active
      }
      users.value.push(newUser)
    }

    closeUserModal()
    await loadRecentActivity()
  } catch (err) {
    handleApiError(err)
  } finally {
    userFormLoading.value = false
  }
}

const toggleUserStatus = async (user: User) => {
  if (user.username === currentUser.value?.username) {
    alert('You cannot disable your own account')
    return
  }

  try {
    // await apiClient.updateUser(user.username, { is_active: !user.is_active })

    // Mock toggle
    const userIndex = users.value.findIndex(u => u.username === user.username)
    if (userIndex !== -1) {
      users.value[userIndex].is_active = !users.value[userIndex].is_active
    }

    await loadRecentActivity()
  } catch (err) {
    handleApiError(err)
  }
}

const deleteUser = async (user: User) => {
  if (user.username === currentUser.value?.username) {
    alert('You cannot delete your own account')
    return
  }

  if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
    return
  }

  try {
    // await apiClient.deleteUser(user.username)

    // Mock delete
    users.value = users.value.filter(u => u.username !== user.username)

    await loadRecentActivity()
  } catch (err) {
    handleApiError(err)
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Lifecycle
onMounted(() => {
  if (hasAdminAccess.value) {
    loadUsers()
  }
})
</script>

<style scoped>
.user-manager-page {
  @apply min-h-screen bg-gray-50 p-6;
}

.page-header {
  @apply mb-8;
}

.page-content {
  @apply max-w-7xl mx-auto;
}

.loading-state,
.error-state,
.access-denied {
  @apply text-center py-12;
}

.action-bar {
  @apply mb-6;
}

.users-table {
  @apply mb-8;
}

.table-header {
  @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
}

.table-cell {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-500;
}

.activity-log {
  @apply mt-8;
}

.modal-content {
  @apply p-4;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .action-bar .flex {
    @apply flex-col space-y-4 items-stretch;
  }

  .users-table {
    @apply overflow-x-auto;
  }

  .table-cell .flex {
    @apply flex-col space-y-1 space-x-0;
  }
}
</style>

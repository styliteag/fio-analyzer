<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header Section -->
    <div class="bg-white dark:bg-gray-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">User Management</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage admin and uploader users for the FIO Analyzer system
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <span v-if="users.length > 0" class="text-sm text-gray-600 dark:text-gray-300">
              ({{ users.length }}) {{ users.length === 1 ? 'User' : 'Users' }}
            </span>
            <button
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              @click="showAddUserForm = true"
            >
              <UserPlus class="w-4 h-4 mr-2" />
              Add User
            </button>
            <button
              :disabled="isRefreshing"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="refreshUsers"
            >
              <RefreshCw v-if="isRefreshing" class="animate-spin w-4 h-4 mr-2" />
              <RefreshCw v-else class="w-4 h-4 mr-2" />
              {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- User List - Main Content -->
        <div class="flex-1">
          <!-- Statistics Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <Users class="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Users
                      </dt>
                      <dd class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ users.length }}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <Shield class="h-6 w-6 text-blue-400" />
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Admin Users
                      </dt>
                      <dd class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ adminCount }}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <Upload class="h-6 w-6 text-green-400" />
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Uploader Users
                      </dt>
                      <dd class="text-lg font-medium text-gray-900 dark:text-white">
                        {{ uploaderCount }}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- User List Component -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                System Users
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage user accounts and permissions for the FIO Analyzer system
              </p>
            </div>

            <!-- Search and Filter Bar -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div class="flex-1 min-w-0">
                  <div class="relative rounded-md shadow-sm">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search class="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      v-model="searchQuery"
                      type="text"
                      class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Search users by username..."
                    />
                  </div>
                </div>
                <div class="flex items-center space-x-3">
                  <select
                    v-model="roleFilter"
                    class="focus:ring-blue-500 focus:border-blue-500 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="uploader">Uploader</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- User List -->
            <UserList
              :users="filteredUsers"
              :current-user="currentUser"
              :loading="isLoading"
              @edit-user="handleEditUser"
              @delete-user="handleDeleteUser"
            />
          </div>
        </div>

        <!-- Sidebar with Additional Info -->
        <div class="lg:w-80 space-y-6">
          <!-- User Roles Information -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                User Roles
              </h3>
            </div>
            <div class="px-6 py-4 space-y-4">
              <div class="flex items-start space-x-3">
                <Shield class="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Admin</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Full access to all features including user management, system configuration, and data analysis.
                  </p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <Upload class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Uploader</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Limited access focused on uploading FIO test data and viewing basic performance metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Recent User Activity
              </h3>
            </div>
            <div class="px-6 py-4">
              <div v-if="recentActivity.length === 0" class="text-center py-6">
                <Clock class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                <p class="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="activity in recentActivity"
                  :key="activity.id"
                  class="flex items-center space-x-3 text-sm"
                >
                  <div class="flex-shrink-0">
                    <div
                      :class="[
                        'h-2 w-2 rounded-full',
                        activity.type === 'login' ? 'bg-green-400' :
                        activity.type === 'created' ? 'bg-blue-400' :
                        activity.type === 'updated' ? 'bg-yellow-400' :
                        'bg-red-400'
                      ]"
                    ></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-gray-900 dark:text-white truncate">{{ activity.description }}</p>
                    <p class="text-gray-500 dark:text-gray-400">{{ activity.timestamp }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- System Security Status -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Security Status
              </h3>
            </div>
            <div class="px-6 py-4 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Password Policy</span>
                <span class="text-sm font-medium text-green-600 dark:text-green-400">Active</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Session Management</span>
                <span class="text-sm font-medium text-green-600 dark:text-green-400">Enabled</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Role-based Access</span>
                <span class="text-sm font-medium text-green-600 dark:text-green-400">Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div
      v-if="showAddUserForm"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Add New User</h3>
        </div>
        <AddUserForm
          :loading="isCreatingUser"
          @user-created="handleUserCreated"
          @cancel="showAddUserForm = false"
        />
      </div>
    </div>

    <!-- Edit User Modal -->
    <EditUserModal
      v-if="editingUser"
      :user="editingUser"
      :loading="isUpdatingUser"
      @user-updated="handleUserUpdated"
      @cancel="editingUser = null"
    />

    <!-- Delete Confirmation Modal -->
    <div
      v-if="userToDelete"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4">
          <div class="flex items-center mb-4">
            <AlertTriangle class="h-6 w-6 text-red-500 mr-3" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Delete User</h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to delete user "{{ userToDelete.username }}"? This action cannot be undone.
          </p>
          <div class="flex justify-end space-x-3">
            <button
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              @click="userToDelete = null"
            >
              Cancel
            </button>
            <button
              :disabled="isDeletingUser"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="confirmDeleteUser"
            >
              {{ isDeletingUser ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UserPlus, RefreshCw, Users, Shield, Upload, Search, Clock, AlertTriangle } from 'lucide-vue-next'
import UserList from '@/components/users/UserList.vue'
import AddUserForm from '@/components/users/AddUserForm.vue'
import EditUserModal from '@/components/users/EditUserModal.vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'
import type { UserAccount } from '@/types/auth'

// Composables
const { user: currentUser } = useAuth()
const { fetchWithErrorHandling } = useApi()

// Component state
const users = ref<UserAccount[]>([])
const isLoading = ref(false)
const isRefreshing = ref(false)
const isCreatingUser = ref(false)
const isUpdatingUser = ref(false)
const isDeletingUser = ref(false)
const showAddUserForm = ref(false)
const editingUser = ref<UserAccount | null>(null)
const userToDelete = ref<UserAccount | null>(null)
const searchQuery = ref('')
const roleFilter = ref('')

// Mock recent activity data
const recentActivity = ref([
  {
    id: 1,
    type: 'login',
    description: 'admin logged in',
    timestamp: '2 hours ago'
  },
  {
    id: 2,
    type: 'created',
    description: 'uploader user created',
    timestamp: '1 day ago'
  },
  {
    id: 3,
    type: 'login',
    description: 'uploader logged in',
    timestamp: '2 days ago'
  }
])

// Computed properties
const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const uploaderCount = computed(() => users.value.filter(u => u.role === 'uploader').length)

const filteredUsers = computed(() => {
  let filtered = users.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.username.toLowerCase().includes(query)
    )
  }

  // Apply role filter
  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  return filtered
})

// Methods
const loadUsers = async () => {
  isLoading.value = true
  try {
    const response = await fetchWithErrorHandling('/api/users/')
    if (response) {
      users.value = response
    }
  } catch (error) {
    console.error('Failed to load users:', error)
    users.value = []
  } finally {
    isLoading.value = false
  }
}

const refreshUsers = async () => {
  isRefreshing.value = true
  try {
    await loadUsers()
  } finally {
    isRefreshing.value = false
  }
}

const handleEditUser = (user: UserAccount) => {
  editingUser.value = user
}

const handleDeleteUser = (user: UserAccount) => {
  userToDelete.value = user
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleUserCreated = async (_newUser: UserAccount) => {
  showAddUserForm.value = false
  await refreshUsers()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleUserUpdated = async (_updatedUser: UserAccount) => {
  editingUser.value = null
  await refreshUsers()
}

const confirmDeleteUser = async () => {
  if (!userToDelete.value) return

  isDeletingUser.value = true
  try {
    await fetchWithErrorHandling(`/api/users/${userToDelete.value.username}`, {
      method: 'DELETE'
    })
    userToDelete.value = null
    await refreshUsers()
  } catch (error) {
    console.error('Failed to delete user:', error)
  } finally {
    isDeletingUser.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadUsers()
})
</script>
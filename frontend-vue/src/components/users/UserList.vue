<template>
  <div class="space-y-6">
    <!-- Header with actions -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-medium text-gray-900 dark:text-white">
          User Management
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Manage system users and their permissions
        </p>
      </div>

      <div class="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          @click="refreshUsers"
          :loading="loading"
        >
          <RefreshCwIcon class="w-4 h-4 mr-2" />
          Refresh
        </Button>

        <Button
          variant="primary"
          size="sm"
          @click="showAddUserModal = true"
        >
          <PlusIcon class="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <Input
          v-model="searchQuery"
          placeholder="Search users..."
          left-icon="Search"
          clearable
        />
      </div>

      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Role:
        </label>
        <select
          v-model="roleFilter"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="uploader">Uploader</option>
        </select>
      </div>
    </div>

    <!-- Users table -->
    <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Last Login
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Permissions
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="user in filteredUsers"
              :key="user.username"
              class="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <!-- User info -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 w-10 h-10">
                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span class="text-white font-medium text-sm">
                        {{ user.username.charAt(0).toUpperCase() }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ user.username }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {{ user.email || 'No email' }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Role -->
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getRoleBadgeClass(user.role)"
                >
                  {{ user.role }}
                </span>
              </td>

              <!-- Status -->
              <td class="px-6 py-4 whitespace-nowrap">
                <StatusIndicator
                  :status="user.isActive ? 'online' : 'offline'"
                  :label="user.isActive ? 'Active' : 'Inactive'"
                  :show-status="false"
                  size="sm"
                />
              </td>

              <!-- Last Login -->
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {{ user.lastLogin ? formatRelativeTime(user.lastLogin) : 'Never' }}
              </td>

              <!-- Permissions -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="permission in user.permissions.slice(0, 2)"
                    :key="permission.resource"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {{ permission.resource }}
                  </span>
                  <span
                    v-if="user.permissions.length > 2"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  >
                    +{{ user.permissions.length - 2 }}
                  </span>
                </div>
              </td>

              <!-- Actions -->
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end space-x-2">
                  <button
                    @click="editUser(user)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <EditIcon class="w-4 h-4" />
                  </button>

                  <button
                    v-if="canManageUsers && user.username !== currentUser?.username"
                    @click="toggleUserStatus(user)"
                    class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                    :title="user.isActive ? 'Deactivate user' : 'Activate user'"
                  >
                    <component
                      :is="user.isActive ? UserXIcon : UserCheckIcon"
                      class="w-4 h-4"
                    />
                  </button>

                  <button
                    v-if="canManageUsers && user.username !== currentUser?.username"
                    @click="deleteUser(user)"
                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredUsers.length === 0 && !loading"
        class="text-center py-12"
      >
        <UsersIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No users found
        </h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ searchQuery || roleFilter ? 'Try adjusting your search or filters.' : 'Get started by adding your first user.' }}
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between"
    >
      <div class="text-sm text-gray-700 dark:text-gray-300">
        Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalUsers) }} of {{ totalUsers }} users
      </div>

      <div class="flex items-center space-x-2">
        <button
          @click="currentPage = Math.max(1, currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Previous
        </button>

        <span class="text-sm text-gray-700 dark:text-gray-300">
          Page {{ currentPage }} of {{ totalPages }}
        </span>

        <button
          @click="currentPage = Math.min(totalPages, currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Add User Modal -->
    <Modal
      v-model="showAddUserModal"
      title="Add New User"
      size="md"
    >
      <AddUserForm
        @user-added="onUserAdded"
        @cancel="showAddUserModal = false"
      />
    </Modal>

    <!-- Edit User Modal -->
    <Modal
      v-model="showEditUserModal"
      title="Edit User"
      size="md"
    >
      <EditUserModal
        v-if="editingUser"
        :user="editingUser"
        @user-updated="onUserUpdated"
        @cancel="showEditUserModal = false"
      />
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import StatusIndicator from '@/components/ui/StatusIndicator.vue'
import Modal from '@/components/ui/Modal.vue'
import AddUserForm from './AddUserForm.vue'
import EditUserModal from './EditUserModal.vue'
import { formatRelativeTime } from '@/utils/formatters'
import {
  RefreshCw,
  Plus,
  Edit,
  Trash,
  UserX,
  UserCheck,
  Users
} from 'lucide-vue-next'

interface User {
  username: string
  email?: string
  role: 'admin' | 'uploader'
  isActive: boolean
  lastLogin?: Date
  permissions: Array<{
    resource: string
    actions: string[]
  }>
}

// Reactive state
const authStore = useAuthStore()
const uiStore = useUiStore()

const users = ref<User[]>([])
const loading = ref(false)
const searchQuery = ref('')
const roleFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const showAddUserModal = ref(false)
const showEditUserModal = ref(false)
const editingUser = ref<User | null>(null)

// Computed properties
const currentUser = computed(() => authStore.user)
const canManageUsers = computed(() => authStore.canManageUsers)

const filteredUsers = computed(() => {
  let filtered = users.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.username.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query))
    )
  }

  // Role filter
  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  return filtered
})

const totalUsers = computed(() => filteredUsers.value.length)
const totalPages = computed(() => Math.ceil(totalUsers.value / pageSize.value))

// Methods
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'uploader':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
}

function editUser(user: User) {
  editingUser.value = user
  showEditUserModal.value = true
}

async function toggleUserStatus(user: User) {
  try {
    // In a real implementation, this would call the API
    user.isActive = !user.isActive
    uiStore.showSuccess(
      'User Status Updated',
      `${user.username} is now ${user.isActive ? 'active' : 'inactive'}`
    )
  } catch (error) {
    uiStore.showError('Failed to update user status', error.message)
  }
}

async function deleteUser(user: User) {
  if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
    return
  }

  try {
    // In a real implementation, this would call the API
    const index = users.value.findIndex(u => u.username === user.username)
    if (index > -1) {
      users.value.splice(index, 1)
    }
    uiStore.showSuccess('User Deleted', `${user.username} has been removed`)
  } catch (error) {
    uiStore.showError('Failed to delete user', error.message)
  }
}

function refreshUsers() {
  loadUsers()
}

function onUserAdded(user: User) {
  users.value.push(user)
  showAddUserModal.value = false
  uiStore.showSuccess('User Added', `${user.username} has been added successfully`)
}

function onUserUpdated(updatedUser: User) {
  const index = users.value.findIndex(u => u.username === updatedUser.username)
  if (index > -1) {
    users.value[index] = updatedUser
  }
  showEditUserModal.value = false
  editingUser.value = null
  uiStore.showSuccess('User Updated', `${updatedUser.username} has been updated`)
}

function loadUsers() {
  loading.value = true

  // Simulate API call with mock data
  setTimeout(() => {
    users.value = [
      {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        permissions: [
          { resource: 'users', actions: ['read', 'write', 'delete'] },
          { resource: 'test-runs', actions: ['read', 'write', 'delete'] },
          { resource: 'system', actions: ['read', 'write'] },
        ],
      },
      {
        username: 'uploader',
        email: 'uploader@example.com',
        role: 'uploader',
        isActive: true,
        lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        permissions: [
          { resource: 'test-runs', actions: ['read'] },
          { resource: 'upload', actions: ['write'] },
        ],
      },
      {
        username: 'analyst',
        email: 'analyst@example.com',
        role: 'uploader',
        isActive: false,
        lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        permissions: [
          { resource: 'test-runs', actions: ['read'] },
        ],
      },
    ]

    loading.value = false
  }, 1000)
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

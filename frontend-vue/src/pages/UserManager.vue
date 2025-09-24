<template>
  <div class="user-manager-page min-h-screen bg-gray-50 p-6">
    <div class="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 class="text-3xl font-bold text-gray-900">User Management</h1>
        <p class="text-gray-600 mt-2">Create, update, and remove user accounts.</p>
      </header>

      <div v-if="!hasAdminAccess" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <h2 class="font-semibold">Access denied</h2>
        <p class="text-sm mt-1">Administrator privileges are required to manage users.</p>
      </div>

      <template v-else>
        <div v-if="loading" class="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p class="text-gray-600 mt-3">Loading users…</p>
        </div>

        <template v-else>
          <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {{ error }}
          </div>

          <div class="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div class="text-sm text-gray-600">
              {{ users.length }} user{{ users.length === 1 ? '' : 's' }}
            </div>
            <button
              class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              @click="openCreateForm"
            >
              Add User
            </button>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="user in users" :key="user.username" class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ user.username }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      ]"
                    >
                      {{ user.role === 'admin' ? 'Administrator' : 'Uploader' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right text-sm font-medium space-x-3">
                    <button
                      class="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      :disabled="saving || deleting[user.username]"
                      @click="openEditForm(user)"
                    >
                      Edit
                    </button>
                    <button
                      class="text-red-600 hover:text-red-800 disabled:opacity-50"
                      :disabled="saving || deleting[user.username] || user.username === currentUsername"
                      @click="handleDelete(user.username)"
                    >
                      {{ deleting[user.username] ? 'Deleting…' : 'Delete' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="users.length === 0">
                  <td colspan="3" class="px-6 py-6 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </div>

    <!-- Modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900">
            {{ isEditing ? 'Edit User' : 'Create User' }}
          </h2>
          <button class="text-gray-400 hover:text-gray-600" @click="closeForm">
            <span class="sr-only">Close</span>
            ×
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitForm">
          <div>
            <label class="block text-sm font-medium text-gray-700">Username</label>
            <input
              v-model="formUsername"
              type="text"
              :disabled="isEditing"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p v-if="formErrors.username" class="mt-1 text-sm text-red-600">{{ formErrors.username }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">
              {{ isEditing ? 'New Password (optional)' : 'Password' }}
            </label>
            <input
              v-model="formPassword"
              type="password"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              :placeholder="isEditing ? 'Leave blank to keep current password' : ''"
            />
            <p v-if="formErrors.password" class="mt-1 text-sm text-red-600">{{ formErrors.password }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              :placeholder="isEditing ? 'Leave blank to keep current password' : ''"
            />
            <p v-if="formErrors.confirmPassword" class="mt-1 text-sm text-red-600">{{ formErrors.confirmPassword }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Role</label>
            <select
              v-model="formRole"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="uploader">Uploader</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              @click="closeForm"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              :disabled="saving"
            >
              {{ saving ? 'Saving…' : 'Save User' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Api } from '@/services/api'
import { useAuth } from '@/composables/useAuth'

interface UserRow {
  username: string
  role: 'admin' | 'uploader'
}

const { user: currentUser, hasPermission } = useAuth()

const users = ref<UserRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showForm = ref(false)
const isEditing = ref(false)
const formUsername = ref('')
const formRole = ref<'admin' | 'uploader'>('uploader')
const formPassword = ref('')
const confirmPassword = ref('')
const formErrors = ref<Record<string, string>>({})
const saving = ref(false)
const deleting = ref<Record<string, boolean>>({})

const hasAdminAccess = computed(() => hasPermission('admin'))
const currentUsername = computed(() => currentUser.value?.username ?? '')

const resetForm = () => {
  showForm.value = false
  isEditing.value = false
  formUsername.value = ''
  formRole.value = 'uploader'
  formPassword.value = ''
  confirmPassword.value = ''
  formErrors.value = {}
}

const openCreateForm = () => {
  formUsername.value = ''
  formRole.value = 'uploader'
  formPassword.value = ''
  confirmPassword.value = ''
  formErrors.value = {}
  isEditing.value = false
  showForm.value = true
}

const openEditForm = (user: UserRow) => {
  formUsername.value = user.username
  formRole.value = user.role
  formPassword.value = ''
  confirmPassword.value = ''
  formErrors.value = {}
  isEditing.value = true
  showForm.value = true
}

const closeForm = () => {
  resetForm()
}

const validateForm = (editing: boolean): boolean => {
  const errors: Record<string, string> = {}

  if (!editing) {
    if (!formUsername.value.trim()) {
      errors.username = 'Username is required'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formUsername.value)) {
      errors.username = 'Use letters, numbers, hyphen, or underscore only'
    }
  }

  if (!editing || formPassword.value) {
    if (formPassword.value.length < 4) {
      errors.password = 'Password must be at least 4 characters'
    }
    if (formPassword.value !== confirmPassword.value) {
      errors.confirmPassword = 'Passwords do not match'
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const loadUsers = async () => {
  if (!hasAdminAccess.value) {
    users.value = []
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  try {
    const response = await Api.listUsers()
    users.value = response.map((user) => ({
      username: user.username,
      role: (user.role === 'admin' ? 'admin' : 'uploader') as 'admin' | 'uploader',
    }))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load users'
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  const editing = isEditing.value
  if (!validateForm(editing)) return

  saving.value = true
  error.value = null

  try {
    if (editing) {
      const payload: { password?: string; role?: 'admin' | 'uploader' } = {}
      if (formPassword.value) {
        payload.password = formPassword.value
      }
      if (formRole.value) {
        payload.role = formRole.value
      }
      await Api.updateUser(formUsername.value, payload)
    } else {
      await Api.createUser(formUsername.value.trim(), formPassword.value, formRole.value)
    }

    await loadUsers()
    resetForm()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save user'
  } finally {
    saving.value = false
  }
}

const handleDelete = async (username: string) => {
  if (username === currentUsername.value) {
    error.value = 'You cannot delete your own account.'
    return
  }

  if (!confirm(`Delete user "${username}"? This action cannot be undone.`)) {
    return
  }

  deleting.value = { ...deleting.value, [username]: true }
  error.value = null

  try {
    await Api.deleteUser(username)
    await loadUsers()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete user'
  } finally {
    deleting.value = { ...deleting.value, [username]: false }
  }
}

onMounted(() => {
  if (hasAdminAccess.value) {
    loadUsers()
  } else {
    loading.value = false
  }
})

watch(hasAdminAccess, (canManage) => {
  if (canManage && !loading.value && users.value.length === 0) {
    loadUsers()
  }
})
</script>

<style scoped>
</style>

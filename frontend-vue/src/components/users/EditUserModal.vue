<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Username (read-only) -->
    <div>
      <Input
        :model-value="user.username"
        label="Username"
        readonly
        class="bg-gray-50 dark:bg-gray-800"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Username cannot be changed
      </p>
    </div>

    <!-- Email -->
    <div>
      <Input
        v-model="form.email"
        type="email"
        label="Email"
        placeholder="Enter email address"
        :error="errors.email"
        :disabled="loading"
      />
    </div>

    <!-- Role -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
        Role
      </label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input
            v-model="form.role"
            type="radio"
            value="uploader"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            :disabled="loading"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            <strong>Uploader</strong> - Can upload test data and view results
          </span>
        </label>

        <label class="flex items-center">
          <input
            v-model="form.role"
            type="radio"
            value="admin"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            :disabled="loading"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            <strong>Admin</strong> - Full system access including user management
          </span>
        </label>
      </div>
      <p v-if="errors.role" class="mt-1 text-sm text-red-600 dark:text-red-400">
        {{ errors.role }}
      </p>
    </div>

    <!-- Change Password Section -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
        Change Password (Optional)
      </h4>

      <div class="space-y-4">
        <!-- Current Password -->
        <div>
          <Input
            v-model="form.currentPassword"
            type="password"
            label="Current Password"
            placeholder="Enter current password"
            :error="errors.currentPassword"
            :disabled="loading"
          />
        </div>

        <!-- New Password -->
        <div>
          <Input
            v-model="form.newPassword"
            type="password"
            label="New Password"
            placeholder="Enter new password"
            :error="errors.newPassword"
            :disabled="loading"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Leave blank to keep current password
          </p>
        </div>

        <!-- Confirm New Password -->
        <div>
          <Input
            v-model="form.confirmNewPassword"
            type="password"
            label="Confirm New Password"
            placeholder="Confirm new password"
            :error="errors.confirmNewPassword"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- Permissions Preview -->
    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Updated Permissions
      </h4>

      <div v-if="form.role === 'admin'" class="space-y-2">
        <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
          <span class="text-sm text-gray-700 dark:text-gray-300">Users</span>
          <span class="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">
            Full Access
          </span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
          <span class="text-sm text-gray-700 dark:text-gray-300">Test Runs</span>
          <span class="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">
            Full Access
          </span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-700 dark:text-gray-300">System</span>
          <span class="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">
            Full Access
          </span>
        </div>
      </div>

      <div v-else-if="form.role === 'uploader'" class="space-y-2">
        <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
          <span class="text-sm text-gray-700 dark:text-gray-300">Test Runs</span>
          <span class="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
            Read Only
          </span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-700 dark:text-gray-300">Upload</span>
          <span class="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
            Write Access
          </span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      <Button
        variant="outline"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        Cancel
      </Button>

      <Button
        type="submit"
        variant="primary"
        :loading="loading"
        :disabled="!isFormValid"
      >
        {{ loading ? 'Updating...' : 'Update User' }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

interface User {
  username: string
  email?: string
  role: 'admin' | 'uploader'
  isActive: boolean
  permissions: Array<{
    resource: string
    actions: string[]
  }>
}

interface FormData {
  email: string
  role: 'admin' | 'uploader'
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

interface ValidationErrors {
  email?: string
  role?: string
  currentPassword?: string
  newPassword?: string
  confirmNewPassword?: string
}

interface Props {
  user: User
}

const props = defineProps<Props>()

const uiStore = useUiStore()

// Form state
const form = reactive<FormData>({
  email: props.user.email || '',
  role: props.user.role,
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
})

const errors = reactive<ValidationErrors>({})
const loading = ref(false)

// Watch for user prop changes
watch(() => props.user, (newUser) => {
  if (newUser) {
    form.email = newUser.email || ''
    form.role = newUser.role
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmNewPassword = ''
  }
}, { immediate: true })

// Computed properties
const isFormValid = computed(() => {
  // Check if password change is being attempted
  const isChangingPassword = form.newPassword || form.confirmNewPassword

  if (isChangingPassword) {
    return form.role &&
           form.currentPassword &&
           form.newPassword &&
           form.confirmNewPassword &&
           form.newPassword === form.confirmNewPassword &&
           !Object.keys(errors).some(key => errors[key as keyof ValidationErrors])
  }

  // Just role change
  return form.role &&
         !Object.keys(errors).some(key => errors[key as keyof ValidationErrors])
})

// Methods
function validateForm(): boolean {
  errors.email = ''
  errors.role = ''
  errors.currentPassword = ''
  errors.newPassword = ''
  errors.confirmNewPassword = ''

  // Email validation (optional)
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Please enter a valid email address'
  }

  // Role validation
  if (!form.role) {
    errors.role = 'Please select a role'
  }

  // Password validation (only if attempting to change)
  const isChangingPassword = form.newPassword || form.confirmNewPassword

  if (isChangingPassword) {
    if (!form.currentPassword) {
      errors.currentPassword = 'Current password is required'
    }

    if (!form.newPassword) {
      errors.newPassword = 'New password is required'
    } else if (form.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters'
    }

    if (!form.confirmNewPassword) {
      errors.confirmNewPassword = 'Please confirm the new password'
    } else if (form.newPassword !== form.confirmNewPassword) {
      errors.confirmNewPassword = 'Passwords do not match'
    }
  }

  return Object.keys(errors).every(key => !errors[key as keyof ValidationErrors])
}

async function handleSubmit() {
  if (!validateForm()) return

  loading.value = true

  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Create updated user object
    const updatedUser = {
      ...props.user,
      email: form.email || undefined,
      role: form.role,
      permissions: form.role === 'admin'
        ? [
            { resource: 'users', actions: ['read', 'write', 'delete'] },
            { resource: 'test-runs', actions: ['read', 'write', 'delete'] },
            { resource: 'system', actions: ['read', 'write'] },
          ]
        : [
            { resource: 'test-runs', actions: ['read'] },
            { resource: 'upload', actions: ['write'] },
          ],
    }

    uiStore.showSuccess('User Updated', `${updatedUser.username} has been updated successfully`)
    emit('user-updated', updatedUser)
  } catch (error) {
    uiStore.showError('Failed to update user', error.message)
  } finally {
    loading.value = false
  }
}

const emit = defineEmits<{
  'user-updated': [user: User]
  cancel: []
}>()
</script>

<style scoped>
/* Additional styles if needed */
</style>

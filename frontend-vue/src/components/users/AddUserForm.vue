<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Username -->
    <div>
      <Input
        v-model="form.username"
        label="Username"
        placeholder="Enter username"
        :error="errors.username"
        required
        :disabled="loading"
      />
    </div>

    <!-- Password -->
    <div>
      <Input
        v-model="form.password"
        type="password"
        label="Password"
        placeholder="Enter password"
        :error="errors.password"
        required
        :disabled="loading"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Password must be at least 8 characters long
      </p>
    </div>

    <!-- Confirm Password -->
    <div>
      <Input
        v-model="form.confirmPassword"
        type="password"
        label="Confirm Password"
        placeholder="Confirm password"
        :error="errors.confirmPassword"
        required
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

    <!-- Email (optional) -->
    <div>
      <Input
        v-model="form.email"
        type="email"
        label="Email (Optional)"
        placeholder="Enter email address"
        :error="errors.email"
        :disabled="loading"
      />
    </div>

    <!-- Permissions Preview -->
    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Permissions Preview
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

      <div v-else class="text-sm text-gray-500 dark:text-gray-400">
        Select a role to see permissions
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
        {{ loading ? 'Creating User...' : 'Create User' }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useUiStore } from '@/stores/ui'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

interface FormData {
  username: string
  password: string
  confirmPassword: string
  role: 'admin' | 'uploader' | ''
  email: string
}

interface ValidationErrors {
  username?: string
  password?: string
  confirmPassword?: string
  role?: string
  email?: string
}

const uiStore = useUiStore()

// Form state
const form = reactive<FormData>({
  username: '',
  password: '',
  confirmPassword: '',
  role: '',
  email: '',
})

const errors = reactive<ValidationErrors>({})
const loading = ref(false)

// Computed properties
const isFormValid = computed(() => {
  return form.username.trim() &&
         form.password &&
         form.confirmPassword &&
         form.password === form.confirmPassword &&
         form.role &&
         !Object.keys(errors).some(key => errors[key as keyof ValidationErrors])
})

// Methods
function validateForm(): boolean {
  errors.username = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.role = ''
  errors.email = ''

  // Username validation
  if (!form.username.trim()) {
    errors.username = 'Username is required'
  } else if (form.username.length < 3) {
    errors.username = 'Username must be at least 3 characters'
  } else if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) {
    errors.username = 'Username can only contain letters, numbers, hyphens, and underscores'
  }

  // Password validation
  if (!form.password) {
    errors.password = 'Password is required'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  // Confirm password validation
  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }

  // Role validation
  if (!form.role) {
    errors.role = 'Please select a role'
  }

  // Email validation (optional)
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Please enter a valid email address'
  }

  return Object.keys(errors).every(key => !errors[key as keyof ValidationErrors])
}

async function handleSubmit() {
  if (!validateForm()) return

  loading.value = true

  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Create user object
    const newUser = {
      username: form.username,
      email: form.email || undefined,
      role: form.role as 'admin' | 'uploader',
      isActive: true,
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

    // Reset form
    Object.assign(form, {
      username: '',
      password: '',
      confirmPassword: '',
      role: '',
      email: '',
    })

    uiStore.showSuccess('User Created', `${newUser.username} has been added successfully`)
    emit('user-added', newUser)
  } catch (error) {
    uiStore.showError('Failed to create user', error.message)
  } finally {
    loading.value = false
  }
}

const emit = defineEmits<{
  'user-added': [user: any]
  cancel: []
}>()
</script>

<style scoped>
/* Additional styles if needed */
</style>

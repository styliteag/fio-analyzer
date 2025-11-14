<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="card max-w-md w-full space-y-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900">FIO Analyzer</h1>
        <p class="mt-2 text-sm text-gray-600">Sign in to your account</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="input-field"
            placeholder="Enter your username"
            :disabled="loading"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="input-field"
            placeholder="Enter your password"
            :disabled="loading"
          />
        </div>

        <div v-if="errorMessage" class="text-red-600 text-sm text-center">
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          class="btn-primary w-full"
          :disabled="loading"
        >
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''

  try {
    const success = await authStore.login(username.value, password.value)

    if (success) {
      router.push({ name: 'Comparison' })
    } else {
      errorMessage.value = 'Invalid username or password'
    }
  } catch (error) {
    errorMessage.value = 'An error occurred during login'
    console.error('Login error:', error)
  } finally {
    loading.value = false
  }
}
</script>

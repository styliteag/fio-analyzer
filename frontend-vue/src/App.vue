<template>
  <div id="app">
    <!-- Error Toast -->
    <div
      v-if="errorMessage"
      class="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg max-w-md"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <AlertCircle class="w-5 h-5 mr-2 flex-shrink-0" />
          <span class="text-sm">{{ errorMessage }}</span>
        </div>
        <button
          class="ml-3 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          @click="errorMessage = ''"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Success Toast -->
    <div
      v-if="successMessage"
      class="fixed top-4 right-4 z-50 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg shadow-lg max-w-md"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <CheckCircle class="w-5 h-5 mr-2 flex-shrink-0" />
          <span class="text-sm">{{ successMessage }}</span>
        </div>
        <button
          class="ml-3 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          @click="successMessage = ''"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="isGlobalLoading || isInitializing"
      class="fixed inset-0 z-40 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
        <div class="flex items-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-3 text-gray-900 dark:text-white">
            {{ isInitializing ? 'Initializing...' : 'Loading...' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Show navigation only when authenticated and not on login page -->
    <Navigation v-if="showNavigation" />

    <!-- Main content area -->
    <div class="main-content" :class="{ 'with-nav': showNavigation }">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AlertCircle, CheckCircle, X } from 'lucide-vue-next'
import Navigation from '@/components/Navigation.vue'
import { useAuth } from '@/composables/useAuth'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const { isAuthenticated, initialize, isInitializing, authError } = useAuth()
const uiStore = useUiStore()

// Computed properties
const showNavigation = computed(() => {
  return isAuthenticated.value &&
         route.path !== '/login' &&
         !route.path.startsWith('/error')
})

const errorMessage = computed({
  get: () => uiStore.errorMessage,
  set: (value) => uiStore.setErrorMessage(value)
})

const successMessage = computed({
  get: () => uiStore.successMessage,
  set: (value) => uiStore.setSuccessMessage(value)
})

const isGlobalLoading = computed(() => uiStore.isGlobalLoading)

// Watch for route query errors and display them
watch(() => route.query, (newQuery) => {
  if (newQuery.error === 'access-denied' && newQuery.message) {
    errorMessage.value = newQuery.message as string
  }
}, { immediate: true })

// Auto-dismiss messages after a few seconds
watch(errorMessage, (newMessage) => {
  if (newMessage) {
    setTimeout(() => {
      if (errorMessage.value === newMessage) {
        errorMessage.value = ''
      }
    }, 5000)
  }
})

watch(successMessage, (newMessage) => {
  if (newMessage) {
    setTimeout(() => {
      if (successMessage.value === newMessage) {
        successMessage.value = ''
      }
    }, 3000)
  }
})

// Lifecycle
onMounted(async () => {
  try {
    // Initialize authentication state
    await initialize()
  } catch (error) {
    console.error('Failed to initialize authentication:', error)
    // Don't show error to user as it might be expected (no stored auth)
  }
})

// Watch for authentication errors
watch(authError, (newError) => {
  if (newError) {
    errorMessage.value = newError
  }
})
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Inter', sans-serif;
}

html {
  /* Smooth scrolling */
  scroll-behavior: smooth;
}

#app {
  min-height: 100vh;
  background-color: #f9fafb;
  transition: background-color 0.2s ease-in-out;
}

#app.dark {
  background-color: #111827;
}

.main-content {
  min-height: 100vh;
  transition: all 0.2s ease-in-out;
}

.main-content.with-nav {
  min-height: calc(100vh - 64px); /* Account for navigation height */
}

/* Global toast animations */
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Custom scrollbar for dark mode */
.dark ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dark ::-webkit-scrollbar-track {
  background: #374151;
}

.dark ::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Focus styles for accessibility */
.focus-visible\:ring-blue-500:focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #3b82f6;
}

/* Smooth transitions for interactive elements */
button, a, input, select, textarea {
  transition: all 0.15s ease-in-out;
}

/* Custom loading animation */
@keyframes pulse-blue {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-blue {
  animation: pulse-blue 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  #app {
    filter: contrast(1.2);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Print styles */
@media print {
  .navigation,
  .toast,
  .loading-overlay,
  button:not(.print-friendly) {
    display: none !important;
  }

  #app {
    background: white !important;
    color: black !important;
  }

  .main-content {
    min-height: auto !important;
  }
}
</style>



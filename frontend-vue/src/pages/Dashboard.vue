<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header Section -->
    <div class="bg-white dark:bg-gray-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Overview of your FIO performance analysis system
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              @click="refreshData"
              :disabled="isRefreshing"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                v-if="isRefreshing"
                class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500 dark:text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <RefreshCw v-else class="w-4 h-4 mr-2" />
              {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Statistics Cards Section -->
      <div class="mb-8">
        <StatsCards />
      </div>

      <!-- Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content Area -->
        <div class="lg:col-span-2 space-y-8">
          <!-- System Status Panel -->
          <SystemStatus />

          <!-- Recent Activity Feed -->
          <RecentActivity />
        </div>

        <!-- Sidebar -->
        <div class="space-y-8">
          <!-- Quick Links -->
          <QuickLinks />

          <!-- Additional Info Panel -->
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                System Information
              </h3>
              <dl class="space-y-3">
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                  <dd class="text-sm text-gray-900 dark:text-gray-100">v{{ version }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                  <dd class="text-sm text-gray-900 dark:text-gray-100">{{ lastUpdated }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Uptime</dt>
                  <dd class="text-sm text-gray-900 dark:text-gray-100">{{ uptime }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Welcome Message for First Login -->
    <div
      v-if="showWelcomeMessage"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50"
      @click="hideWelcomeMessage"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4" @click.stop>
        <div class="flex items-center mb-4">
          <CheckCircle class="w-8 h-8 text-green-500 mr-3" />
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Welcome back, {{ currentUser?.username }}!
          </h3>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
          You have successfully logged in to the FIO Analyzer dashboard.
        </p>
        <button
          @click="hideWelcomeMessage"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Get Started
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, CheckCircle } from 'lucide-vue-next'
import StatsCards from '@/components/dashboard/StatsCards.vue'
import RecentActivity from '@/components/dashboard/RecentActivity.vue'
import SystemStatus from '@/components/dashboard/SystemStatus.vue'
import QuickLinks from '@/components/dashboard/QuickLinks.vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'

// Composables
const { user: currentUser } = useAuth()
const { fetchWithErrorHandling } = useApi()

// Component state
const isRefreshing = ref(false)
const showWelcomeMessage = ref(false)
const version = ref('1.0.0')
const lastUpdated = ref('')
const uptime = ref('')

// Computed properties
const welcomeMessage = computed(() => {
  if (currentUser.value) {
    return `Welcome back, ${currentUser.value.username}!`
  }
  return 'Welcome to FIO Analyzer!'
})

// Methods
const refreshData = async () => {
  isRefreshing.value = true
  try {
    // Trigger refresh of all dashboard data
    // This will be handled by individual components
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call

    // Update last refreshed timestamp
    lastUpdated.value = new Date().toLocaleString()
  } catch (error) {
    console.error('Failed to refresh dashboard data:', error)
  } finally {
    isRefreshing.value = false
  }
}

const hideWelcomeMessage = () => {
  showWelcomeMessage.value = false
  localStorage.setItem('dashboard_welcome_shown', 'true')
}

const loadSystemInfo = async () => {
  try {
    const response = await fetchWithErrorHandling('/api/info')
    if (response) {
      version.value = response.version || '1.0.0'
    }
  } catch (error) {
    console.warn('Could not load system information:', error)
  }
}

const calculateUptime = () => {
  // Simple uptime calculation - in real app this would come from API
  const now = new Date()
  const bootTime = new Date(now.getTime() - Math.random() * 86400000 * 7) // Random uptime up to 7 days
  const uptimeMs = now.getTime() - bootTime.getTime()
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  uptime.value = `${days}d ${hours}h`
}

// Lifecycle
onMounted(async () => {
  // Show welcome message if user hasn't seen it yet
  const welcomeShown = localStorage.getItem('dashboard_welcome_shown')
  if (!welcomeShown && currentUser.value) {
    showWelcomeMessage.value = true
  }

  // Load initial data
  await loadSystemInfo()
  calculateUptime()
  lastUpdated.value = new Date().toLocaleString()

  // Set up periodic updates
  const interval = setInterval(() => {
    calculateUptime()
  }, 60000) // Update every minute

  // Cleanup on unmount
  onUnmounted(() => {
    clearInterval(interval)
  })
})

// Import onUnmounted for cleanup
import { onUnmounted } from 'vue'
</script>
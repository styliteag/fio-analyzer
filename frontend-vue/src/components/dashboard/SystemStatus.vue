<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        System Status
      </h3>

      <Button
        variant="ghost"
        size="sm"
        :loading="loading"
        @click="refresh"
      >
        <RefreshCwIcon class="w-4 h-4" />
      </Button>
    </div>

    <!-- Overall status -->
    <div class="mb-6">
      <div class="flex items-center space-x-3">
        <StatusIndicator
          :status="overallStatus"
          :label="overallStatusText"
          size="lg"
        />
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ overallStatusText }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Last updated {{ formatRelativeTime(lastUpdated) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Service status grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div
        v-for="service in services"
        :key="service.name"
        class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <div class="flex items-center space-x-3">
          <StatusIndicator
            :status="service.status"
            :label="service.name"
            :show-status="false"
            size="md"
          />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ service.name }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ service.description }}
            </p>
          </div>
        </div>

        <div class="text-right">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatRelativeTime(service.lastCheck) }}
          </p>
          <p
            v-if="service.responseTime"
            class="text-xs text-gray-400 dark:text-gray-500"
          >
            {{ service.responseTime }}ms
          </p>
        </div>
      </div>
    </div>

    <!-- System metrics -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
        System Metrics
      </h4>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ metrics.uptime }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Uptime
          </div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ metrics.requests }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Total Requests
          </div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {{ metrics.memory }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Memory Usage
          </div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {{ metrics.cpu }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            CPU Usage
          </div>
        </div>
      </div>
    </div>

    <!-- Issues section -->
    <div
      v-if="issues.length > 0"
      class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6"
    >
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
        Issues Detected
      </h4>

      <div class="space-y-2">
        <div
          v-for="issue in issues"
          :key="issue.id"
          class="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
        >
          <AlertTriangleIcon class="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">
              {{ issue.title }}
            </p>
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ issue.description }}
            </p>
            <p class="text-xs text-red-600 dark:text-red-400 mt-1">
              {{ formatRelativeTime(issue.timestamp) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading && services.length === 0"
      class="flex justify-center py-12"
    >
      <LoadingSpinner
        message="Checking system status..."
        size="lg"
      />
    </div>

    <!-- Error state -->
    <div v-if="error" class="mt-6">
      <ErrorMessage
        :message="error"
        severity="medium"
        retryable
        @retry="refresh"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from '@/components/ui/Button.vue'
import StatusIndicator from '@/components/ui/StatusIndicator.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { formatRelativeTime, formatDuration } from '@/utils/formatters'
import { RefreshCw as RefreshCwIcon, AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next'

interface Service {
  name: string
  description: string
  status: 'online' | 'offline' | 'degraded' | 'unknown'
  lastCheck: Date
  responseTime?: number
}

interface SystemMetrics {
  uptime: string
  requests: string
  memory: string
  cpu: string
}

interface SystemIssue {
  id: string
  title: string
  description: string
  timestamp: Date
}


// Reactive state
const services = ref<Service[]>([])
const metrics = ref<SystemMetrics>({
  uptime: '0d 0h',
  requests: '0',
  memory: '0%',
  cpu: '0%',
})
const issues = ref<SystemIssue[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref(new Date())

// Computed properties
const overallStatus = computed(() => {
  if (services.value.length === 0) return 'unknown'

  const hasOffline = services.value.some(s => s.status === 'offline')
  const hasDegraded = services.value.some(s => s.status === 'degraded')

  if (hasOffline) return 'error'
  if (hasDegraded) return 'warning'
  return 'online'
})

const overallStatusText = computed(() => {
  switch (overallStatus.value) {
    case 'online':
      return 'All systems operational'
    case 'warning':
      return 'Some services degraded'
    case 'error':
      return 'System issues detected'
    default:
      return 'Status unknown'
  }
})

// Methods
function loadSystemStatus() {
  loading.value = true
  error.value = null

  // Simulate API call with realistic data
  setTimeout(() => {
    services.value = [
      {
        name: 'API Server',
        description: 'Main application server',
        status: 'online',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 100) + 50,
      },
      {
        name: 'Database',
        description: 'Data storage and retrieval',
        status: 'online',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 50) + 25,
      },
      {
        name: 'File Storage',
        description: 'Test result storage',
        status: 'online',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 150) + 75,
      },
      {
        name: 'Authentication',
        description: 'User authentication service',
        status: 'online',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 80) + 40,
      },
    ]

    // Randomly make some services degraded (for demo)
    if (Math.random() > 0.7) {
      const randomService = services.value[Math.floor(Math.random() * services.value.length)]
      randomService.status = Math.random() > 0.5 ? 'degraded' : 'offline'

      if (randomService.status !== 'online') {
        issues.value.push({
          id: `issue-${Date.now()}`,
          title: `${randomService.name} ${randomService.status}`,
          description: `${randomService.name} is experiencing ${randomService.status} status. Please check system logs for more details.`,
          timestamp: new Date(),
        })
      }
    }

    metrics.value = {
      uptime: formatDuration(Math.random() * 86400000 * 7), // Random uptime up to 7 days
      requests: (Math.floor(Math.random() * 10000) + 1000).toLocaleString(),
      memory: `${Math.floor(Math.random() * 60) + 20}%`,
      cpu: `${Math.floor(Math.random() * 40) + 10}%`,
    }

    lastUpdated.value = new Date()
    loading.value = false
  }, 1000)
}

function refresh() {
  issues.value = []
  loadSystemStatus()
}

// Load status on mount
onMounted(() => {
  loadSystemStatus()
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

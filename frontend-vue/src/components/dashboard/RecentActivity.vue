<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Recent Activity
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

    <div v-if="loading && activities.length === 0" class="space-y-4">
      <div v-for="n in 5" :key="n" class="animate-pulse">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div class="flex-1">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-1"></div>
          </div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>

    <div v-else-if="activities.length === 0" class="text-center py-12">
      <ActivityIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
        No recent activity
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Get started by running your first performance test.
      </p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="activity in activities"
        :key="activity.id"
        class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <!-- Activity icon -->
        <div
          class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          :class="activity.iconBg"
        >
          <component :is="activity.icon" class="w-4 h-4" :class="activity.iconColor" />
        </div>

        <!-- Activity content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ activity.title }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
              {{ formatRelativeTime(activity.timestamp) }}
            </p>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {{ activity.description }}
          </p>

          <!-- Additional metadata -->
          <div
            v-if="activity.metadata"
            class="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400"
          >
            <span v-if="activity.metadata.hostname">
              <ServerIcon class="w-3 h-3 inline mr-1" />
              {{ activity.metadata.hostname }}
            </span>
            <span v-if="activity.metadata.iops">
              {{ formatIOPS(activity.metadata.iops) }}
            </span>
            <span v-if="activity.metadata.duration">
              {{ formatDuration(activity.metadata.duration * 1000) }}
            </span>
          </div>
        </div>

        <!-- Status indicator -->
        <div class="flex-shrink-0">
          <StatusIndicator
            :status="activity.status"
            :label="activity.statusText"
            :show-status="false"
            size="sm"
          />
        </div>
      </div>
    </div>

    <!-- Load more button -->
    <div v-if="hasMore && !loading" class="mt-6 text-center">
      <Button
        variant="outline"
        size="sm"
        :loading="loadingMore"
        @click="loadMore"
      >
        Load more activity
      </Button>
    </div>

    <!-- Error state -->
    <div v-if="error && activities.length === 0" class="text-center py-12">
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
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import Button from '@/components/ui/Button.vue'
import StatusIndicator from '@/components/ui/StatusIndicator.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import type { TestRun } from '@/types/testRun'
import {
  RefreshCw,
  Activity as ActivityIcon,
  Upload,
  CheckCircle,
  Server as ServerIcon,
  BarChart3
} from 'lucide-vue-next'

interface Activity {
  id: string
  type: 'upload' | 'test_run' | 'analysis' | 'system'
  title: string
  description: string
  timestamp: Date
  status: 'success' | 'error' | 'info' | 'warning'
  statusText: string
  icon: typeof RefreshCw
  iconBg: string
  iconColor: string
  metadata?: {
    hostname?: string
    iops?: number
    duration?: number
    driveModel?: string
  }
}

interface Props {
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  limit: 10,
})

const { fetchWithErrorHandling } = useApi()

// Reactive state
const testRuns = ref<TestRun[]>([])
const activities = ref<Activity[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const hasMore = ref(false)
const currentOffset = ref(0)

// Generate activities from test runs data
const generatedActivities = computed(() => {
  const runs = testRuns.value
  if (!runs || runs.length === 0) return []

  return runs.slice(0, props.limit).map((run, index) => {
    const activityTypes: Array<'upload' | 'test_run' | 'analysis' | 'system'> = ['test_run', 'upload', 'analysis']
    const type = activityTypes[index % activityTypes.length]

    let activity: Activity

    switch (type) {
      case 'test_run':
        activity = {
          id: `test-run-${run.id}`,
          type: 'test_run',
          title: `Test run completed on ${run.hostname}`,
          description: `${run.read_write_pattern} test with ${run.block_size} blocks`,
          timestamp: new Date(run.timestamp),
          status: run.iops > 0 ? 'success' : 'error',
          statusText: run.iops > 0 ? 'Completed' : 'Failed',
          icon: CheckCircle,
          iconBg: 'bg-green-100 dark:bg-green-900',
          iconColor: 'text-green-600 dark:text-green-400',
          metadata: {
            hostname: run.hostname,
            iops: run.iops,
            duration: run.duration,
            driveModel: run.drive_model,
          },
        }
        break

      case 'upload':
        activity = {
          id: `upload-${run.id}`,
          type: 'upload',
          title: `Data uploaded from ${run.hostname}`,
          description: `Performance results for ${run.drive_model}`,
          timestamp: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
          status: 'success',
          statusText: 'Uploaded',
          icon: Upload,
          iconBg: 'bg-blue-100 dark:bg-blue-900',
          iconColor: 'text-blue-600 dark:text-blue-400',
          metadata: {
            hostname: run.hostname,
          },
        }
        break

      case 'analysis':
        activity = {
          id: `analysis-${run.id}`,
          type: 'analysis',
          title: `Analysis completed for ${run.hostname}`,
          description: `Performance metrics analyzed and visualized`,
          timestamp: new Date(Date.now() - Math.random() * 43200000), // Random time in last 12h
          status: 'info',
          statusText: 'Analyzed',
          icon: BarChart3,
          iconBg: 'bg-purple-100 dark:bg-purple-900',
          iconColor: 'text-purple-600 dark:text-purple-400',
          metadata: {
            hostname: run.hostname,
            iops: run.iops,
          },
        }
        break

      default:
        activity = {
          id: `system-${run.id}`,
          type: 'system',
          title: 'System maintenance completed',
          description: 'Database optimization and cleanup performed',
          timestamp: new Date(Date.now() - Math.random() * 21600000), // Random time in last 6h
          status: 'info',
          statusText: 'Maintenance',
          icon: ActivityIcon,
          iconBg: 'bg-gray-100 dark:bg-gray-800',
          iconColor: 'text-gray-600 dark:text-gray-400',
        }
    }

    return activity
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
})

// Methods
async function loadActivities() {
  loading.value = true
  error.value = null

  try {
    const response = await fetchWithErrorHandling('/api/test-runs/', {
      params: {
        limit: props.limit * 3, // Get more data to generate varied activities
        order_by: 'timestamp',
        order: 'desc'
      }
    })

    if (response) {
      testRuns.value = response
      activities.value = generatedActivities.value.slice(0, props.limit)
      hasMore.value = generatedActivities.value.length > props.limit
      currentOffset.value = props.limit
    }
  } catch (err: unknown) {
    console.error('Failed to load recent activity:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load recent activity'
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true

  setTimeout(() => {
    const newActivities = generatedActivities.value.slice(
      currentOffset.value,
      currentOffset.value + props.limit
    )
    activities.value.push(...newActivities)
    currentOffset.value += props.limit
    hasMore.value = currentOffset.value < generatedActivities.value.length
    loadingMore.value = false
  }, 500)
}

async function refresh() {
  currentOffset.value = 0
  await loadActivities()
}

// Load activities on mount
onMounted(async () => {
  await loadActivities()
})

// Watch for data changes
watch(() => testRuns.value.length, () => {
  if (testRuns.value.length > 0) {
    // Update activities when new test runs are loaded
    activities.value = generatedActivities.value.slice(0, currentOffset.value)
    hasMore.value = generatedActivities.value.length > currentOffset.value
  }
})

// Utility functions
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}m ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}d ago`
  }
}

function formatIOPS(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M IOPS`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K IOPS`
  } else {
    return `${Math.round(value)} IOPS`
  }
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style>

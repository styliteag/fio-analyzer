<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-6">
      Quick Actions
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Upload Data -->
      <router-link
        to="/upload"
        class="group block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
            <UploadIcon class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
              Upload Test Data
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Import FIO results from JSON files
            </p>
          </div>
          <ChevronRightIcon class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
        </div>
      </router-link>

      <!-- Run Analysis -->
      <router-link
        to="/analysis"
        class="group block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-300 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
            <BarChart3Icon class="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-300">
              Performance Analysis
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Analyze and visualize test results
            </p>
          </div>
          <ChevronRightIcon class="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
        </div>
      </router-link>

      <!-- Host Comparison -->
      <router-link
        to="/analysis?tab=comparison"
        class="group block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
            <ServerIcon class="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300">
              Host Comparison
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Compare performance across hosts
            </p>
          </div>
          <ChevronRightIcon class="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
        </div>
      </router-link>

      <!-- User Management -->
      <router-link
        v-if="canManageUsers"
        to="/users"
        class="group block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
            <UsersIcon class="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-orange-700 dark:group-hover:text-orange-300">
              User Management
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Manage system users and permissions
            </p>
          </div>
          <ChevronRightIcon class="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
        </div>
      </router-link>

      <!-- Documentation -->
      <a
        href="/docs"
        target="_blank"
        rel="noopener noreferrer"
        class="group block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
            <BookOpenIcon class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
              Documentation
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              API docs and user guides
            </p>
          </div>
          <ExternalLinkIcon class="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
        </div>
      </a>

      <!-- Settings -->
      <router-link
        to="/settings"
        class="group block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
            <SettingsIcon class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300">
              Settings
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Configure system preferences
            </p>
          </div>
          <ChevronRightIcon class="w-4 h-4 text-gray-400 group-hover:text-gray-500 transition-colors" />
        </div>
      </router-link>
    </div>

    <!-- Recent uploads section -->
    <div class="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
        Recent Uploads
      </h4>

      <div v-if="recentUploads.length === 0" class="text-center py-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          No recent uploads
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="upload in recentUploads"
          :key="upload.id"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircleIcon class="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ upload.filename }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ upload.recordCount }} records • {{ formatRelativeTime(upload.timestamp) }}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="xs"
            @click="viewUpload(upload.id)"
          >
            View
          </Button>
        </div>
      </div>

      <div v-if="recentUploads.length > 0" class="mt-4 text-center">
        <router-link
          to="/uploads"
          class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all uploads →
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { formatRelativeTime } from '@/utils/formatters'
import Button from '@/components/ui/Button.vue'
import {
  Upload as UploadIcon,
  BarChart3 as BarChart3Icon,
  Server as ServerIcon,
  Users as UsersIcon,
  BookOpen as BookOpenIcon,
  Settings as SettingsIcon,
  ChevronRight as ChevronRightIcon,
  ExternalLink as ExternalLinkIcon,
  CheckCircle as CheckCircleIcon
} from 'lucide-vue-next'

interface RecentUpload {
  id: string
  filename: string
  recordCount: number
  timestamp: Date
}

const authStore = useAuthStore()

// Reactive state
const recentUploads = ref<RecentUpload[]>([])

// Computed properties
const canManageUsers = computed(() => authStore.canManageUsers)

// Methods
function loadRecentUploads() {
  // Simulate loading recent uploads
  // In a real app, this would come from an API
  recentUploads.value = [
    {
      id: '1',
      filename: 'fio_results_2024-01-15.json',
      recordCount: 250,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: '2',
      filename: 'performance_test_batch_001.json',
      recordCount: 180,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    },
    {
      id: '3',
      filename: 'storage_benchmark_q4.json',
      recordCount: 320,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    },
  ]
}

function viewUpload(uploadId: string) {
  // Navigate to upload details
  console.log('Viewing upload:', uploadId)
  // In a real app, this would navigate to the upload details page
}

// Load data on mount
onMounted(() => {
  loadRecentUploads()
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

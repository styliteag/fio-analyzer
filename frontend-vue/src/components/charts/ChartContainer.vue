<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <!-- Chart header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex-1">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          {{ title }}
        </h3>
        <p
          v-if="subtitle"
          class="text-sm text-gray-600 dark:text-gray-400 mt-1"
        >
          {{ subtitle }}
        </p>
      </div>

      <!-- Chart controls -->
      <div class="flex items-center space-x-2">
        <!-- Chart type selector -->
        <div
          v-if="availableChartTypes.length > 1"
          class="relative"
        >
          <select
            v-model="selectedChartType"
            class="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option
              v-for="type in availableChartTypes"
              :key="type.value"
              :value="type.value"
            >
              {{ type.label }}
            </option>
          </select>
          <ChevronDownIcon class="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        <!-- Export button -->
        <button
          v-if="allowExport"
          @click="exportChart"
          class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="'Export chart'"
        >
          <DownloadIcon class="w-4 h-4" />
        </button>

        <!-- Fullscreen button -->
        <button
          v-if="allowFullscreen"
          @click="toggleFullscreen"
          class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        >
          <MaximizeIcon
            v-if="!isFullscreen"
            class="w-4 h-4"
          />
          <MinimizeIcon
            v-else
            class="w-4 h-4"
          />
        </button>

        <!-- Refresh button -->
        <button
          @click="refreshData"
          class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="'Refresh data'"
          :disabled="loading"
        >
          <RefreshCwIcon class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Chart content -->
    <div
      ref="chartContainer"
      class="relative"
      :class="containerClasses"
    >
      <!-- Loading state -->
      <div
        v-if="loading"
        class="flex items-center justify-center py-12"
      >
        <LoadingSpinner
          message="Loading chart data..."
          size="md"
        />
      </div>

      <!-- Error state -->
      <div
        v-else-if="error"
        class="flex items-center justify-center py-12"
      >
        <ErrorMessage
          :message="error"
          severity="medium"
          retryable
          @retry="refreshData"
        />
      </div>

      <!-- Chart content -->
      <div v-else>
        <slot
          :chart-type="selectedChartType"
          :data="chartData"
          :loading="loading"
          :error="error"
        />
      </div>

      <!-- No data state -->
      <div
        v-if="!loading && !error && (!chartData || chartData.length === 0)"
        class="flex items-center justify-center py-12"
      >
        <div class="text-center">
          <BarChart3Icon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No data available
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters or refreshing the data.
          </p>
        </div>
      </div>
    </div>

    <!-- Chart footer -->
    <div
      v-if="$slots.footer"
      class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import {
  ChevronDown,
  Download,
  Maximize,
  Minimize,
  RefreshCw,
  BarChart3
} from 'lucide-vue-next'

type ChartType = 'line' | 'bar' | 'scatter' | 'heatmap' | 'radar' | 'pie'

interface ChartTypeOption {
  value: ChartType
  label: string
}

interface Props {
  title: string
  subtitle?: string
  chartType?: ChartType
  availableChartTypes?: ChartTypeOption[]
  allowExport?: boolean
  allowFullscreen?: boolean
  loading?: boolean
  error?: string
  chartData?: any[]
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  chartType: 'line',
  availableChartTypes: () => [
    { value: 'line', label: 'Line Chart' },
    { value: 'bar', label: 'Bar Chart' },
    { value: 'scatter', label: 'Scatter Plot' },
  ],
  allowExport: true,
  allowFullscreen: true,
  loading: false,
  height: '400px',
})

const emit = defineEmits<{
  'chart-type-change': [type: ChartType]
  'export': [format: string]
  'refresh': []
  'fullscreen-change': [isFullscreen: boolean]
}>()

const chartContainer = ref<HTMLElement>()
const isFullscreen = ref(false)
const selectedChartType = ref<ChartType>(props.chartType)

// Computed properties
const containerClasses = computed(() => {
  return [
    'min-h-[200px]',
    isFullscreen.value ? 'fixed inset-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl' : '',
  ]
})

// Watch for prop changes
watch(() => props.chartType, (newType) => {
  if (newType && newType !== selectedChartType.value) {
    selectedChartType.value = newType
  }
})

watch(selectedChartType, (newType) => {
  emit('chart-type-change', newType)
})

// Methods
function exportChart() {
  // In a real implementation, this would trigger chart export
  emit('export', 'png')
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  emit('fullscreen-change', isFullscreen.value)
}

function refreshData() {
  emit('refresh')
}

// Handle escape key for fullscreen
watch(isFullscreen, (newValue) => {
  if (newValue) {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        isFullscreen.value = false
        emit('fullscreen-change', false)
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)
  }
})
</script>

<style scoped>
/* Additional styles for fullscreen mode */
</style>

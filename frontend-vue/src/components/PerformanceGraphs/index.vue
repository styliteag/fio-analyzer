<template>
  <div class="performance-graphs">
    <!-- Header -->
    <div class="mb-6">
      <h4 class="text-xl font-bold theme-text-primary mb-2">
        Performance Graphs
      </h4>
      <p class="text-sm theme-text-secondary mb-4">
        Interactive chart-based visualization of storage performance metrics across {{ drives.length }} drive configurations.
      </p>
    </div>

    <!-- Chart Type Selection -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="chartType in chartTypes"
        :key="chartType.id"
        :class="[
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          activeChart === chartType.id
            ? 'bg-blue-600 text-white dark:bg-blue-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        ]"
        @click="activeChart = chartType.id"
      >
        {{ chartType.label }}
      </button>
    </div>

    <!-- Chart Content -->
    <div class="w-full">
      <!-- IOPS Comparison Chart -->
      <IOPSComparisonChart
        v-if="activeChart === 'iops-comparison'"
        :data="chartData.iopsData"
        :height="400"
        class="w-full"
      />

      <!-- Latency Analysis Chart -->
      <LatencyAnalysisChart
        v-else-if="activeChart === 'latency-analysis'"
        :data="chartData.latencyData"
        :height="400"
        class="w-full"
      />

      <!-- Bandwidth Trends Chart -->
      <BandwidthTrendsChart
        v-else-if="activeChart === 'bandwidth-trends'"
        :data="chartData.bandwidthData"
        :height="400"
        class="w-full"
      />

      <!-- Responsiveness Chart -->
      <ResponsivenessChart
        v-else-if="activeChart === 'responsiveness'"
        :data="chartData.responsivenessData"
        :height="400"
        class="w-full"
      />
    </div>

    <!-- Development Info -->
    <div v-if="typeof window !== 'undefined'" class="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h6 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
        Development Info
      </h6>
      <div class="text-xs text-blue-600 dark:text-blue-300 space-y-1">
        <p>Total drives: {{ drives.length }}</p>
        <p>Available configurations: {{ drives.reduce((sum, drive) => sum + drive.configurations.length, 0) }}</p>
        <p>Unique hosts: {{ new Set(drives.map(d => d.hostname)).size }}</p>
        <p>Active chart: {{ activeChart }}</p>
        <p>Chart data loaded: {{ Object.keys(chartData).length > 0 }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTheme } from '@/contexts/ThemeContext'
import type { DriveAnalysis } from '@/types/performance'
import IOPSComparisonChart from './components/IOPSComparisonChart.vue'
import LatencyAnalysisChart from './components/LatencyAnalysisChart.vue'
import BandwidthTrendsChart from './components/BandwidthTrendsChart.vue'
import ResponsivenessChart from './components/ResponsivenessChart.vue'

interface Props {
  drives: DriveAnalysis[]
}

const props = defineProps<Props>()

const { actualTheme } = useTheme()
const activeChart = ref<'iops-comparison' | 'latency-analysis' | 'bandwidth-trends' | 'responsiveness'>('iops-comparison')

const chartTypes = [
  { id: 'iops-comparison', label: 'IOPS Comparison' },
  { id: 'latency-analysis', label: 'Latency Analysis' },
  { id: 'bandwidth-trends', label: 'Bandwidth Trends' },
  { id: 'responsiveness', label: 'Responsiveness' }
]

// Computed chart data
const chartData = computed(() => {
  if (!props.drives || props.drives.length === 0) {
    return {}
  }

  // Flatten all configurations from all drives
  const allConfigurations = props.drives.flatMap(drive =>
    drive.configurations.map(config => ({
      ...config,
      hostname: drive.hostname,
      drive_model: drive.drive_model,
      drive_type: drive.drive_type,
      protocol: drive.protocol
    }))
  )

  return {
    iopsData: transformForIOPSComparison(allConfigurations),
    latencyData: transformForLatencyAnalysis(allConfigurations),
    bandwidthData: transformForBandwidthTrends(allConfigurations),
    responsivenessData: transformForResponsiveness(allConfigurations)
  }
})

// Import transformation functions
import { transformForIOPSComparison, transformForLatencyAnalysis, transformForBandwidthTrends, transformForResponsiveness } from '@/utils/dataTransform'

// Watch for theme changes (for future enhancement)
watch(actualTheme, (newTheme) => {
  console.log('Theme changed to:', newTheme)
})
</script>

<style scoped>
.performance-graphs {
  @apply w-full;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-white;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-300;
}
</style>

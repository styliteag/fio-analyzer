<template>
  <div class="host-summary-cards">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Tests -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <FileText class="w-8 h-8 text-blue-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ totalTests }}</div>
            <div class="card-label">Total Tests</div>
          </div>
        </div>
      </div>

      <!-- Average IOPS -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <Zap class="w-8 h-8 text-yellow-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ formatNumber(avgIOPS) }}</div>
            <div class="card-label">Avg IOPS</div>
          </div>
        </div>
      </div>

      <!-- Average Latency -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <Clock class="w-8 h-8 text-orange-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ avgLatency.toFixed(2) }}</div>
            <div class="card-unit">ms</div>
            <div class="card-label">Avg Latency</div>
          </div>
        </div>
      </div>

      <!-- Average Bandwidth -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <TrendingUp class="w-8 h-8 text-green-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ formatNumber(avgBandwidth) }}</div>
            <div class="card-unit">MB/s</div>
            <div class="card-label">Avg Bandwidth</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Additional Metrics Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      <!-- Drive Types -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <HardDrive class="w-8 h-8 text-purple-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ driveTypeCount }}</div>
            <div class="card-label">Drive Types</div>
          </div>
        </div>
      </div>

      <!-- Test Patterns -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <BarChart3 class="w-8 h-8 text-indigo-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ patternCount }}</div>
            <div class="card-label">Test Patterns</div>
          </div>
        </div>
      </div>

      <!-- Queue Depths -->
      <div class="summary-card">
        <div class="card-content">
          <div class="card-icon">
            <Layers class="w-8 h-8 text-pink-600" />
          </div>
          <div class="card-info">
            <div class="card-value">{{ queueDepthCount }}</div>
            <div class="card-label">Queue Depths</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Zap, Clock, TrendingUp, HardDrive, BarChart3, Layers } from 'lucide-vue-next'
import type { PerformanceData } from '@/types'

interface Props {
  hostname: string
  performanceData: PerformanceData[]
}

defineProps<Props>()

// Computed properties
const totalTests = computed(() => performanceData.length)

const avgIOPS = computed(() => {
  if (performanceData.length === 0) return 0
  const sum = performanceData.reduce((acc, item) => acc + (item.iops || 0), 0)
  return sum / performanceData.length
})

const avgLatency = computed(() => {
  if (performanceData.length === 0) return 0
  const sum = performanceData.reduce((acc, item) => acc + (item.avg_latency || 0), 0)
  return sum / performanceData.length
})

const avgBandwidth = computed(() => {
  if (performanceData.length === 0) return 0
  const sum = performanceData.reduce((acc, item) => acc + (item.bandwidth || 0), 0)
  return sum / performanceData.length
})

const driveTypeCount = computed(() => {
  const types = new Set(performanceData.map(item => item.drive_type))
  return types.size
})

const patternCount = computed(() => {
  const patterns = new Set(performanceData.map(item => item.read_write_pattern))
  return patterns.size
})

const queueDepthCount = computed(() => {
  const depths = new Set(performanceData.map(item => item.queue_depth))
  return depths.size
})

// Utility functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toFixed(0)
}
</script>

<style scoped>
.host-summary-cards {
  @apply theme-transition;
}

.summary-card {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700;
  @apply shadow-sm hover:shadow-md transition-shadow duration-200;
  @apply theme-transition;
}

.card-content {
  @apply p-6 flex items-center space-x-4;
}

.card-icon {
  @apply flex-shrink-0;
}

.card-info {
  @apply flex-1 min-w-0;
}

.card-value {
  @apply text-3xl font-bold theme-text-primary;
}

.card-unit {
  @apply text-lg font-semibold theme-text-secondary ml-1;
}

.card-label {
  @apply text-sm theme-text-secondary mt-1;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-gray-100;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-400;
}

.theme-transition {
  @apply transition-colors duration-300 ease-in-out;
}
</style>

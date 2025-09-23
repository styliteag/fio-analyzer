<template>
  <div class="host-overview">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">{{ hostname }} - Performance Overview</h3>
        <p class="card-description">Comprehensive analysis of storage performance metrics</p>
      </div>

      <div class="card-content">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Performance Distribution -->
          <div class="overview-section">
            <h4 class="section-title">Performance Distribution</h4>
            <div class="metrics-grid">
              <div class="metric-item">
                <div class="metric-label">IOPS Range</div>
                <div class="metric-value">{{ formatNumber(iopsRange.min) }} - {{ formatNumber(iopsRange.max) }}</div>
              </div>
              <div class="metric-item">
                <div class="metric-label">Latency Range</div>
                <div class="metric-value">{{ latencyRange.min.toFixed(2) }} - {{ latencyRange.max.toFixed(2) }} ms</div>
              </div>
              <div class="metric-item">
                <div class="metric-label">Bandwidth Range</div>
                <div class="metric-value">{{ formatNumber(bandwidthRange.min) }} - {{ formatNumber(bandwidthRange.max) }} MB/s</div>
              </div>
            </div>
          </div>

          <!-- Test Coverage -->
          <div class="overview-section">
            <h4 class="section-title">Test Coverage</h4>
            <div class="coverage-grid">
              <div class="coverage-item">
                <div class="coverage-label">Drive Models</div>
                <div class="coverage-value">{{ uniqueDriveModels.length }}</div>
                <div class="coverage-list">
                  {{ uniqueDriveModels.slice(0, 3).join(', ') }}
                  <span v-if="uniqueDriveModels.length > 3"> +{{ uniqueDriveModels.length - 3 }} more</span>
                </div>
              </div>
              <div class="coverage-item">
                <div class="coverage-label">Block Sizes</div>
                <div class="coverage-value">{{ uniqueBlockSizes.length }}</div>
                <div class="coverage-list">
                  {{ uniqueBlockSizes.slice(0, 3).join(', ') }}
                  <span v-if="uniqueBlockSizes.length > 3"> +{{ uniqueBlockSizes.length - 3 }} more</span>
                </div>
              </div>
              <div class="coverage-item">
                <div class="coverage-label">Queue Depths</div>
                <div class="coverage-value">{{ uniqueQueueDepths.length }}</div>
                <div class="coverage-list">
                  {{ uniqueQueueDepths.slice(0, 3).join(', ') }}
                  <span v-if="uniqueQueueDepths.length > 3"> +{{ uniqueQueueDepths.length - 3 }} more</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Insights -->
        <div class="overview-section mt-8">
          <h4 class="section-title">Performance Insights</h4>
          <div class="insights-grid">
            <div class="insight-card">
              <div class="insight-icon">
                <TrendingUp class="w-5 h-5 text-green-600" />
              </div>
              <div class="insight-content">
                <div class="insight-title">Best Performance</div>
                <div class="insight-description">
                  Highest IOPS: {{ formatNumber(bestPerformance.iops) }} ({{ bestPerformance.drive_model }})
                </div>
              </div>
            </div>

            <div class="insight-card">
              <div class="insight-icon">
                <Clock class="w-5 h-5 text-orange-600" />
              </div>
              <div class="insight-content">
                <div class="insight-title">Lowest Latency</div>
                <div class="insight-description">
                  Fastest response: {{ bestPerformance.latency.toFixed(2) }}ms ({{ bestPerformance.drive_model }})
                </div>
              </div>
            </div>

            <div class="insight-card">
              <div class="insight-icon">
                <HardDrive class="w-5 h-5 text-blue-600" />
              </div>
              <div class="insight-content">
                <div class="insight-title">Highest Throughput</div>
                <div class="insight-description">
                  Max bandwidth: {{ formatNumber(bestPerformance.bandwidth) }} MB/s ({{ bestPerformance.drive_model }})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, Clock, HardDrive } from 'lucide-vue-next'
import type { PerformanceData } from '@/types'

interface Props {
  hostname: string
  performanceData: PerformanceData[]
}

defineProps<Props>()

// Computed properties for ranges
const iopsRange = computed(() => {
  if (performanceData.length === 0) return { min: 0, max: 0 }
  const iopsValues = performanceData.map(d => d.iops || 0).filter(v => v > 0)
  return {
    min: Math.min(...iopsValues),
    max: Math.max(...iopsValues)
  }
})

const latencyRange = computed(() => {
  if (performanceData.length === 0) return { min: 0, max: 0 }
  const latencyValues = performanceData.map(d => d.avg_latency || 0).filter(v => v > 0)
  return {
    min: Math.min(...latencyValues),
    max: Math.max(...latencyValues)
  }
})

const bandwidthRange = computed(() => {
  if (performanceData.length === 0) return { min: 0, max: 0 }
  const bandwidthValues = performanceData.map(d => d.bandwidth || 0).filter(v => v > 0)
  return {
    min: Math.min(...bandwidthValues),
    max: Math.max(...bandwidthValues)
  }
})

// Unique values
const uniqueDriveModels = computed(() => {
  return [...new Set(performanceData.map(d => d.drive_model))]
})

const uniqueBlockSizes = computed(() => {
  return [...new Set(performanceData.map(d => d.block_size))]
})

const uniqueQueueDepths = computed(() => {
  return [...new Set(performanceData.map(d => d.queue_depth))]
})

// Best performance metrics
const bestPerformance = computed(() => {
  const bestIOPS = performanceData.reduce((best, current) =>
    (current.iops || 0) > (best.iops || 0) ? current : best
  )

  const bestLatency = performanceData.reduce((best, current) =>
    (current.avg_latency || Infinity) < (best.avg_latency || Infinity) ? current : best
  )

  const bestBandwidth = performanceData.reduce((best, current) =>
    (current.bandwidth || 0) > (best.bandwidth || 0) ? current : best
  )

  return {
    iops: bestIOPS.iops || 0,
    latency: bestLatency.avg_latency || 0,
    bandwidth: bestBandwidth.bandwidth || 0,
    drive_model: bestIOPS.drive_model
  }
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
.host-overview {
  @apply theme-transition;
}

.card {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm;
  @apply theme-transition;
}

.card-header {
  @apply px-6 py-4 border-b border-gray-200 dark:border-gray-700;
}

.card-title {
  @apply text-lg font-semibold theme-text-primary;
}

.card-description {
  @apply text-sm theme-text-secondary mt-1;
}

.card-content {
  @apply p-6;
}

.overview-section {
  @apply space-y-4;
}

.section-title {
  @apply text-md font-semibold theme-text-primary;
}

.metrics-grid {
  @apply grid grid-cols-1 gap-4;
}

.metric-item {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4;
}

.metric-label {
  @apply text-sm font-medium theme-text-secondary;
}

.metric-value {
  @apply text-lg font-semibold theme-text-primary mt-1;
}

.coverage-grid {
  @apply grid grid-cols-1 gap-4;
}

.coverage-item {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4;
}

.coverage-label {
  @apply text-sm font-medium theme-text-secondary;
}

.coverage-value {
  @apply text-xl font-bold theme-text-primary;
}

.coverage-list {
  @apply text-xs theme-text-secondary mt-1;
}

.insights-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.insight-card {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex items-start space-x-3;
}

.insight-icon {
  @apply flex-shrink-0;
}

.insight-content {
  @apply flex-1 min-w-0;
}

.insight-title {
  @apply text-sm font-semibold theme-text-primary;
}

.insight-description {
  @apply text-xs theme-text-secondary mt-1;
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

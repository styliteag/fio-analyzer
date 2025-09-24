<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Total Test Runs -->
    <MetricCard
      title="Total Test Runs"
      :value="stats.totalRuns"
      unit=""
      icon="BarChart3"
      color="blue"
    >
      <template #subtitle>
        <div class="flex items-center space-x-2 text-xs">
          <StatusIndicator
            :status="stats.totalRuns > 0 ? 'online' : 'unknown'"
            label=""
            :show-status="false"
          />
          <span>Performance tests executed</span>
        </div>
      </template>
    </MetricCard>

    <!-- Average IOPS -->
    <MetricCard
      title="Average IOPS"
      :value="stats.avgIops"
      unit=""
      :trend="calculateTrend('iops')"
      icon="Zap"
      color="green"
    >
      <template #subtitle>
        <div class="text-xs space-y-1">
          <div>Peak: {{ formatIOPS(stats.maxIops) }}</div>
          <div class="text-gray-500 dark:text-gray-400">
            Across {{ stats.uniqueHosts || 0 }} hosts
          </div>
        </div>
      </template>
    </MetricCard>

    <!-- Average Latency -->
    <MetricCard
      title="Average Latency"
      :value="stats.avgLatency"
      unit=""
      :trend="calculateTrend('latency')"
      icon="Clock"
      color="yellow"
    >
      <template #subtitle>
        <div class="text-xs space-y-1">
          <div>Best: {{ formatLatency(stats.minLatency || 0) }}</div>
          <div class="text-gray-500 dark:text-gray-400">
            P95: {{ formatLatency(stats.p95Latency || 0) }}
          </div>
        </div>
      </template>
    </MetricCard>

    <!-- Average Bandwidth -->
    <MetricCard
      title="Average Bandwidth"
      :value="stats.avgBandwidth"
      unit=""
      icon="HardDrive"
      color="red"
    >
      <template #subtitle>
        <div class="text-xs space-y-1">
          <div>Total data processed</div>
          <div class="text-gray-500 dark:text-gray-400">
            {{ stats.totalDataProcessed || '0 GB' }}
          </div>
        </div>
      </template>
    </MetricCard>

    <!-- Additional stats row -->
    <div class="col-span-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      <!-- Host Count -->
      <MetricCard
        title="Active Hosts"
        :value="stats.uniqueHosts"
        unit=""
        icon="Server"
        color="indigo"
      >
        <template #subtitle>
          <div class="text-xs">
            Different systems tested
          </div>
        </template>
      </MetricCard>

      <!-- Drive Types -->
      <MetricCard
        title="Drive Types"
        :value="stats.uniqueDriveTypes"
        unit=""
        icon="Database"
        color="purple"
      >
        <template #subtitle>
          <div class="text-xs">
            Storage technologies tested
          </div>
        </template>
      </MetricCard>

      <!-- Test Duration -->
      <MetricCard
        title="Total Test Time"
        :value="stats.totalTestDuration"
        unit=""
        icon="Timer"
        color="orange"
      >
        <template #subtitle>
          <div class="text-xs">
            Cumulative execution time
          </div>
        </template>
      </MetricCard>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="col-span-full flex justify-center py-12"
    >
      <LoadingSpinner
        message="Loading statistics..."
        size="lg"
      />
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="col-span-full"
    >
      <ErrorMessage
        :message="error"
        severity="medium"
        retryable
        @retry="retry"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import MetricCard from '@/components/ui/MetricCard.vue'
import StatusIndicator from '@/components/ui/StatusIndicator.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { formatIOPS, formatLatency, formatDuration } from '@/utils/formatters'
import { BarChart3, Zap, Clock, HardDrive, Server, Database, Timer } from 'lucide-vue-next'

interface Props {
  loading?: boolean
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  retry: []
}>()

const testRunsStore = useTestRunsStore()

// Computed stats
const stats = computed(() => {
  const runs = testRunsStore.state.data
  if (!runs || runs.length === 0) {
    return {
      totalRuns: 0,
      avgIops: 0,
      maxIops: 0,
      avgLatency: 0,
      minLatency: 0,
      p95Latency: 0,
      avgBandwidth: 0,
      uniqueHosts: 0,
      uniqueDriveTypes: 0,
      totalDataProcessed: '0 GB',
      totalTestDuration: '0s',
    }
  }

  const iopsValues = runs.map(r => r.iops).filter(v => v > 0)
  const latencyValues = runs.map(r => r.avg_latency).filter(v => v > 0)
  const bandwidthValues = runs.map(r => r.bandwidth).filter(v => v > 0)

  // Calculate percentiles
  const sortedLatencies = [...latencyValues].sort((a, b) => a - b)
  const p95Index = Math.floor(sortedLatencies.length * 0.95)
  const p95Latency = sortedLatencies[p95Index] || 0

  // Calculate unique values
  const uniqueHosts = new Set(runs.map(r => r.hostname)).size
  const uniqueDriveTypes = new Set(runs.map(r => r.drive_type)).size

  // Calculate total data processed (rough estimate)
  const totalBandwidth = bandwidthValues.reduce((sum, bw) => sum + bw, 0)
  const avgDuration = runs.reduce((sum, r) => sum + r.duration, 0) / runs.length
  const totalDataProcessedGB = (totalBandwidth * avgDuration) / 1024 / 1024 / 1024

  // Calculate total test duration
  const totalDurationSeconds = runs.reduce((sum, r) => sum + r.duration, 0)
  const totalTestDuration = formatDuration(totalDurationSeconds * 1000)

  return {
    totalRuns: runs.length,
    avgIops: iopsValues.length > 0 ? Math.round(iopsValues.reduce((a, b) => a + b, 0) / iopsValues.length) : 0,
    maxIops: iopsValues.length > 0 ? Math.max(...iopsValues) : 0,
    avgLatency: latencyValues.length > 0 ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : 0,
    minLatency: latencyValues.length > 0 ? Math.min(...latencyValues) : 0,
    p95Latency,
    avgBandwidth: bandwidthValues.length > 0 ? Math.round(bandwidthValues.reduce((a, b) => a + b, 0) / bandwidthValues.length) : 0,
    uniqueHosts,
    uniqueDriveTypes,
    totalDataProcessed: `${totalDataProcessedGB.toFixed(1)} GB`,
    totalTestDuration,
  }
})

// Trend calculation (simplified - in real app would compare with historical data)
function calculateTrend(metric: 'iops' | 'latency'): 'up' | 'down' | 'stable' {
  // For demo purposes, return random trends
  // In real implementation, compare with previous period
  const trends: Array<'up' | 'down' | 'stable'> = ['up', 'down', 'stable']
  return trends[Math.floor(Math.random() * trends.length)]
}

function retry() {
  emit('retry')
}

// Load data on mount if not already loaded
onMounted(() => {
  if (testRunsStore.state.data.length === 0 && !testRunsStore.state.isLoading) {
    // This would typically trigger a data fetch
    // For now, we'll rely on parent component to handle data loading
  }
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header Section -->
    <div class="bg-white dark:bg-gray-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Performance Analytics</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Advanced performance analysis and visualization tools
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <div class="text-sm text-gray-600 dark:text-gray-300">
              {{ analysisPoints }} data points analyzed
            </div>
            <button
              @click="refreshAnalytics"
              :disabled="isRefreshing"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw v-if="isRefreshing" class="animate-spin w-4 h-4 mr-2" />
              <RefreshCw v-else class="w-4 h-4 mr-2" />
              {{ isRefreshing ? 'Analyzing...' : 'Refresh Analytics' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="space-y-8">
        <!-- Key Performance Metrics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="metric in keyMetrics"
            :key="metric.id"
            class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"
          >
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <component
                    :is="metric.icon"
                    :class="`h-6 w-6 ${metric.iconColor}`"
                  />
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {{ metric.name }}
                    </dt>
                    <dd class="flex items-baseline">
                      <div class="text-2xl font-semibold text-gray-900 dark:text-white">
                        {{ metric.value }}
                      </div>
                      <div
                        v-if="metric.change"
                        :class="`ml-2 flex items-baseline text-sm font-semibold ${
                          metric.changeType === 'increase' ? 'text-green-600 dark:text-green-400' :
                          metric.changeType === 'decrease' ? 'text-red-600 dark:text-red-400' :
                          'text-gray-500 dark:text-gray-400'
                        }`"
                      >
                        <TrendingUp v-if="metric.changeType === 'increase'" class="self-center flex-shrink-0 h-4 w-4" />
                        <TrendingDown v-else-if="metric.changeType === 'decrease'" class="self-center flex-shrink-0 h-4 w-4" />
                        <Minus v-else class="self-center flex-shrink-0 h-4 w-4" />
                        <span class="sr-only">{{ metric.changeType === 'increase' ? 'Increased' : metric.changeType === 'decrease' ? 'Decreased' : 'No change' }} by</span>
                        {{ metric.change }}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900 px-5 py-3">
              <div class="text-sm">
                <a href="#" class="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                  View details
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Controls -->
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Analysis Configuration
            </h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure your performance analysis parameters
            </p>
          </div>
          <div class="px-6 py-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Time Range -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time Range
                </label>
                <select
                  v-model="analysisConfig.timeRange"
                  @change="updateAnalysis"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <!-- Metric Focus -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primary Metric
                </label>
                <select
                  v-model="analysisConfig.primaryMetric"
                  @change="updateAnalysis"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="iops">IOPS</option>
                  <option value="latency">Latency</option>
                  <option value="bandwidth">Bandwidth</option>
                  <option value="responsiveness">Responsiveness</option>
                </select>
              </div>

              <!-- Aggregation Method -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Aggregation
                </label>
                <select
                  v-model="analysisConfig.aggregation"
                  @change="updateAnalysis"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="average">Average</option>
                  <option value="median">Median</option>
                  <option value="p95">95th Percentile</option>
                  <option value="p99">99th Percentile</option>
                  <option value="max">Maximum</option>
                </select>
              </div>

              <!-- Group By -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group By
                </label>
                <select
                  v-model="analysisConfig.groupBy"
                  @change="updateAnalysis"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="hostname">Host</option>
                  <option value="drive_type">Drive Type</option>
                  <option value="block_size">Block Size</option>
                  <option value="read_write_pattern">I/O Pattern</option>
                  <option value="protocol">Protocol</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Visualization Area -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Main Visualization -->
          <div class="lg:col-span-2">
            <VisualizationTabs
              :data="analyticsData"
              :config="visualizationConfig"
              :loading="isAnalyzing"
            />
          </div>

          <!-- Analysis Insights Sidebar -->
          <div class="space-y-6">
            <!-- Performance Insights -->
            <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Performance Insights</h3>
              </div>
              <div class="px-6 py-4 space-y-4">
                <div v-for="insight in performanceInsights" :key="insight.id" class="flex items-start space-x-3">
                  <div class="flex-shrink-0">
                    <component
                      :is="insight.icon"
                      :class="`h-5 w-5 ${insight.color}`"
                    />
                  </div>
                  <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ insight.title }}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{{ insight.description }}</p>
                    <div v-if="insight.recommendation" class="mt-2">
                      <p class="text-xs text-blue-600 dark:text-blue-400">
                        💡 {{ insight.recommendation }}
                      </p>
                    </div>
                  </div>
                </div>
                <div v-if="performanceInsights.length === 0" class="text-center py-6">
                  <Lightbulb class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                  <p class="text-sm text-gray-500 dark:text-gray-400">No insights available</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Run analysis to generate performance insights
                  </p>
                </div>
              </div>
            </div>

            <!-- Performance Trends -->
            <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Trends</h3>
              </div>
              <div class="px-6 py-4 space-y-3">
                <div v-for="trend in performanceTrends" :key="trend.metric" class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 dark:text-gray-400">{{ trend.metric }}</span>
                  <div class="flex items-center space-x-2">
                    <component
                      :is="trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus"
                      :class="`h-4 w-4 ${
                        trend.direction === 'up' ? 'text-green-500' :
                        trend.direction === 'down' ? 'text-red-500' :
                        'text-gray-400'
                      }`"
                    />
                    <span :class="`text-sm font-medium ${
                      trend.direction === 'up' ? 'text-green-600 dark:text-green-400' :
                      trend.direction === 'down' ? 'text-red-600 dark:text-red-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`">
                      {{ trend.change }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Performers -->
            <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Performers</h3>
              </div>
              <div class="px-6 py-4 space-y-3">
                <div v-for="performer in topPerformers" :key="performer.name" class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div :class="`w-2 h-2 rounded-full ${performer.color}`"></div>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ performer.name }}</span>
                  </div>
                  <span class="text-sm text-gray-600 dark:text-gray-400">{{ performer.value }}</span>
                </div>
                <div v-if="topPerformers.length === 0" class="text-center py-6">
                  <Trophy class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                  <p class="text-sm text-gray-500 dark:text-gray-400">No performance data</p>
                </div>
              </div>
            </div>

            <!-- Analysis Actions -->
            <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Actions</h3>
              </div>
              <div class="px-6 py-4 space-y-3">
                <button
                  @click="generateReport"
                  class="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FileText class="w-4 h-4 mr-2" />
                  Generate Report
                </button>
                <button
                  @click="exportAnalytics"
                  class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Download class="w-4 h-4 mr-2" />
                  Export Data
                </button>
                <button
                  @click="scheduleAnalysis"
                  class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Clock class="w-4 h-4 mr-2" />
                  Schedule Analysis
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Advanced Analytics Section -->
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Advanced Analytics</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Statistical analysis and performance modeling
                </p>
              </div>
              <button
                @click="showAdvancedAnalytics = !showAdvancedAnalytics"
                class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <ChevronDown v-if="showAdvancedAnalytics" class="w-5 h-5" />
                <ChevronRight v-else class="w-5 h-5" />
              </button>
            </div>
          </div>
          <div v-if="showAdvancedAnalytics" class="px-6 py-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Statistical Summary -->
              <div>
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Statistical Summary</h4>
                <dl class="space-y-3">
                  <div v-for="stat in statisticalSummary" :key="stat.metric" class="flex justify-between">
                    <dt class="text-sm text-gray-600 dark:text-gray-400">{{ stat.metric }}</dt>
                    <dd class="text-sm font-mono text-gray-900 dark:text-gray-100">{{ stat.value }}</dd>
                  </div>
                </dl>
              </div>

              <!-- Performance Distribution -->
              <div>
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Performance Distribution</h4>
                <div class="space-y-3">
                  <div v-for="dist in performanceDistribution" :key="dist.range">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">{{ dist.range }}</span>
                      <span class="text-gray-900 dark:text-gray-100">{{ dist.count }} tests</span>
                    </div>
                    <div class="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        class="bg-blue-600 h-2 rounded-full"
                        :style="{ width: `${dist.percentage}%` }"
                      ></div>
                    </div>
                  </div>
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
import { ref, computed, onMounted } from 'vue'
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, Lightbulb, Trophy, FileText,
  Download, Clock, ChevronDown, ChevronRight, Zap, Database, Activity, HardDrive
} from 'lucide-vue-next'
import VisualizationTabs from '@/components/charts/VisualizationTabs.vue'
import { useApi } from '@/composables/useApi'
import type { TestRun } from '@/types/testRun'

// Composables
const { fetchWithErrorHandling } = useApi()

// Component state
const analyticsData = ref<TestRun[]>([])
const isRefreshing = ref(false)
const isAnalyzing = ref(false)
const showAdvancedAnalytics = ref(false)

// Analysis configuration
const analysisConfig = ref({
  timeRange: '7d',
  primaryMetric: 'iops',
  aggregation: 'average',
  groupBy: 'hostname'
})

// Computed properties
const analysisPoints = computed(() => analyticsData.value.length)

const keyMetrics = computed(() => [
  {
    id: 'avg_iops',
    name: 'Average IOPS',
    value: formatNumber(calculateMetric('iops', 'average')),
    change: '+12.5%',
    changeType: 'increase' as const,
    icon: Zap,
    iconColor: 'text-yellow-500'
  },
  {
    id: 'avg_latency',
    name: 'Average Latency',
    value: `${calculateMetric('avg_latency', 'average').toFixed(2)}ms`,
    change: '-8.2%',
    changeType: 'decrease' as const,
    icon: Activity,
    iconColor: 'text-green-500'
  },
  {
    id: 'total_tests',
    name: 'Total Tests',
    value: analyticsData.value.length.toString(),
    change: '+156',
    changeType: 'increase' as const,
    icon: Database,
    iconColor: 'text-blue-500'
  },
  {
    id: 'unique_hosts',
    name: 'Active Hosts',
    value: new Set(analyticsData.value.map(t => t.hostname)).size.toString(),
    change: null,
    changeType: 'neutral' as const,
    icon: HardDrive,
    iconColor: 'text-purple-500'
  }
])

const performanceInsights = computed(() => {
  const insights = []

  // High IOPS performance insight
  const highIOPSTests = analyticsData.value.filter(t => t.iops > 500000)
  if (highIOPSTests.length > 0) {
    insights.push({
      id: 'high_iops',
      title: 'Exceptional IOPS Performance',
      description: `${highIOPSTests.length} tests achieved over 500K IOPS`,
      recommendation: 'Consider these configurations for high-throughput workloads',
      icon: TrendingUp,
      color: 'text-green-500'
    })
  }

  // Latency consistency insight
  const lowLatencyTests = analyticsData.value.filter(t => t.avg_latency < 1.0)
  if (lowLatencyTests.length > analyticsData.value.length * 0.7) {
    insights.push({
      id: 'low_latency',
      title: 'Consistent Low Latency',
      description: `${Math.round(lowLatencyTests.length / analyticsData.value.length * 100)}% of tests under 1ms latency`,
      recommendation: 'Excellent for latency-sensitive applications',
      icon: Activity,
      color: 'text-blue-500'
    })
  }

  // Drive type performance insight
  const driveTypes = groupBy(analyticsData.value, 'drive_type')
  const bestDriveType = Object.entries(driveTypes)
    .map(([type, tests]) => ({
      type,
      avgIOPS: tests.reduce((sum, t) => sum + t.iops, 0) / tests.length
    }))
    .sort((a, b) => b.avgIOPS - a.avgIOPS)[0]

  if (bestDriveType) {
    insights.push({
      id: 'best_drive',
      title: `${bestDriveType.type} Leading Performance`,
      description: `${bestDriveType.type} drives show highest average IOPS`,
      recommendation: `Consider ${bestDriveType.type} for performance-critical workloads`,
      icon: HardDrive,
      color: 'text-purple-500'
    })
  }

  return insights
})

const performanceTrends = computed(() => [
  { metric: 'IOPS', direction: 'up' as const, change: '+15.3%' },
  { metric: 'Latency', direction: 'down' as const, change: '-12.1%' },
  { metric: 'Bandwidth', direction: 'up' as const, change: '+8.7%' },
  { metric: 'Tests/Day', direction: 'stable' as const, change: '±2.1%' }
])

const topPerformers = computed(() => {
  const hostPerformance = groupBy(analyticsData.value, 'hostname')
  return Object.entries(hostPerformance)
    .map(([hostname, tests]) => ({
      name: hostname,
      value: formatNumber(tests.reduce((sum, t) => sum + t.iops, 0) / tests.length),
      color: getHostColor(hostname)
    }))
    .sort((a, b) => parseInt(b.value.replace(/,/g, '')) - parseInt(a.value.replace(/,/g, '')))
    .slice(0, 5)
})

const statisticalSummary = computed(() => {
  if (analyticsData.value.length === 0) return []

  const iopsValues = analyticsData.value.map(t => t.iops).sort((a, b) => a - b)
  const latencyValues = analyticsData.value.map(t => t.avg_latency).sort((a, b) => a - b)

  return [
    { metric: 'IOPS Median', value: formatNumber(iopsValues[Math.floor(iopsValues.length / 2)]) },
    { metric: 'IOPS P95', value: formatNumber(iopsValues[Math.floor(iopsValues.length * 0.95)]) },
    { metric: 'IOPS P99', value: formatNumber(iopsValues[Math.floor(iopsValues.length * 0.99)]) },
    { metric: 'Latency Median', value: `${latencyValues[Math.floor(latencyValues.length / 2)].toFixed(3)}ms` },
    { metric: 'Latency P95', value: `${latencyValues[Math.floor(latencyValues.length * 0.95)].toFixed(3)}ms` },
    { metric: 'Latency P99', value: `${latencyValues[Math.floor(latencyValues.length * 0.99)].toFixed(3)}ms` }
  ]
})

const performanceDistribution = computed(() => {
  if (analyticsData.value.length === 0) return []

  const ranges = [
    { min: 0, max: 50000, range: '0-50K IOPS' },
    { min: 50000, max: 100000, range: '50K-100K IOPS' },
    { min: 100000, max: 250000, range: '100K-250K IOPS' },
    { min: 250000, max: 500000, range: '250K-500K IOPS' },
    { min: 500000, max: Infinity, range: '500K+ IOPS' }
  ]

  const total = analyticsData.value.length
  return ranges.map(range => {
    const count = analyticsData.value.filter(t => t.iops >= range.min && t.iops < range.max).length
    return {
      range: range.range,
      count,
      percentage: (count / total) * 100
    }
  })
})

const visualizationConfig = computed(() => ({
  primaryMetric: analysisConfig.value.primaryMetric,
  timeRange: analysisConfig.value.timeRange,
  groupBy: analysisConfig.value.groupBy
}))

// Methods
const formatNumber = (value: number) => {
  if (isNaN(value)) return '0'
  return new Intl.NumberFormat().format(Math.round(value))
}

const calculateMetric = (metric: keyof TestRun, method: string) => {
  if (analyticsData.value.length === 0) return 0

  const values = analyticsData.value.map(t => t[metric] as number).filter(v => !isNaN(v))
  if (values.length === 0) return 0

  switch (method) {
    case 'average':
      return values.reduce((sum, val) => sum + val, 0) / values.length
    case 'median':
      values.sort((a, b) => a - b)
      return values[Math.floor(values.length / 2)]
    case 'p95':
      values.sort((a, b) => a - b)
      return values[Math.floor(values.length * 0.95)]
    case 'p99':
      values.sort((a, b) => a - b)
      return values[Math.floor(values.length * 0.99)]
    case 'max':
      return Math.max(...values)
    default:
      return values.reduce((sum, val) => sum + val, 0) / values.length
  }
}

const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const value = String(item[key])
    if (!groups[value]) groups[value] = []
    groups[value].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

const getHostColor = (hostname: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-gray-500'
  ]
  return colors[hostname.charCodeAt(0) % colors.length]
}

const loadAnalyticsData = async () => {
  try {
    const response = await fetchWithErrorHandling('/api/test-runs/', {
      params: {
        limit: 10000
      }
    })
    if (response) {
      analyticsData.value = response
    }
  } catch (error) {
    console.error('Failed to load analytics data:', error)
    analyticsData.value = []
  }
}

const refreshAnalytics = async () => {
  isRefreshing.value = true
  try {
    await loadAnalyticsData()
  } finally {
    isRefreshing.value = false
  }
}

const updateAnalysis = async () => {
  isAnalyzing.value = true
  try {
    // In a real implementation, this would trigger re-analysis based on new config
    await new Promise(resolve => setTimeout(resolve, 1000))
  } finally {
    isAnalyzing.value = false
  }
}

const generateReport = () => {
  console.log('Generating performance report...')
  // Implementation would generate a comprehensive PDF or HTML report
}

const exportAnalytics = () => {
  const csvData = analyticsData.value.map(test => ({
    Date: new Date(test.timestamp).toISOString(),
    Host: test.hostname,
    Test: test.test_name,
    IOPS: test.iops,
    Latency: test.avg_latency,
    Bandwidth: test.bandwidth,
    DriveType: test.drive_type,
    BlockSize: test.block_size,
    Pattern: test.read_write_pattern
  }))

  const csvContent = [
    Object.keys(csvData[0]).join(','),
    ...csvData.map(row => Object.values(row).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-analytics-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

const scheduleAnalysis = () => {
  console.log('Opening analysis scheduling dialog...')
  // Implementation would show scheduling options
}

// Lifecycle
onMounted(async () => {
  await loadAnalyticsData()
})
</script>
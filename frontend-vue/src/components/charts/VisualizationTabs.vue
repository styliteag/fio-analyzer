<template>
  <div class="space-y-6">
    <!-- Tab navigation -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="activeTab === tab.id
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'"
        >
          <component :is="tab.icon" class="w-4 h-4 inline mr-2" />
          {{ tab.name }}
        </button>
      </nav>
    </div>

    <!-- Tab content -->
    <div class="min-h-[600px]">
      <!-- Performance Heatmap Tab -->
      <div v-if="activeTab === 'heatmap'">
        <PerformanceHeatmap
          :data="chartData"
          title="Performance Heatmap"
          subtitle="IOPS performance across different configurations"
        />
      </div>

      <!-- Performance Graphs Tab -->
      <div v-if="activeTab === 'graphs'">
        <PerformanceGraphs
          :data="chartData"
          title="Performance Analysis"
          subtitle="Interactive charts for performance metrics"
        />
      </div>

      <!-- Scatter Plot Tab -->
      <div v-if="activeTab === 'scatter'">
        <ScatterPlot
          :data="chartData"
          :show-trend-line="true"
          :show-legend="true"
          title="Performance Scatter Plot"
          subtitle="IOPS vs Latency analysis with performance zones"
        />
      </div>

      <!-- Radar Chart Tab -->
      <div v-if="activeTab === 'radar'">
        <RadarChart
          :data="chartData"
          title="Host Comparison Radar"
          subtitle="Multi-dimensional performance comparison across hosts"
        />
      </div>
    </div>

    <!-- Export and settings -->
    <div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center space-x-4">
        <button
          @click="exportCurrentTab"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          <DownloadIcon class="w-4 h-4 mr-2" />
          Export {{ activeTabName }}
        </button>

        <button
          @click="toggleFullscreen"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          <MaximizeIcon class="w-4 h-4 mr-2" />
          Fullscreen
        </button>
      </div>

      <div class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
        <span>{{ filteredDataCount }} data points</span>
        <span>•</span>
        <span>{{ uniqueHostsCount }} hosts</span>
        <span>•</span>
        <span>{{ uniqueConfigurationsCount }} configurations</span>
      </div>
    </div>

    <!-- Keyboard shortcuts hint -->
    <div class="text-xs text-gray-400 dark:text-gray-500 text-center">
      Use number keys (1-4) to quickly switch between tabs
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PerformanceHeatmap from './PerformanceHeatmap.vue'
import PerformanceGraphs from './PerformanceGraphs.vue'
import ScatterPlot from './ScatterPlot.vue'
import RadarChart from './RadarChart.vue'
import {
  BarChart3,
  TrendingUp,
  ScatterChart,
  Radar,
  Download,
  Maximize
} from 'lucide-vue-next'

interface Tab {
  id: string
  name: string
  icon: any
  description: string
}

const props = defineProps<{
  data?: any[]
  initialTab?: string
}>()

const activeTab = ref(props.initialTab || 'heatmap')

const tabs: Tab[] = [
  {
    id: 'heatmap',
    name: 'Heatmap',
    icon: BarChart3,
    description: 'Performance heatmap visualization',
  },
  {
    id: 'graphs',
    name: 'Graphs',
    icon: TrendingUp,
    description: 'Interactive performance graphs',
  },
  {
    id: 'scatter',
    name: 'Scatter Plot',
    icon: ScatterChart,
    description: 'IOPS vs Latency scatter analysis',
  },
  {
    id: 'radar',
    name: 'Radar',
    icon: Radar,
    description: 'Multi-host performance comparison',
  },
]

const chartData = computed(() => props.data || [])

// Computed properties for statistics
const filteredDataCount = computed(() => {
  return chartData.value.length
})

const uniqueHostsCount = computed(() => {
  return new Set(chartData.value.map(d => d.hostname)).size
})

const uniqueConfigurationsCount = computed(() => {
  const configs = new Set(
    chartData.value.map(d => `${d.block_size}-${d.read_write_pattern}-${d.queue_depth}`)
  )
  return configs.size
})

const activeTabName = computed(() => {
  const tab = tabs.find(t => t.id === activeTab.value)
  return tab?.name || 'Chart'
})

// Methods
function exportCurrentTab() {
  // In a real implementation, this would trigger export for the current tab
  console.log(`Exporting ${activeTabName.value}...`)

  // Simulate export
  const data = {
    tab: activeTab.value,
    data: chartData.value,
    timestamp: new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fio-performance-${activeTab.value}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toggleFullscreen() {
  // In a real implementation, this would toggle fullscreen mode
  console.log('Toggling fullscreen...')
}

function handleKeyboardShortcut(event: KeyboardEvent) {
  // Handle number key shortcuts for tab switching
  if (event.key >= '1' && event.key <= '4') {
    const tabIndex = parseInt(event.key) - 1
    if (tabs[tabIndex]) {
      activeTab.value = tabs[tabIndex].id
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyboardShortcut)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboardShortcut)
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

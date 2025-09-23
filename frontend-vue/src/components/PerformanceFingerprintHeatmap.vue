<template>
  <div class="performance-heatmap">
    <!-- Header -->
    <div class="mb-6">
      <h4 class="text-xl font-bold theme-text-primary mb-2">
        Performance Fingerprint Heatmap
      </h4>
      <p class="text-sm theme-text-secondary mb-4">
        Multi-dimensional performance visualization showing IOPS, bandwidth, and responsiveness patterns across {{ heatmapData.data.length }} configurations.
      </p>
    </div>

    <!-- Controls -->
    <div class="controls mb-6 flex flex-wrap gap-4">
      <!-- Metric Selection -->
      <div class="metric-selector">
        <label class="block text-sm font-medium mb-2 theme-text-primary">Primary Metric</label>
        <select
          v-model="selectedMetric"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          @change="updateHeatmap"
        >
          <option value="iops">IOPS</option>
          <option value="bandwidth">Bandwidth</option>
          <option value="responsiveness">Responsiveness</option>
        </select>
      </div>

      <!-- Color Scale -->
      <div class="color-scale-selector">
        <label class="block text-sm font-medium mb-2 theme-text-primary">Color Scale</label>
        <select
          v-model="colorScale"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          @change="updateHeatmap"
        >
          <option value="linear">Linear</option>
          <option value="logarithmic">Logarithmic</option>
        </select>
      </div>

      <!-- Show Values Toggle -->
      <div class="values-toggle flex items-center">
        <input
          id="show-values"
          v-model="showValues"
          type="checkbox"
          class="mr-2"
          @change="updateHeatmap"
        >
        <label for="show-values" class="text-sm font-medium theme-text-primary">Show Values</label>
      </div>
    </div>

    <!-- Heatmap Container -->
    <div class="heatmap-container overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div class="heatmap-grid" :style="{ width: gridWidth + 'px' }">
        <!-- Header Row (Block Sizes) -->
        <div class="grid-header flex">
          <div class="corner-cell w-32 h-8"></div>
          <div
            v-for="blockSize in heatmapData.blockSizes"
            :key="'header-' + blockSize"
            class="header-cell w-16 h-8 text-xs font-medium text-center theme-text-primary border-l border-gray-200 dark:border-gray-600 flex items-center justify-center"
          >
            {{ blockSize }}
          </div>
        </div>

        <!-- Data Rows (Patterns x Block Sizes) -->
        <div
          v-for="pattern in heatmapData.patterns"
          :key="'row-' + pattern"
          class="grid-row flex"
        >
          <!-- Row Label -->
          <div class="row-label w-32 h-16 text-xs font-medium theme-text-primary border-t border-gray-200 dark:border-gray-600 flex items-center justify-center px-2 text-center">
            {{ pattern.replace('_', ' ').toUpperCase() }}
          </div>

          <!-- Data Cells -->
          <div
            v-for="blockSize in heatmapData.blockSizes"
            :key="'cell-' + pattern + '-' + blockSize"
            class="data-cell w-16 h-16 border border-gray-200 dark:border-gray-600 relative cursor-pointer hover:opacity-80 transition-opacity"
            :class="getCellClasses(pattern, blockSize)"
            @mouseenter="showTooltip($event, pattern, blockSize)"
            @mouseleave="hideTooltip"
          >
            <!-- Value Display -->
            <div
              v-if="showValues"
              class="absolute inset-0 flex items-center justify-center text-xs font-medium"
              :class="getValueTextClass(pattern, blockSize)"
            >
              {{ getCellDisplayValue(pattern, blockSize) }}
            </div>

            <!-- Hover Indicator -->
            <div
              v-if="hoveredCell && hoveredCell.pattern === pattern && hoveredCell.blockSize === blockSize"
              class="absolute inset-0 border-2 border-blue-500 rounded-sm"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="legend mt-6 flex items-center justify-center">
      <div class="flex items-center space-x-2 text-sm">
        <span class="theme-text-secondary">Low</span>
        <div class="legend-gradient w-32 h-4 rounded"></div>
        <span class="theme-text-secondary">High</span>
      </div>
    </div>

    <!-- Statistics -->
    <div class="stats mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ heatmapData.data.length }}</div>
        <div class="text-xs theme-text-secondary">Total Configurations</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ heatmapData.blockSizes.length }}</div>
        <div class="text-xs theme-text-secondary">Block Sizes</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ heatmapData.patterns.length }}</div>
        <div class="text-xs theme-text-secondary">IO Patterns</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ maxValue.toFixed(1) }}</div>
        <div class="text-xs theme-text-secondary">Max {{ selectedMetric.toUpperCase() }}</div>
      </div>
    </div>

    <!-- Tooltip -->
    <div
      v-if="tooltip.visible"
      class="tooltip fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg pointer-events-none"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="font-medium">{{ tooltip.pattern.replace('_', ' ').toUpperCase() }} - {{ tooltip.blockSize }}</div>
      <div class="text-xs mt-1">
        <div>IOPS: {{ tooltip.iops !== null ? tooltip.iops.toLocaleString() : 'N/A' }}</div>
        <div>Bandwidth: {{ tooltip.bandwidth !== null ? tooltip.bandwidth.toFixed(1) + ' MB/s' : 'N/A' }}</div>
        <div>Responsiveness: {{ tooltip.responsiveness !== null ? tooltip.responsiveness.toFixed(2) + ' ops/ms' : 'N/A' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTheme } from '@/contexts/ThemeContext'
import { createHeatmapData } from '@/utils/chartProcessing'
import type { PerformanceData } from '@/types/performance'
import type { FilterState } from '@/types/filters'

interface Props {
  performanceData: PerformanceData[]
  filters: FilterState
}

const props = defineProps<Props>()

const { actualTheme } = useTheme()

// State
const selectedMetric = ref<'iops' | 'bandwidth' | 'responsiveness'>('iops')
const colorScale = ref<'linear' | 'logarithmic'>('linear')
const showValues = ref(false)
const hoveredCell = ref<{ pattern: string; blockSize: string } | null>(null)
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  pattern: '',
  blockSize: '',
  iops: null as number | null,
  bandwidth: null as number | null,
  responsiveness: null as number | null
})

// Computed
const heatmapData = computed(() => {
  return createHeatmapData(props.performanceData)
})

const gridWidth = computed(() => {
  return 128 + (heatmapData.value.blockSizes.length * 64) // 128px for labels, 64px per cell
})

const maxValue = computed(() => {
  if (!heatmapData.value.data.length) return 0

  const values = heatmapData.value.data.map(item => {
    switch (selectedMetric.value) {
      case 'iops': return item.iops
      case 'bandwidth': return item.bandwidth
      case 'responsiveness': return item.responsiveness
      default: return null
    }
  }).filter(v => v !== null) as number[]

  return values.length > 0 ? Math.max(...values) : 0
})

// Methods
const getCellClasses = (pattern: string, blockSize: string) => {
  const cellData = heatmapData.value.data.find(
    d => d.pattern === pattern && d.blockSize === blockSize
  )

  if (!cellData) return 'bg-gray-100 dark:bg-gray-700'

  let value: number | null = null
  let normalizedValue = 0

  switch (selectedMetric.value) {
    case 'iops':
      value = cellData.iops
      normalizedValue = cellData.normalizedIops
      break
    case 'bandwidth':
      value = cellData.bandwidth
      normalizedValue = cellData.normalizedBandwidth
      break
    case 'responsiveness':
      value = cellData.responsiveness
      normalizedValue = cellData.normalizedResponsiveness
      break
  }

  if (value === null) return 'bg-gray-100 dark:bg-gray-700'

  // Apply color scale transformation
  let intensity = normalizedValue
  if (colorScale.value === 'logarithmic' && value > 0) {
    intensity = Math.log10(value + 1) / Math.log10(maxValue.value + 1)
  }

  // Convert to color classes (0-10 scale)
  const colorIndex = Math.round(intensity * 10)
  return getColorClass(colorIndex)
}

const getColorClass = (intensity: number) => {
  const isDark = actualTheme.value === 'dark'

  // Color scale from light to dark
  const colors = [
    isDark ? 'bg-blue-900' : 'bg-blue-50',
    isDark ? 'bg-blue-800' : 'bg-blue-100',
    isDark ? 'bg-blue-700' : 'bg-blue-200',
    isDark ? 'bg-blue-600' : 'bg-blue-300',
    isDark ? 'bg-blue-500' : 'bg-blue-400',
    isDark ? 'bg-blue-400' : 'bg-blue-500',
    isDark ? 'bg-blue-300' : 'bg-blue-600',
    isDark ? 'bg-blue-200' : 'bg-blue-700',
    isDark ? 'bg-blue-100' : 'bg-blue-800',
    isDark ? 'bg-blue-50' : 'bg-blue-900'
  ]

  return colors[Math.min(intensity, colors.length - 1)]
}

const getValueTextClass = (pattern: string, blockSize: string) => {
  const cellData = heatmapData.value.data.find(
    d => d.pattern === pattern && d.blockSize === blockSize
  )

  if (!cellData) return 'text-gray-400'

  let value: number | null = null
  switch (selectedMetric.value) {
    case 'iops': value = cellData.iops; break
    case 'bandwidth': value = cellData.bandwidth; break
    case 'responsiveness': value = cellData.responsiveness; break
  }

  if (value === null) return 'text-gray-400'

  // Use white text on dark backgrounds
  const normalizedValue = (() => {
    switch (selectedMetric.value) {
      case 'iops': return cellData.normalizedIops
      case 'bandwidth': return cellData.normalizedBandwidth
      case 'responsiveness': return cellData.normalizedResponsiveness
      default: return 0
    }
  })()

  return normalizedValue > 0.5 ? 'text-white' : 'text-gray-900'
}

const getCellDisplayValue = (pattern: string, blockSize: string) => {
  const cellData = heatmapData.value.data.find(
    d => d.pattern === pattern && d.blockSize === blockSize
  )

  if (!cellData) return 'N/A'

  let value: number | null = null
  switch (selectedMetric.value) {
    case 'iops': value = cellData.iops; break
    case 'bandwidth': value = cellData.bandwidth; break
    case 'responsiveness': value = cellData.responsiveness; break
  }

  if (value === null) return 'N/A'

  if (selectedMetric.value === 'iops') {
    return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)
  } else if (selectedMetric.value === 'bandwidth') {
    return value.toFixed(1)
  } else {
    return value.toFixed(2)
  }
}

const showTooltip = (event: MouseEvent, pattern: string, blockSize: string) => {
  const cellData = heatmapData.value.data.find(
    d => d.pattern === pattern && d.blockSize === blockSize
  )

  if (!cellData) return

  hoveredCell.value = { pattern, blockSize }
  tooltip.value = {
    visible: true,
    x: event.pageX + 10,
    y: event.pageY - 10,
    pattern,
    blockSize,
    iops: cellData.iops,
    bandwidth: cellData.bandwidth,
    responsiveness: cellData.responsiveness
  }
}

const hideTooltip = () => {
  hoveredCell.value = null
  tooltip.value.visible = false
}

const updateHeatmap = () => {
  // Force reactivity update
  const temp = selectedMetric.value
  selectedMetric.value = temp
}

// Watchers
watch(actualTheme, () => {
  updateHeatmap()
})

onMounted(() => {
  updateHeatmap()
})
</script>

<style scoped>
.performance-heatmap {
  @apply w-full;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-white;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-300;
}

.stat-card {
  @apply bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center;
}

.legend-gradient {
  background: linear-gradient(to right,
    rgb(239 246 255) 0%,
    rgb(59 130 246) 100%
  );
}

.dark .legend-gradient {
  background: linear-gradient(to right,
    rgb(30 58 138) 0%,
    rgb(239 246 255) 100%
  );
}

.tooltip {
  max-width: 250px;
  white-space: nowrap;
}
</style>

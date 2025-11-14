<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">{{ title }}</h3>

      <!-- Dimension selectors -->
      <div class="flex gap-4 text-sm">
        <select v-model="rowDimension" class="input-field py-1">
          <option value="block_size">Block Size (rows)</option>
          <option value="queue_depth">Queue Depth (rows)</option>
          <option value="protocol">Protocol (rows)</option>
        </select>

        <select v-model="colDimension" class="input-field py-1">
          <option value="read_write_pattern">I/O Pattern (cols)</option>
          <option value="drive_type">Drive Type (cols)</option>
          <option value="protocol">Protocol (cols)</option>
        </select>
      </div>
    </div>

    <!-- Matrix display -->
    <HeatmapChart
      :heatmap-data="matrixData"
      :metric="metric"
      :title="''"
      @cell-click="handleCellClick"
    />

    <!-- Summary stats -->
    <div v-if="summary" class="grid grid-cols-4 gap-4 mt-4">
      <div class="card text-center">
        <div class="text-2xl font-bold text-blue-600">{{ formatValue(summary.avg) }}</div>
        <div class="text-sm text-gray-600">Average</div>
      </div>
      <div class="card text-center">
        <div class="text-2xl font-bold text-green-600">{{ formatValue(summary.max) }}</div>
        <div class="text-sm text-gray-600">Maximum</div>
      </div>
      <div class="card text-center">
        <div class="text-2xl font-bold text-red-600">{{ formatValue(summary.min) }}</div>
        <div class="text-sm text-gray-600">Minimum</div>
      </div>
      <div class="card text-center">
        <div class="text-2xl font-bold text-gray-600">{{ summary.count }}</div>
        <div class="text-sm text-gray-600">Test Count</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TestRun, MetricType } from '../../types/testRun'
import { useHeatmapData } from '../../composables/useHeatmapData'
import { useTrendAnalysis } from '../../composables/useTrendAnalysis'
import { useChartData } from '../../composables/useChartData'
import HeatmapChart from './HeatmapChart.vue'

interface Props {
  testRuns: TestRun[]
  metric: MetricType
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Performance Matrix'
})

const emit = defineEmits<{
  'cell-click': [row: string, col: string]
}>()

const { createMatrixHeatmap } = useHeatmapData()
const { calculateSummary } = useTrendAnalysis()
const { formatMetric } = useChartData()

const rowDimension = ref<'block_size' | 'queue_depth' | 'protocol'>('block_size')
const colDimension = ref<'read_write_pattern' | 'drive_type' | 'protocol'>('read_write_pattern')

// Create matrix data
const matrixData = computed(() => {
  return createMatrixHeatmap(props.testRuns, props.metric, rowDimension.value, colDimension.value)
})

// Calculate summary statistics
const summary = computed(() => {
  return calculateSummary(props.testRuns, props.metric)
})

// Format value for display
function formatValue(value: number): string {
  return formatMetric(value, props.metric)
}

// Handle cell click
function handleCellClick(row: string, col: string) {
  emit('cell-click', row, col)
}

// Watch for dimension changes
watch([rowDimension, colDimension], () => {
  // Validate that dimensions are different
  if (rowDimension.value === colDimension.value) {
    // Reset to defaults
    rowDimension.value = 'block_size'
    colDimension.value = 'read_write_pattern'
  }
})
</script>

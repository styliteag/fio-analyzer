<template>
  <div class="w-full">
    <div v-if="title" class="text-lg font-semibold mb-4">{{ title }}</div>

    <!-- Heatmap Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr>
            <th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left text-sm font-medium">
              Configuration
            </th>
            <th
              v-for="col in heatmapData.cols"
              :key="col"
              class="border border-gray-300 bg-gray-100 px-3 py-2 text-center text-sm font-medium"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in heatmapData.rows" :key="row">
            <td class="border border-gray-300 px-3 py-2 text-sm font-medium bg-gray-50">
              {{ row }}
            </td>
            <td
              v-for="col in heatmapData.cols"
              :key="`${row}-${col}`"
              :style="{ backgroundColor: getCellColor(row, col) }"
              class="border border-gray-300 px-3 py-2 text-center text-sm cursor-pointer hover:opacity-80"
              @click="handleCellClick(row, col)"
            >
              <span class="font-semibold" :class="{ 'text-white': isDarkCell(row, col) }">
                {{ getCellValue(row, col) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div class="mt-4 flex items-center gap-4 text-sm">
      <span class="text-gray-600">Performance:</span>
      <div class="flex items-center gap-2">
        <div class="w-8 h-4 bg-red-500"></div>
        <span>Low</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-8 h-4 bg-yellow-500"></div>
        <span>Medium</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-8 h-4 bg-green-500"></div>
        <span>High</span>
      </div>
    </div>

    <!-- Cell details modal/tooltip (optional) -->
    <div v-if="selectedCell" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 class="font-semibold mb-2">Selected: {{ selectedCell.row }} - {{ selectedCell.col }}</h4>
      <p class="text-sm">Value: {{ selectedCell.value }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { HeatmapData } from '../../composables/useHeatmapData'
import { useHeatmapData } from '../../composables/useHeatmapData'
import { useChartData } from '../../composables/useChartData'
import type { MetricType } from '../../types/testRun'

interface Props {
  heatmapData: HeatmapData
  title?: string
  metric: MetricType
}

const props = withDefaults(defineProps<Props>(), {
  title: ''
})

const emit = defineEmits<{
  'cell-click': [row: string, col: string]
}>()

const { getHeatmapColor } = useHeatmapData()
const { formatMetric } = useChartData()

const selectedCell = ref<{ row: string; col: string; value: string } | null>(null)

// Get cell value
function getCellValue(row: string, col: string): string {
  const cell = props.heatmapData.cells.find((c) => c.row === row && c.col === col)
  if (!cell || cell.value === null) return '-'

  return formatMetric(cell.value, props.metric)
}

// Get cell background color
function getCellColor(row: string, col: string): string {
  const cell = props.heatmapData.cells.find((c) => c.row === row && c.col === col)
  if (!cell || cell.value === null) return '#f3f4f6' // gray-100

  return getHeatmapColor(cell.value, props.heatmapData.min, props.heatmapData.max)
}

// Check if cell is dark (for text color)
function isDarkCell(row: string, col: string): boolean {
  const cell = props.heatmapData.cells.find((c) => c.row === row && c.col === col)
  if (!cell || cell.value === null) return false

  const normalized = (cell.value - props.heatmapData.min) / (props.heatmapData.max - props.heatmapData.min)
  return normalized > 0.6
}

// Handle cell click
function handleCellClick(row: string, col: string) {
  const value = getCellValue(row, col)
  selectedCell.value = { row, col, value }
  emit('cell-click', row, col)
}
</script>

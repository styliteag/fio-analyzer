<template>
  <div class="chart-container" :style="{ height: `${height}px`, width: width ? `${width}px` : '100%' }">
    <div v-if="loading" class="chart-loading">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Loading chart...</span>
    </div>
    <div v-else-if="error" class="chart-error">
      <div class="text-red-600 text-center">
        <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p>{{ error }}</p>
      </div>
    </div>
    <div v-else-if="!hasData" class="chart-no-data">
      <div class="text-gray-500 text-center">
        <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p>No data available</p>
      </div>
    </div>
    <div v-else ref="chartContainer" class="chart-content">
      <slot :chart-data="chartData" :chart-options="mergedOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChartData, ChartOptions } from '@/types'

export interface BaseChartProps {
  data: ChartData
  options: ChartOptions
  height: number
  width: number
  loading: boolean
  error: string | null
}

const props = withDefaults(defineProps<BaseChartProps>(), {
  data: () => ({}),
  options: () => ({}),
  height: 400,
  width: 400,
  loading: false,
  error: null
})

const chartContainer = ref<HTMLElement>()

const hasData = computed(() => {
  return props.data &&
         props.data.labels.length > 0 &&
         props.data.datasets.length > 0 &&
         props.data.datasets.some(dataset => dataset.data.length > 0)
})

const chartData = computed(() => props.data)

const defaultOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    }
  },
  scales: {
    x: {
      display: true
    },
    y: {
      display: true,
      beginAtZero: true
    }
  }
}

const mergedOptions = computed(() => {
  return {
    ...defaultOptions,
    ...props.options,
    plugins: {
      ...defaultOptions.plugins,
      ...props.options?.plugins
    },
    scales: {
      ...defaultOptions.scales,
      ...props.options?.scales
    }
  }
})

// Expose chart container ref for advanced use cases
defineExpose({
  chartContainer
})
</script>

<style scoped>
.chart-container {
  position: relative;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 16px;
}

.chart-loading,
.chart-error,
.chart-no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}

.chart-content {
  height: 100%;
  width: 100%;
}

/* Chart hover effects */
.chart-container:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .chart-container {
    background: #1f2937;
    border-color: #374151;
  }
}</style>
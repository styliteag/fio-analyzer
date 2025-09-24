<template>
  <BaseChart
    :data="chartData"
    :options="chartOptions"
    :height="height"
    :width="width"
    :loading="loading"
    :error="error"
  >
    <template #default>
      <Radar
        :data="chartData"
        :options="chartOptions"
        :chart-id="chartId"
        :dataset-id-key="datasetIdKey"
        :plugins="plugins"
        :css-classes="cssClasses"
        :styles="styles"
      />
    </template>
  </BaseChart>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'vue-chartjs'
import BaseChart from './BaseChart.vue'
import type { ChartData, ChartOptions, TestRun } from '@/types'

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

export interface RadarChartProps {
  testRuns: TestRun[]
  selectedMetrics: string[]
  height: number
  width: number
  loading: boolean
  error: string | null
  chartId: string
  datasetIdKey: string
  plugins: unknown[]
  cssClasses: string
  styles: Record<string, string>
}

const props = withDefaults(defineProps<RadarChartProps>(), {
  testRuns: () => [],
  selectedMetrics: () => ['iops', 'avg_latency', 'bandwidth', 'p95_latency', 'p99_latency'],
  height: 400,
  width: 400,
  loading: false,
  error: null,
  chartId: 'radar-chart',
  datasetIdKey: 'label',
  plugins: () => [],
  cssClasses: '',
  styles: () => ({})
})

const chartData = computed((): ChartData => {
  if (!props.testRuns || props.testRuns.length === 0) {
    return { labels: [], datasets: [] }
  }

  const metricLabels: Record<string, string> = {
    iops: 'IOPS',
    avg_latency: 'Avg Latency (ms)',
    bandwidth: 'Bandwidth (MB/s)',
    p95_latency: 'P95 Latency (ms)',
    p99_latency: 'P99 Latency (ms)'
  }

  const labels = props.selectedMetrics.map(metric => metricLabels[metric as keyof typeof metricLabels] || metric)

  const colors = [
    'rgba(59, 130, 246, 0.6)',   // Blue
    'rgba(16, 185, 129, 0.6)',   // Green
    'rgba(245, 101, 101, 0.6)',  // Red
    'rgba(251, 191, 36, 0.6)',   // Yellow
    'rgba(139, 92, 246, 0.6)',   // Purple
    'rgba(236, 72, 153, 0.6)',   // Pink
  ]

  const borderColors = [
    'rgba(59, 130, 246, 1)',     // Blue
    'rgba(16, 185, 129, 1)',     // Green
    'rgba(245, 101, 101, 1)',    // Red
    'rgba(251, 191, 36, 1)',     // Yellow
    'rgba(139, 92, 246, 1)',     // Purple
    'rgba(236, 72, 153, 1)',     // Pink
  ]

  const datasets = props.testRuns.map((testRun, index) => {
    const data = props.selectedMetrics.map(metric => {
      const value = (testRun[metric as keyof TestRun] as number | null | undefined) ?? 0

      if (metric.includes('latency')) {
        return Math.max(0, 100 - Math.min(100, value))
      }

      return value
    })

    return {
      label: `${testRun.hostname} (${testRun.drive_type})`,
      data,
      backgroundColor: colors[index % colors.length],
      borderColor: borderColors[index % borderColors.length],
      borderWidth: 2,
      pointBackgroundColor: borderColors[index % borderColors.length],
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: borderColors[index % borderColors.length],
      pointRadius: 4,
      pointHoverRadius: 6,
    }
  })

  return { labels, datasets }
})

const chartOptions = computed((): ChartOptions => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Performance Comparison Radar Chart'
    },
    legend: {
      display: true,
      position: 'top'
    },
    tooltip: {
      callbacks: {
        label: function(context: unknown) {
          const datasetLabel = context.dataset.label || ''
          const metricName = context.label
          const value = context.raw as number

          if (metricName.includes('Latency')) {
            const originalValue = 100 - value
            return `${datasetLabel}: ${originalValue.toFixed(2)} ms`
          }

          return `${datasetLabel}: ${Number.isFinite(value) ? value.toLocaleString() : '—'}`
        }
      }
    }
  },
  scales: {
    r: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      },
      pointLabels: {
        font: {
          size: 12
        }
      },
      ticks: {
        display: false // Hide the radial tick labels for cleaner look
      }
    }
  },
  elements: {
    line: {
      borderWidth: 2
    },
    point: {
      radius: 4,
      hoverRadius: 6
    }
  }
}))

defineEmits<{
  chartClick: [event: MouseEvent, elements: unknown[]]
  chartHover: [event: MouseEvent, elements: unknown[]]
}>()
</script>

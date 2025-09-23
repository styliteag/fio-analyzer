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
      <Line
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
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import BaseChart from './BaseChart.vue'
import type { ChartData, ChartOptions, TimeSeriesData } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export interface LineChartProps {
  timeSeriesData: TimeSeriesData[]
  title: string
  yAxisLabel: string
  xAxisLabel: string
  height: number
  width: number
  loading: boolean
  error: string | null
  showArea: boolean
  smooth: boolean
  chartId: string
  datasetIdKey: string
  plugins: unknown[]
  cssClasses: string
  styles: Record<string, string>
}

const props = withDefaults(defineProps<LineChartProps>(), {
  timeSeriesData: () => [],
  title: 'Time Series Chart',
  yAxisLabel: 'Value',
  xAxisLabel: 'Time',
  height: 400,
  width: 400,
  loading: false,
  error: null,
  showArea: false,
  smooth: true,
  chartId: 'line-chart',
  datasetIdKey: 'label',
  plugins: () => [],
  cssClasses: '',
  styles: () => ({})
})

const chartData = computed((): ChartData => {
  if (!props.timeSeriesData || props.timeSeriesData.length === 0) {
    return { labels: [], datasets: [] }
  }

  // Get all unique timestamps
  const allTimestamps = new Set<string>()
  props.timeSeriesData.forEach(series => {
    series.timestamps.forEach(timestamp => allTimestamps.add(timestamp))
  })

  const labels = Array.from(allTimestamps).sort().map(timestamp => {
    return new Date(timestamp).toLocaleString()
  })

  const colors = [
    'rgba(59, 130, 246, 1)',     // Blue
    'rgba(16, 185, 129, 1)',     // Green
    'rgba(245, 101, 101, 1)',    // Red
    'rgba(251, 191, 36, 1)',     // Yellow
    'rgba(139, 92, 246, 1)',     // Purple
    'rgba(236, 72, 153, 1)',     // Pink
    'rgba(14, 165, 233, 1)',     // Sky
    'rgba(34, 197, 94, 1)',      // Emerald
  ]

  const backgroundColors = [
    'rgba(59, 130, 246, 0.1)',   // Blue
    'rgba(16, 185, 129, 0.1)',   // Green
    'rgba(245, 101, 101, 0.1)',  // Red
    'rgba(251, 191, 36, 0.1)',   // Yellow
    'rgba(139, 92, 246, 0.1)',   // Purple
    'rgba(236, 72, 153, 0.1)',   // Pink
    'rgba(14, 165, 233, 0.1)',   // Sky
    'rgba(34, 197, 94, 0.1)',    // Emerald
  ]

  const datasets = props.timeSeriesData.map((series, index) => {
    // Create data array aligned with labels
    const data = labels.map(label => {
      const timestamp = new Date(label).toISOString()
      const valueIndex = series.timestamps.findIndex(t => new Date(t).toISOString() === timestamp)
      return valueIndex >= 0 ? series.values[valueIndex] : null
    })

    return {
      label: `${series.hostname} - ${series.metric}`,
      data,
      borderColor: colors[index % colors.length],
      backgroundColor: props.showArea ? backgroundColors[index % backgroundColors.length] : 'transparent',
      borderWidth: 2,
      fill: props.showArea,
      tension: props.smooth ? 0.4 : 0,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: colors[index % colors.length],
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      spanGaps: true, // Connect points even when there are null values
    }
  })

  return { labels, datasets }
})

const chartOptions = computed((): ChartOptions => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    title: {
      display: true,
      text: props.title
    },
    legend: {
      display: true,
      position: 'top'
    },
    tooltip: {
      callbacks: {
        label: function(context: unknown) {
          const datasetLabel = context.dataset.label || ''
          const value = context.raw

          if (value === null || value === undefined) {
            return `${datasetLabel}: No data`
          }

          // Format value based on metric type
          if (datasetLabel.toLowerCase().includes('latency')) {
            return `${datasetLabel}: ${value.toFixed(2)} ms`
          } else if (datasetLabel.toLowerCase().includes('bandwidth')) {
            return `${datasetLabel}: ${value.toFixed(2)} MB/s`
          } else if (datasetLabel.toLowerCase().includes('iops')) {
            return `${datasetLabel}: ${Math.round(value).toLocaleString()} IOPS`
          }

          return `${datasetLabel}: ${value.toLocaleString()}`
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: props.xAxisLabel
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: props.yAxisLabel
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      },
      beginAtZero: true
    }
  },
  elements: {
    point: {
      radius: 3,
      hoverRadius: 5
    },
    line: {
      borderWidth: 2
    }
  }
}))

defineEmits<{
  chartClick: [event: MouseEvent, elements: unknown[]]
  chartHover: [event: MouseEvent, elements: unknown[]]
}>()
</script>
<template>
  <div class="w-full" :style="{ height: height }">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js'
import type { ChartData } from '../../types/testRun'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Props {
  data: ChartData
  title?: string
  stacked?: boolean
  height?: string
  yAxisLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  stacked: false,
  height: '400px',
  yAxisLabel: ''
})

const chartData = computed(() => props.data)

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: !!props.title,
      text: props.title,
      font: {
        size: 16,
        weight: 'bold'
      }
    },
    legend: {
      position: 'top',
      labels: {
        boxWidth: 12,
        padding: 15
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || ''
          const value = context.parsed.y
          return `${label}: ${formatValue(value)}`
        }
      }
    }
  },
  scales: {
    x: {
      stacked: props.stacked,
      grid: {
        display: false
      }
    },
    y: {
      stacked: props.stacked,
      beginAtZero: true,
      title: {
        display: !!props.yAxisLabel,
        text: props.yAxisLabel
      },
      ticks: {
        callback: (value) => formatValue(value as number)
      }
    }
  }
}))

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  } else {
    return value.toFixed(1)
  }
}
</script>

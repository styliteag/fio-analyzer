<template>
  <div class="w-full" :style="{ height: height }">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Props {
  data: {
    labels: (string | number)[]
    datasets: {
      label: string
      data: number[]
      borderColor: string
      backgroundColor: string
      tension?: number
    }[]
  }
  title?: string
  height?: string
  xAxisLabel?: string
  yAxisLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: '400px',
  xAxisLabel: '',
  yAxisLabel: ''
})

const chartData = computed(() => props.data)

const chartOptions = computed<ChartOptions<'line'>>(() => ({
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
      title: {
        display: !!props.xAxisLabel,
        text: props.xAxisLabel
      },
      grid: {
        display: false
      }
    },
    y: {
      beginAtZero: true,
      title: {
        display: !!props.yAxisLabel,
        text: props.yAxisLabel
      },
      ticks: {
        callback: (value) => formatValue(value as number)
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
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

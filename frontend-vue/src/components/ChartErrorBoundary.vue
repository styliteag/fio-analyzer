<template>
  <ErrorBoundary
    fallback-title="Chart Rendering Failed"
    fallback-message="Unable to display the chart. This might be due to invalid data or a rendering issue."
    :show-details="showDetails"
    :show-report-button="showReportButton"
    :max-retries="maxRetries"
    @error="handleChartError"
    @retry="handleRetry"
    @report="handleReport"
  >
    <slot />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import ErrorBoundary from './ErrorBoundary.vue'

interface Props {
  chartType?: string
  showDetails?: boolean
  showReportButton?: boolean
  maxRetries?: number
}

const props = withDefaults(defineProps<Props>(), {
  chartType: 'chart',
  showDetails: false,
  showReportButton: true,
  maxRetries: 2
})

interface Emits {
  (e: 'chart-error', error: Error, chartType: string): void
  (e: 'chart-retry', chartType: string): void
  (e: 'chart-report', error: Error, chartType: string): void
}

const emit = defineEmits<Emits>()

const handleChartError = (error: Error) => {
  console.error(`Chart error in ${props.chartType}:`, error)

  // Enhance error with chart-specific information
  const chartError = new Error(`Failed to render ${props.chartType}: ${error.message}`)
  chartError.name = 'ChartRenderError'
  chartError.stack = error.stack

  emit('chart-error', chartError, props.chartType)
}

const handleRetry = () => {
  console.log(`Retrying chart render for ${props.chartType}`)
  emit('chart-retry', props.chartType)
}

const handleReport = (error: Error) => {
  console.log(`Reporting chart error for ${props.chartType}:`, error)
  emit('chart-report', error, props.chartType)
}
</script>

<style scoped>
/* ChartErrorBoundary uses ErrorBoundary styles */
</style>

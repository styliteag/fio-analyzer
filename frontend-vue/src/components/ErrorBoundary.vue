<template>
  <div class="error-boundary">
    <slot v-if="!hasError" />

    <!-- Error State -->
    <div v-else class="error-state">
      <div class="error-content">
        <div class="error-icon">
          <AlertTriangle class="w-12 h-12 text-red-500" />
        </div>

        <div class="error-info">
          <h3 class="error-title">{{ errorTitle }}</h3>
          <p class="error-message">{{ errorMessage }}</p>

          <!-- Show technical details in development -->
          <details v-if="showDetails && error" class="error-details">
            <summary class="error-details-summary">Technical Details</summary>
            <pre class="error-details-content">{{ error.stack }}</pre>
          </details>
        </div>

        <div class="error-actions">
          <button
            class="btn-retry"
            :disabled="retrying"
            @click="retry"
          >
            <RefreshCw v-if="retrying" class="w-4 h-4 mr-2 animate-spin" />
            <RotateCcw v-else class="w-4 h-4 mr-2" />
            {{ retrying ? 'Retrying...' : 'Try Again' }}
          </button>

          <button
            v-if="showReportButton"
            class="btn-report"
            @click="reportError"
          >
            <Bug class="w-4 h-4 mr-2" />
            Report Issue
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { AlertTriangle, RefreshCw, RotateCcw, Bug } from 'lucide-vue-next'

interface Props {
  fallbackTitle?: string
  fallbackMessage?: string
  showDetails?: boolean
  showReportButton?: boolean
  maxRetries?: number
  onRetry?: () => void
  onError?: (error: Error) => void
}

withDefaults(defineProps<Props>(), {
  fallbackTitle: 'Something went wrong',
  fallbackMessage: 'An unexpected error occurred. Please try again.',
  showDetails: false,
  showReportButton: true,
  maxRetries: 3,
  onRetry: undefined,
  onError: undefined
})

interface Emits {
  (e: 'error', error: Error): void
  (e: 'retry'): void
  (e: 'report', error: Error): void
}

const emit = defineEmits<Emits>()

// State
const hasError = ref(false)
const error = ref<Error | null>(null)
const retryCount = ref(0)
const retrying = ref(false)

// Computed
const errorTitle = computed(() => {
  if (error.value?.name === 'ChartRenderError') {
    return 'Chart Rendering Failed'
  }
  if (error.value?.name === 'DataLoadError') {
    return 'Data Loading Failed'
  }
  return props.fallbackTitle
})

const errorMessage = computed(() => {
  if (error.value?.message) {
    return error.value.message
  }
  return props.fallbackMessage
})

// Methods
const retry = async () => {
  if (retryCount.value >= props.maxRetries) {
    return
  }

  retrying.value = true
  retryCount.value++

  try {
    hasError.value = false
    error.value = null

    emit('retry')

    if (props.onRetry) {
      await props.onRetry()
    }
  } catch (err) {
    console.error('Retry failed:', err)
  } finally {
    retrying.value = false
  }
}

const reportError = () => {
  if (error.value) {
    emit('report', error.value)
  }
}

const handleError = (err: Error) => {
  hasError.value = true
  error.value = err

  emit('error', err)

  if (props.onError) {
    props.onError(err)
  }

  console.error('Error boundary caught error:', err)
}

// Error capturing
onErrorCaptured((err) => {
  handleError(err)
  return false // Prevent error from propagating further
})
</script>

<style scoped>
.error-boundary {
  @apply w-full h-full;
}

.error-state {
  @apply flex items-center justify-center min-h-[200px] p-6;
  @apply bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700;
  @apply theme-transition;
}

.error-content {
  @apply text-center max-w-md;
}

.error-icon {
  @apply mb-4;
}

.error-info {
  @apply mb-6;
}

.error-title {
  @apply text-lg font-semibold theme-text-primary mb-2;
}

.error-message {
  @apply text-sm theme-text-secondary;
}

.error-details {
  @apply mt-4 text-left;
}

.error-details-summary {
  @apply text-sm font-medium theme-text-secondary cursor-pointer;
  @apply hover:theme-text-primary transition-colors;
}

.error-details-content {
  @apply mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs;
  @apply font-mono theme-text-primary overflow-auto max-h-32;
}

.error-actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center;
}

.btn-retry {
  @apply inline-flex items-center px-4 py-2 text-sm font-medium;
  @apply text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400;
  @apply border border-transparent rounded-md shadow-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
  @apply theme-transition;
}

.btn-report {
  @apply inline-flex items-center px-4 py-2 text-sm font-medium;
  @apply text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800;
  @apply border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply hover:bg-gray-50 dark:hover:bg-gray-700;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
  @apply theme-transition;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-gray-100;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-400;
}

.theme-transition {
  @apply transition-colors duration-300 ease-in-out;
}
</style>

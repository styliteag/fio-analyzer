<template>
  <div
    class="rounded-lg p-4"
    :class="containerClasses"
  >
    <div class="flex items-start">
      <!-- Error icon -->
      <div class="flex-shrink-0">
        <svg
          class="w-5 h-5"
          :class="iconClasses"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      <!-- Error content -->
      <div class="ml-3 flex-1">
        <h3
          v-if="title"
          class="text-sm font-medium"
          :class="titleClasses"
        >
          {{ title }}
        </h3>

        <div
          class="mt-1 text-sm"
          :class="messageClasses"
        >
          <slot>
            {{ message }}
          </slot>
        </div>

        <!-- Error details -->
        <div
          v-if="details && showDetails"
          class="mt-3"
        >
          <details class="group">
            <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
              Show error details
            </summary>
            <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <pre class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">{{ details }}</pre>
            </div>
          </details>
        </div>

        <!-- Actions -->
        <div
          v-if="retryable && $slots.actions"
          class="mt-3"
        >
          <slot name="actions" />
        </div>

        <div
          v-else-if="retryable"
          class="mt-3"
        >
          <button
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            :class="retryButtonClasses"
            @click="$emit('retry')"
          >
            <svg
              v-if="retrying"
              class="animate-spin -ml-1 mr-2 h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {{ retrying ? 'Retrying...' : 'Try again' }}
          </button>
        </div>
      </div>

      <!-- Dismiss button -->
      <div
        v-if="dismissible"
        class="ml-auto pl-3 flex-shrink-0"
      >
        <button
          class="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2"
          :class="dismissButtonClasses"
          @click="$emit('dismiss')"
        >
          <span class="sr-only">Dismiss</span>
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ErrorSeverity = 'low' | 'medium' | 'high'

interface Props {
  title?: string
  message: string
  details?: string
  severity?: ErrorSeverity
  retryable?: boolean
  dismissible?: boolean
  showDetails?: boolean
  retrying?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  details: '',
  severity: 'medium',
  retryable: false,
  dismissible: false,
  showDetails: true,
  retrying: false,
})

const emit = defineEmits<{
  retry: []
  dismiss: []
}>()

const containerClasses = computed(() => {
  const severityMap = {
    low: 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    medium: 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800',
    high: 'bg-red-50 border border-red-300 dark:bg-red-900/30 dark:border-red-700',
  }

  return severityMap[props.severity]
})

const iconClasses = computed(() => {
  const severityMap = {
    low: 'text-yellow-400',
    medium: 'text-red-400',
    high: 'text-red-500',
  }

  return severityMap[props.severity]
})

const titleClasses = computed(() => {
  const severityMap = {
    low: 'text-yellow-800 dark:text-yellow-200',
    medium: 'text-red-800 dark:text-red-200',
    high: 'text-red-900 dark:text-red-100',
  }

  return severityMap[props.severity]
})

const messageClasses = computed(() => {
  const severityMap = {
    low: 'text-yellow-700 dark:text-yellow-300',
    medium: 'text-red-700 dark:text-red-300',
    high: 'text-red-800 dark:text-red-200',
  }

  return severityMap[props.severity]
})

const retryButtonClasses = computed(() => {
  const severityMap = {
    low: 'text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:ring-yellow-500 border-yellow-300',
    medium: 'text-red-800 bg-red-100 hover:bg-red-200 focus:ring-red-500 border-red-300',
    high: 'text-red-900 bg-red-100 hover:bg-red-200 focus:ring-red-500 border-red-400',
  }

  return severityMap[props.severity]
})

const dismissButtonClasses = computed(() => {
  const severityMap = {
    low: 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-500',
    medium: 'text-red-500 hover:bg-red-100 focus:ring-red-500',
    high: 'text-red-500 hover:bg-red-100 focus:ring-red-500',
  }

  return severityMap[props.severity]
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

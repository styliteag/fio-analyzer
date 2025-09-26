<template>
  <div class="flex items-center space-x-2">
    <div
      class="relative flex-shrink-0"
      :class="indicatorWrapperClasses"
    >
      <div
        class="w-3 h-3 rounded-full border-2 transition-all duration-200"
        :class="indicatorClasses"
      />

      <!-- Pulsing animation for certain statuses -->
      <div
        v-if="pulsing"
        class="absolute inset-0 w-3 h-3 rounded-full animate-ping"
        :class="pulseClasses"
      />
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center space-x-2">
        <span
          class="text-sm font-medium"
          :class="labelClasses"
        >
          {{ label }}
        </span>

        <span
          v-if="showStatus"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          :class="statusBadgeClasses"
        >
          {{ statusText }}
        </span>
      </div>

      <div
        v-if="subtitle || $slots.subtitle"
        class="text-xs mt-0.5"
        :class="subtitleClasses"
      >
        <slot name="subtitle">
          {{ subtitle }}
        </slot>
      </div>

      <div
        v-if="message || $slots.message"
        class="text-xs mt-1"
        :class="messageClasses"
      >
        <slot name="message">
          {{ message }}
        </slot>
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="flex-shrink-0"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type StatusType = 'online' | 'offline' | 'degraded' | 'unknown' | 'success' | 'warning' | 'error' | 'info'

interface Props {
  status: StatusType
  label: string
  subtitle?: string
  message?: string
  showStatus?: boolean
  pulsing?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  message: '',
  showStatus: true,
  pulsing: false,
  size: 'md',
})

const statusConfig = computed(() => {
  const configs = {
    online: {
      indicator: 'bg-green-500 border-green-500',
      pulse: 'bg-green-400',
      label: 'text-green-700 dark:text-green-400',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      text: 'Online',
    },
    offline: {
      indicator: 'bg-red-500 border-red-500',
      pulse: 'bg-red-400',
      label: 'text-red-700 dark:text-red-400',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      text: 'Offline',
    },
    degraded: {
      indicator: 'bg-yellow-500 border-yellow-500',
      pulse: 'bg-yellow-400',
      label: 'text-yellow-700 dark:text-yellow-400',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      text: 'Degraded',
    },
    unknown: {
      indicator: 'bg-gray-400 border-gray-400',
      pulse: 'bg-gray-300',
      label: 'text-gray-700 dark:text-gray-400',
      badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      text: 'Unknown',
    },
    success: {
      indicator: 'bg-green-500 border-green-500',
      pulse: 'bg-green-400',
      label: 'text-green-700 dark:text-green-400',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      text: 'Success',
    },
    warning: {
      indicator: 'bg-yellow-500 border-yellow-500',
      pulse: 'bg-yellow-400',
      label: 'text-yellow-700 dark:text-yellow-400',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      text: 'Warning',
    },
    error: {
      indicator: 'bg-red-500 border-red-500',
      pulse: 'bg-red-400',
      label: 'text-red-700 dark:text-red-400',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      text: 'Error',
    },
    info: {
      indicator: 'bg-blue-500 border-blue-500',
      pulse: 'bg-blue-400',
      label: 'text-blue-700 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      text: 'Info',
    },
  }

  return configs[props.status] || configs.unknown
})

const indicatorWrapperClasses = computed(() => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return sizeClasses[props.size] || sizeClasses.md
})

const indicatorClasses = computed(() => {
  return statusConfig.value.indicator
})

const pulseClasses = computed(() => {
  return statusConfig.value.pulse
})

const labelClasses = computed(() => {
  return statusConfig.value.label
})

const statusBadgeClasses = computed(() => {
  return statusConfig.value.badge
})

const subtitleClasses = computed(() => {
  return 'text-gray-500 dark:text-gray-400'
})

const messageClasses = computed(() => {
  return 'text-gray-600 dark:text-gray-300'
})

const statusText = computed(() => {
  return statusConfig.value.text
})

// Expose status info for parent components
defineExpose({
  statusConfig,
  statusText,
})
</script>

<style scoped>
/* Custom animation for pulsing effect */
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-ping {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
</style>

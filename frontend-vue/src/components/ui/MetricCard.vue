<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 hover:shadow-md"
    :class="cardClasses"
  >
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
          {{ title }}
        </p>
        <div class="flex items-baseline space-x-2">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ formattedValue }}
          </p>
          <span
            v-if="unit"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ unit }}
          </span>
          <div
            v-if="trend"
            class="flex items-center text-sm"
            :class="trendClasses"
          >
            <svg
              class="w-4 h-4 mr-1"
              :class="{ 'rotate-180': trend === 'down' }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            <span>{{ trendLabel }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="icon"
        class="flex-shrink-0 ml-4"
        :class="iconClasses"
      >
        <component :is="icon" class="w-8 h-8" />
      </div>
    </div>

    <div
      v-if="subtitle || $slots.subtitle"
      class="mt-2 text-sm text-gray-500 dark:text-gray-400"
    >
      <slot name="subtitle">
        {{ subtitle }}
      </slot>
    </div>

    <div
      v-if="$slots.default"
      class="mt-4"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/utils/formatters'

interface Props {
  title: string
  value: string | number
  unit?: string
  icon?: any
  trend?: 'up' | 'down' | 'stable'
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray'
  subtitle?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  trend: undefined,
  color: 'blue',
  subtitle: '',
  compact: false,
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  return formatNumber(props.value)
})

const cardClasses = computed(() => {
  const baseClasses = 'relative overflow-hidden'

  if (props.compact) {
    return `${baseClasses} p-4`
  }

  return baseClasses
})

const trendClasses = computed(() => {
  switch (props.trend) {
    case 'up':
      return 'text-green-600 dark:text-green-400'
    case 'down':
      return 'text-red-600 dark:text-red-400'
    case 'stable':
      return 'text-gray-600 dark:text-gray-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
})

const trendLabel = computed(() => {
  switch (props.trend) {
    case 'up':
      return 'Increased'
    case 'down':
      return 'Decreased'
    case 'stable':
      return 'Stable'
    default:
      return ''
  }
})

const iconClasses = computed(() => {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
  }

  return colorMap[props.color] || colorMap.blue
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

<template>
  <div
    class="flex items-center justify-center"
    :class="containerClasses"
  >
    <div
      v-if="type === 'spinner'"
      class="relative"
      :class="spinnerWrapperClasses"
    >
      <!-- Main spinner -->
      <div
        class="animate-spin rounded-full border-2"
        :class="spinnerClasses"
      />

      <!-- Inner spinner for layered effect -->
      <div
        v-if="layered"
        class="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
        :class="innerSpinnerClasses"
        :style="{ animationDirection: 'reverse', animationDuration: '1.5s' }"
      />
    </div>

    <div
      v-else-if="type === 'dots'"
      class="flex space-x-1"
    >
      <div
        v-for="dot in 3"
        :key="dot"
        class="w-2 h-2 bg-current rounded-full animate-pulse"
        :class="dotsClasses"
        :style="{ animationDelay: `${(dot - 1) * 0.2}s` }"
      />
    </div>

    <div
      v-else-if="type === 'pulse'"
      class="animate-pulse"
      :class="pulseClasses"
    >
      <div class="bg-current rounded" :class="pulseBarClasses" />
    </div>

    <div
      v-else-if="type === 'bars'"
      class="flex items-end space-x-1"
      :class="barsWrapperClasses"
    >
      <div
        v-for="bar in 5"
        :key="bar"
        class="bg-current animate-pulse"
        :class="barClasses"
        :style="{
          animationDelay: `${(bar - 1) * 0.1}s`,
          height: `${20 + (bar * 8)}%`
        }"
      />
    </div>

    <!-- Loading text -->
    <div
      v-if="message || $slots.default"
      class="ml-3"
      :class="textClasses"
    >
      <slot>
        {{ message }}
      </slot>
    </div>

    <!-- Progress indicator -->
    <div
      v-if="progress !== undefined && type === 'spinner'"
      class="absolute inset-0 flex items-center justify-center"
    >
      <span
        class="text-xs font-medium"
        :class="progressTextClasses"
      >
        {{ Math.round(progress) }}%
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SpinnerType = 'spinner' | 'dots' | 'pulse' | 'bars'
type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type SpinnerColor = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'white'

interface Props {
  type?: SpinnerType
  size?: SpinnerSize
  color?: SpinnerColor
  message?: string
  progress?: number
  layered?: boolean
  center?: boolean
  inline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'spinner',
  size: 'md',
  color: 'blue',
  message: '',
  progress: undefined,
  layered: false,
  center: false,
  inline: false,
})

const containerClasses = computed(() => {
  const classes = []

  if (props.center) {
    classes.push('min-h-[200px]')
  }

  if (props.inline) {
    classes.push('inline-flex')
  } else {
    classes.push('flex')
  }

  return classes
})

const spinnerWrapperClasses = computed(() => {
  const sizeMap = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  }

  return sizeMap[props.size] || sizeMap.md
})

const spinnerClasses = computed(() => {
  const colorMap = {
    blue: 'border-blue-600 border-t-transparent',
    green: 'border-green-600 border-t-transparent',
    yellow: 'border-yellow-600 border-t-transparent',
    red: 'border-red-600 border-t-transparent',
    gray: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent',
  }

  const sizeMap = {
    xs: 'border',
    sm: 'border',
    md: 'border-2',
    lg: 'border-2',
    xl: 'border-2',
  }

  return `${colorMap[props.color]} ${sizeMap[props.size]}`
})

const innerSpinnerClasses = computed(() => {
  const colorMap = {
    blue: 'border-blue-400',
    green: 'border-green-400',
    yellow: 'border-yellow-400',
    red: 'border-red-400',
    gray: 'border-gray-400',
    white: 'border-white',
  }

  return colorMap[props.color]
})

const dotsClasses = computed(() => {
  const colorMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
    white: 'text-white',
  }

  return colorMap[props.color]
})

const pulseClasses = computed(() => {
  const sizeMap = {
    xs: 'w-4',
    sm: 'w-6',
    md: 'w-8',
    lg: 'w-12',
    xl: 'w-16',
  }

  return sizeMap[props.size]
})

const pulseBarClasses = computed(() => {
  const sizeMap = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
    xl: 'h-4',
  }

  const colorMap = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
    gray: 'bg-gray-600',
    white: 'bg-white',
  }

  return `${sizeMap[props.size]} ${colorMap[props.color]}`
})

const barsWrapperClasses = computed(() => {
  const sizeMap = {
    xs: 'h-3',
    sm: 'h-4',
    md: 'h-5',
    lg: 'h-6',
    xl: 'h-8',
  }

  return sizeMap[props.size]
})

const barClasses = computed(() => {
  const colorMap = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
    gray: 'bg-gray-600',
    white: 'bg-white',
  }

  return `w-1 rounded-sm ${colorMap[props.color]}`
})

const textClasses = computed(() => {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
    white: 'text-white',
  }

  return `text-sm ${colorMap[props.color]}`
})

const progressTextClasses = computed(() => {
  return 'text-gray-600 dark:text-gray-400'
})
</script>

<style scoped>
/* Additional custom animations can be added here if needed */
</style>

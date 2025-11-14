<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading && showLoadingSpinner"
      class="animate-spin -ml-1 mr-2 h-4 w-4"
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

    <!-- Left icon -->
    <component
      :is="icon"
      v-if="icon && iconPosition === 'left'"
      class="w-4 h-4 mr-2"
      :class="{ 'mr-0': !hasContent }"
    />

    <!-- Button content -->
    <span
      v-if="hasContent"
      class="truncate"
    >
      <slot>
        {{ label }}
      </slot>
    </span>

    <!-- Right icon -->
    <component
      :is="icon"
      v-if="icon && iconPosition === 'right'"
      class="w-4 h-4 ml-2"
      :class="{ 'ml-0': !hasContent }"
    />

    <!-- Loading text -->
    <span
      v-if="loading && loadingText"
      class="ml-2"
    >
      {{ loadingText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  showLoadingSpinner?: boolean
  icon?: typeof import('lucide-vue-next').LucideIcon
  iconPosition?: 'left' | 'right'
  label?: string
  block?: boolean
  rounded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  loadingText: '',
  showLoadingSpinner: true,
  icon: undefined,
  iconPosition: 'left',
  label: '',
  block: false,
  rounded: false,
})

const emit = defineEmits<{
  click: [event: Event]
}>()

const slots = useSlots()

const hasContent = computed(() => {
  return props.label || slots.default
})

const buttonClasses = computed(() => {
  const classes = []

  // Base classes
  classes.push('inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed')

  // Variant classes
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 border border-transparent shadow-sm',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 border border-transparent shadow-sm',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-200 dark:hover:bg-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 border border-transparent shadow-sm',
  }

  classes.push(variantClasses[props.variant])

  // Size classes
  const sizeClasses = {
    xs: 'px-2.5 py-1.5 text-xs rounded',
    sm: 'px-3 py-2 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-md',
    lg: 'px-4 py-2 text-base rounded-md',
    xl: 'px-6 py-3 text-base rounded-md',
  }

  classes.push(sizeClasses[props.size])

  // Block class
  if (props.block) {
    classes.push('w-full')
  }

  // Rounded class
  if (props.rounded) {
    classes.push('rounded-full')
  }

  // Loading state
  if (props.loading) {
    classes.push('cursor-wait')
  }

  return classes
})

function handleClick(event: Event) {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }

  emit('click', event)
}
</script>

<style scoped>
/* Additional styles if needed */
</style>

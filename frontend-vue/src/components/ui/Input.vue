<template>
  <div class="relative">
    <!-- Label -->
    <label
      v-if="label"
      :for="inputId"
      class="block text-sm font-medium mb-1"
      :class="labelClasses"
    >
      {{ label }}
      <span
        v-if="required"
        class="text-red-500 ml-1"
        aria-label="required"
      >
        *
      </span>
    </label>

    <!-- Input wrapper -->
    <div class="relative">
      <!-- Left icon -->
      <div
        v-if="leftIcon"
        class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
      >
        <component
          :is="leftIcon"
          class="h-5 w-5"
          :class="iconClasses"
        />
      </div>

      <!-- Input element -->
      <input
        :id="inputId"
        ref="inputRef"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :maxlength="maxlength"
        :minlength="minlength"
        :pattern="pattern"
        :autocomplete="autocomplete"
        :class="inputClasses"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
        @change="handleChange"
      />

      <!-- Right icon or action -->
      <div
        v-if="rightIcon || clearable"
        class="absolute inset-y-0 right-0 flex items-center"
      >
        <button
          v-if="clearable && modelValue && !disabled && !readonly"
          @click="clearInput"
          class="pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
          type="button"
          aria-label="Clear input"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div
          v-if="rightIcon && !clearable"
          class="pr-3"
          :class="iconClasses"
        >
          <component :is="rightIcon" class="h-5 w-5" />
        </div>
      </div>
    </div>

    <!-- Helper text -->
    <p
      v-if="helperText && !error"
      class="mt-1 text-sm"
      :class="helperClasses"
    >
      {{ helperText }}
    </p>

    <!-- Error message -->
    <p
      v-if="error"
      class="mt-1 text-sm text-red-600 dark:text-red-400"
    >
      {{ error }}
    </p>

    <!-- Character count -->
    <div
      v-if="showCharacterCount && maxlength"
      class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right"
    >
      {{ characterCount }}/{{ maxlength }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
type InputSize = 'sm' | 'md' | 'lg'

interface Props {
  modelValue: string | number
  type?: InputType
  label?: string
  placeholder?: string
  helperText?: string
  error?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  clearable?: boolean
  showCharacterCount?: boolean
  size?: InputSize
  leftIcon?: any
  rightIcon?: any
  maxlength?: number
  minlength?: number
  pattern?: string
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'md',
  disabled: false,
  readonly: false,
  required: false,
  clearable: false,
  showCharacterCount: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  change: [event: Event]
  clear: []
}>()

const inputRef = ref<HTMLInputElement>()
const inputId = computed(() => `input-${Math.random().toString(36).substr(2, 9)}`)

const inputType = computed(() => {
  // Handle special cases
  if (props.type === 'search') return 'text'
  return props.type
})

const characterCount = computed(() => {
  return String(props.modelValue || '').length
})

const labelClasses = computed(() => {
  return 'text-gray-700 dark:text-gray-300'
})

const inputClasses = computed(() => {
  const classes = []

  // Base classes
  classes.push('block w-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed')

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg',
  }

  classes.push(sizeClasses[props.size])

  // Icon padding adjustments
  if (props.leftIcon) {
    const iconPadding = {
      sm: 'pl-10',
      md: 'pl-10',
      lg: 'pl-12',
    }
    classes.push(iconPadding[props.size])
  }

  if (props.rightIcon || props.clearable) {
    const iconPadding = {
      sm: 'pr-10',
      md: 'pr-10',
      lg: 'pr-12',
    }
    classes.push(iconPadding[props.size])
  }

  // State classes
  if (props.error) {
    classes.push('border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500 dark:border-red-600 dark:text-red-100 dark:placeholder-red-400')
  } else if (props.disabled) {
    classes.push('bg-gray-50 border-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400')
  } else {
    classes.push('border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:border-gray-600 dark:text-white dark:placeholder-gray-400')
  }

  // Border and background
  classes.push('border rounded-md shadow-sm')

  return classes
})

const iconClasses = computed(() => {
  return props.error
    ? 'text-red-400'
    : props.disabled
    ? 'text-gray-400'
    : 'text-gray-400'
})

const helperClasses = computed(() => {
  return 'text-gray-500 dark:text-gray-400'
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  let value: string | number = target.value

  // Handle number inputs
  if (props.type === 'number') {
    const numValue = parseFloat(value)
    value = isNaN(numValue) ? 0 : numValue
  }

  emit('update:modelValue', value)
}

function handleBlur(event: FocusEvent) {
  emit('blur', event)
}

function handleFocus(event: FocusEvent) {
  emit('focus', event)
}

function handleChange(event: Event) {
  emit('change', event)
}

function clearInput() {
  emit('update:modelValue', '')
  emit('clear')
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// Expose methods for parent components
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

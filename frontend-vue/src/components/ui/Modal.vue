<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <!-- Backdrop -->
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 overflow-y-auto"
        :class="backdropClasses"
        @click.self="handleBackdropClick"
      >
        <div class="flex min-h-screen items-center justify-center p-4">
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0 scale-95 translate-y-4"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition-all duration-200"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-4"
          >
            <!-- Modal content -->
            <div
              v-if="isOpen"
              ref="modalRef"
              class="relative w-full max-w-lg transform overflow-hidden rounded-lg bg-white shadow-xl transition-all dark:bg-gray-800"
              :class="modalClasses"
              role="dialog"
              aria-modal="true"
              :aria-labelledby="titleId"
              @keydown.escape="handleEscape"
            >
              <!-- Header -->
              <div
                v-if="title || $slots.header"
                class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
              >
                <div :id="titleId" class="text-lg font-medium text-gray-900 dark:text-white">
                  <slot name="header">
                    {{ title }}
                  </slot>
                </div>

                <button
                  v-if="closable"
                  class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  aria-label="Close modal"
                  @click="close"
                >
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Body -->
              <div class="px-6 py-4">
                <slot>
                  {{ content }}
                </slot>
              </div>

              <!-- Footer -->
              <div
                v-if="$slots.footer || showDefaultActions"
                class="flex items-center justify-end space-x-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <slot name="footer">
                  <div v-if="showDefaultActions" class="flex space-x-3">
                    <button
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                      @click="close"
                    >
                      {{ cancelText }}
                    </button>

                    <button
                      class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      :class="confirmButtonClasses"
                      @click="confirm"
                    >
                      {{ confirmText }}
                    </button>
                  </div>
                </slot>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface Props {
  modelValue: boolean
  title?: string
  content?: string
  size?: ModalSize
  closable?: boolean
  backdropClosable?: boolean
  confirmText?: string
  cancelText?: string
  showDefaultActions?: boolean
  confirmVariant?: 'primary' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  content: '',
  size: 'md',
  closable: true,
  backdropClosable: true,
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  showDefaultActions: false,
  confirmVariant: 'primary',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
  close: []
}>()

const modalRef = ref<HTMLElement>()
const titleId = ref(`modal-title-${Math.random().toString(36).substr(2, 9)}`)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const modalClasses = computed(() => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  }

  return sizeClasses[props.size] || sizeClasses.md
})

const backdropClasses = computed(() => {
  return 'bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75'
})

const confirmButtonClasses = computed(() => {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  }

  return variantClasses[props.confirmVariant] || variantClasses.primary
})

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
  emit('close')
}

function confirm() {
  emit('confirm')
  close()
}

function cancel() {
  emit('cancel')
  close()
}

function handleBackdropClick() {
  if (props.backdropClosable) {
    close()
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closable) {
    close()
  }
}

// Focus management
function trapFocus(event: KeyboardEvent) {
  if (!modalRef.value) return

  const focusableElements = modalRef.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )

  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  if (event.key === 'Tab') {
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }
}

watch(isOpen, (newValue) => {
  if (newValue) {
    // Store the currently focused element
    const focusedElement = document.activeElement as HTMLElement

    // Focus the modal
    nextTick(() => {
      modalRef.value?.focus()

      // Add event listeners
      document.addEventListener('keydown', trapFocus)
    })

    // Store reference for cleanup
    modalRef.value?._focusedElement = focusedElement
  } else {
    // Restore focus
    const focusedElement = modalRef.value?._focusedElement as HTMLElement
    if (focusedElement) {
      focusedElement.focus()
    }

    // Remove event listeners
    document.removeEventListener('keydown', trapFocus)
  }
})

onMounted(() => {
  if (isOpen.value) {
    document.addEventListener('keydown', trapFocus)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', trapFocus)
})

// Prevent body scroll when modal is open
watch(isOpen, (newValue) => {
  if (newValue) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

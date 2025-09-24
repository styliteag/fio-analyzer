<template>
  <div class="text-center py-12">
    <!-- Icon -->
    <div class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4">
      <component :is="icon || defaultIcon" class="w-full h-full" />
    </div>

    <!-- Title -->
    <h3 class="mt-2 text-lg font-medium text-gray-900 dark:text-white">
      {{ title }}
    </h3>

    <!-- Description -->
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      {{ description }}
    </p>

    <!-- Action -->
    <div v-if="hasAction" class="mt-6">
      <slot name="action">
        <button
          v-if="actionLabel && actionHandler"
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          @click="actionHandler"
        >
          <component :is="actionIcon" v-if="actionIcon" class="w-4 h-4 mr-2" />
          {{ actionLabel }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Database } from 'lucide-vue-next'

interface Props {
  title: string
  description: string
  icon?: any
  actionLabel?: string
  actionIcon?: any
  actionHandler?: () => void
}

const props = defineProps<Props>()

const defaultIcon = Database

const hasAction = computed(() => {
  return props.actionLabel && props.actionHandler
})
</script>

<style scoped>
/* Additional styles if needed */
</style>
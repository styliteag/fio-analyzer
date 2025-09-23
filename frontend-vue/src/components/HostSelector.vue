<template>
  <div class="host-selector">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Host Selection</h3>
        <p class="card-description">Choose a host to analyze performance data</p>
      </div>

      <div class="card-content">
        <div class="space-y-4">
          <!-- Host Dropdown -->
          <div>
            <label for="hostname-select" class="label">Hostname</label>
            <select
              id="hostname-select"
              :value="hostname"
              :disabled="loading"
              class="select"
              @input="$emit('update:hostname', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Select a host...</option>
              <option
                v-for="host in hostnames"
                :key="host"
                :value="host"
              >
                {{ host }}
              </option>
            </select>
          </div>

          <!-- Selected Host Info -->
          <div v-if="hostname" class="selected-host-info">
            <div class="info-item">
              <span class="info-label">Selected:</span>
              <span class="info-value">{{ hostname }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value status-active">Active</span>
            </div>
          </div>

          <!-- Actions -->
          <div v-if="hostname" class="actions">
            <button
              :disabled="loading"
              class="btn-primary"
              @click="$emit('host-change', hostname)"
            >
              <RefreshCw v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
              <Play v-else class="w-4 h-4 mr-2" />
              {{ loading ? 'Loading...' : 'Load Data' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, Play } from 'lucide-vue-next'

interface Props {
  hostname: string
  hostnames: string[]
  loading?: boolean
}

interface Emits {
  (e: 'update:hostname', value: string): void
  (e: 'host-change', hostname: string): void
}

withDefaults(defineProps<Props>(), {
  loading: false
})

defineEmits<Emits>()
</script>

<style scoped>
.host-selector {
  @apply w-full;
}

.card {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm;
  @apply theme-transition;
}

.card-header {
  @apply px-6 py-4 border-b border-gray-200 dark:border-gray-700;
}

.card-title {
  @apply text-lg font-semibold theme-text-primary;
}

.card-description {
  @apply text-sm theme-text-secondary mt-1;
}

.card-content {
  @apply px-6 py-4;
}

.label {
  @apply block text-sm font-medium theme-text-primary mb-2;
}

.select {
  @apply block w-full rounded-md border border-gray-300 dark:border-gray-600;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100;
  @apply px-3 py-2 shadow-sm;
  @apply focus:border-blue-500 focus:ring-blue-500 focus:ring-1;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply theme-transition;
}

.selected-host-info {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2;
}

.info-item {
  @apply flex items-center justify-between;
}

.info-label {
  @apply text-sm font-medium theme-text-secondary;
}

.info-value {
  @apply text-sm font-semibold theme-text-primary;
}

.status-active {
  @apply text-green-600 dark:text-green-400;
}

.actions {
  @apply pt-4;
}

.btn-primary {
  @apply inline-flex items-center px-4 py-2 text-sm font-medium text-white;
  @apply bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400;
  @apply border border-transparent rounded-md shadow-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
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

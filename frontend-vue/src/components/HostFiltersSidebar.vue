<template>
  <div class="host-filters-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <h3 class="text-lg font-semibold theme-text-primary mb-2">Filters</h3>
      <div class="flex items-center justify-between">
        <span class="text-sm theme-text-secondary">{{ activeFilterCount }} active</span>
        <button
          :disabled="activeFilterCount === 0"
          class="text-sm px-2 py-1 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          @click="clearAllFilters"
        >
          Clear All
        </button>
      </div>
    </div>

    <!-- Best/Worst Drives Summary -->
    <div class="best-worst-section mb-6">
      <h4 class="text-sm font-medium theme-text-primary mb-3">Drive Performance</h4>
      <div class="space-y-3">
        <div class="performance-card">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-green-600">Best IOPS</span>
            <span class="text-sm theme-text-primary">{{ bestIOPS.drive }}</span>
          </div>
          <div class="text-lg font-bold text-green-600">{{ bestIOPS.value.toLocaleString() }}</div>
        </div>
        <div class="performance-card">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-red-600">Worst Latency</span>
            <span class="text-sm theme-text-primary">{{ worstLatency.drive }}</span>
          </div>
          <div class="text-lg font-bold text-red-600">{{ (worstLatency.value * 1000).toFixed(2) }}ns</div>
        </div>
      </div>
    </div>

    <!-- Filter Sections -->
    <div class="filters-container space-y-6">
      <!-- Block Size Filter -->
      <div class="filter-section">
        <h4 class="filter-title">Block Size</h4>
        <div class="filter-options max-h-32 overflow-y-auto">
          <label
            v-for="size in availableBlockSizes"
            :key="size"
            class="filter-option"
          >
            <input
              v-model="localFilters.selectedBlockSizes"
              :value="size"
              type="checkbox"
              class="filter-checkbox"
            >
            <span class="filter-label">{{ size }}</span>
          </label>
        </div>
      </div>

      <!-- IO Pattern Filter -->
      <div class="filter-section">
        <h4 class="filter-title">IO Pattern</h4>
        <div class="filter-options">
          <label
            v-for="pattern in availablePatterns"
            :key="pattern"
            class="filter-option"
          >
            <input
              v-model="localFilters.selectedPatterns"
              :value="pattern"
              type="checkbox"
              class="filter-checkbox"
            >
            <span class="filter-label">{{ pattern.replace('_', ' ').toUpperCase() }}</span>
          </label>
        </div>
      </div>

      <!-- Queue Depth Filter -->
      <div class="filter-section">
        <h4 class="filter-title">Queue Depth</h4>
        <div class="filter-options max-h-32 overflow-y-auto">
          <label
            v-for="depth in availableQueueDepths"
            :key="depth"
            class="filter-option"
          >
            <input
              v-model="localFilters.selectedQueueDepths"
              :value="depth"
              type="checkbox"
              class="filter-checkbox"
            >
            <span class="filter-label">{{ depth }}</span>
          </label>
        </div>
      </div>

      <!-- Number of Jobs Filter -->
      <div class="filter-section">
        <h4 class="filter-title">Number of Jobs</h4>
        <div class="filter-options max-h-32 overflow-y-auto">
          <label
            v-for="jobs in availableNumJobs"
            :key="jobs"
            class="filter-option"
          >
            <input
              v-model="localFilters.selectedNumJobs"
              :value="jobs"
              type="checkbox"
              class="filter-checkbox"
            >
            <span class="filter-label">{{ jobs }}</span>
          </label>
        </div>
      </div>

      <!-- Protocol Filter -->
      <div class="filter-section">
        <h4 class="filter-title">Protocol</h4>
        <div class="filter-options">
          <label
            v-for="protocol in availableProtocols"
            :key="protocol"
            class="filter-option"
          >
            <input
              v-model="localFilters.selectedProtocols"
              :value="protocol"
              type="checkbox"
              class="filter-checkbox"
            >
            <span class="filter-label">{{ protocol.toUpperCase() }}</span>
          </label>
        </div>
      </div>

      <!-- Host-Disk Combination Filter -->
      <div class="filter-section">
        <h4 class="filter-title">Host-Disk Combinations</h4>
        <div class="filter-options max-h-40 overflow-y-auto">
          <label
            v-for="combo in availableHostDiskCombos"
            :key="combo"
            class="filter-option"
          >
            <input
              v-model="localFilters.selectedHostDiskCombinations"
              :value="combo"
              type="checkbox"
              class="filter-checkbox"
            >
            <span class="filter-label text-xs">{{ combo }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Filter Status -->
    <div class="filter-status mt-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div class="text-sm theme-text-primary mb-1">Filter Status</div>
      <div class="text-xs theme-text-secondary">
        <div>Showing {{ filteredCount }} of {{ totalCount }} configurations</div>
        <div v-if="activeFilterCount > 0" class="mt-1">
          Active filters: {{ activeFilterCount }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FilterState } from '@/types/filters'
import type { PerformanceData } from '@/types/performance'

interface Props {
  performanceData: PerformanceData[]
  filters: FilterState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:filters': [filters: FilterState]
}>()

// Local filter state
const localFilters = ref<FilterState>({ ...props.filters })

// Computed properties
const availableBlockSizes = computed(() => {
  const sizes = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.block_size) {
      sizes.add(typeof item.block_size === 'string' ? item.block_size : item.block_size.toString())
    }
  })
  return Array.from(sizes).sort()
})

const availablePatterns = computed(() => {
  const patterns = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.read_write_pattern) {
      patterns.add(item.read_write_pattern)
    }
  })
  return Array.from(patterns).sort()
})

const availableQueueDepths = computed(() => {
  const depths = new Set<number>()
  props.performanceData.forEach(item => {
    if (item.queue_depth) {
      depths.add(item.queue_depth)
    }
  })
  return Array.from(depths).sort((a, b) => a - b)
})

const availableNumJobs = computed(() => {
  const jobs = new Set<number>()
  props.performanceData.forEach(item => {
    if (item.num_jobs) {
      jobs.add(item.num_jobs)
    }
  })
  return Array.from(jobs).sort((a, b) => a - b)
})

const availableProtocols = computed(() => {
  const protocols = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.protocol) {
      protocols.add(item.protocol)
    }
  })
  return Array.from(protocols).sort()
})

const availableHostDiskCombos = computed(() => {
  const combos = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.hostname && item.drive_model) {
      combos.add(`${item.hostname} - ${item.drive_model}`)
    }
  })
  return Array.from(combos).sort()
})

const activeFilterCount = computed(() => {
  return (
    localFilters.value.selectedBlockSizes.length +
    localFilters.value.selectedPatterns.length +
    localFilters.value.selectedQueueDepths.length +
    localFilters.value.selectedNumJobs.length +
    localFilters.value.selectedProtocols.length +
    localFilters.value.selectedHostDiskCombinations.length
  )
})

const filteredCount = computed(() => {
  // Apply filters to count
  return props.performanceData.filter(item => {
    if (localFilters.value.selectedBlockSizes.length > 0) {
      const blockSize = typeof item.block_size === 'string' ? item.block_size : item.block_size?.toString()
      if (!blockSize || !localFilters.value.selectedBlockSizes.includes(blockSize)) {
        return false
      }
    }

    if (localFilters.value.selectedPatterns.length > 0 &&
        (!item.read_write_pattern || !localFilters.value.selectedPatterns.includes(item.read_write_pattern))) {
      return false
    }

    if (localFilters.value.selectedQueueDepths.length > 0 &&
        (!item.queue_depth || !localFilters.value.selectedQueueDepths.includes(item.queue_depth))) {
      return false
    }

    if (localFilters.value.selectedNumJobs.length > 0 &&
        (!item.num_jobs || !localFilters.value.selectedNumJobs.includes(item.num_jobs))) {
      return false
    }

    if (localFilters.value.selectedProtocols.length > 0 &&
        (!item.protocol || !localFilters.value.selectedProtocols.includes(item.protocol))) {
      return false
    }

    if (localFilters.value.selectedHostDiskCombinations.length > 0) {
      const combo = item.hostname && item.drive_model ? `${item.hostname} - ${item.drive_model}` : ''
      if (!combo || !localFilters.value.selectedHostDiskCombinations.includes(combo)) {
        return false
      }
    }

    return true
  }).length
})

const totalCount = computed(() => props.performanceData.length)

const bestIOPS = computed(() => {
  let best = { drive: 'N/A', value: 0 }
  const driveMap = new Map<string, number[]>()

  props.performanceData.forEach(item => {
    if (item.iops && item.hostname && item.drive_model) {
      const key = `${item.hostname} - ${item.drive_model}`
      if (!driveMap.has(key)) {
        driveMap.set(key, [])
      }
      driveMap.get(key)!.push(item.iops)
    }
  })

  driveMap.forEach((iopsValues, drive) => {
    const avgIOPS = iopsValues.reduce((sum, val) => sum + val, 0) / iopsValues.length
    if (avgIOPS > best.value) {
      best = { drive, value: Math.round(avgIOPS) }
    }
  })

  return best
})

const worstLatency = computed(() => {
  let worst = { drive: 'N/A', value: 0 }
  const driveMap = new Map<string, number[]>()

  props.performanceData.forEach(item => {
    if (item.avg_latency && item.hostname && item.drive_model) {
      const key = `${item.hostname} - ${item.drive_model}`
      if (!driveMap.has(key)) {
        driveMap.set(key, [])
      }
      driveMap.get(key)!.push(item.avg_latency)
    }
  })

  driveMap.forEach((latencyValues, drive) => {
    const avgLatency = latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length
    if (avgLatency > worst.value) {
      worst = { drive, value: avgLatency }
    }
  })

  return worst
})

// Methods
const clearAllFilters = () => {
  localFilters.value = {
    selectedBlockSizes: [],
    selectedPatterns: [],
    selectedQueueDepths: [],
    selectedNumJobs: [],
    selectedProtocols: [],
    selectedHostDiskCombinations: []
  }
}

// Watch for local filter changes and emit updates
watch(localFilters, (newFilters) => {
  emit('update:filters', newFilters)
}, { deep: true })

// Watch for prop changes and update local state
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
}, { deep: true, immediate: true })
</script>

<style scoped>
.host-filters-sidebar {
  @apply w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6;
}

.sidebar-header {
  @apply border-b border-gray-200 dark:border-gray-700 pb-4 mb-4;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-white;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-300;
}

.best-worst-section {
  @apply p-4 bg-gray-50 dark:bg-gray-800 rounded-lg;
}

.performance-card {
  @apply p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md;
}

.filter-section {
  @apply border-b border-gray-100 dark:border-gray-700 pb-4 last:border-b-0;
}

.filter-title {
  @apply text-sm font-medium theme-text-primary mb-3 flex items-center;
}

.filter-options {
  @apply space-y-2;
}

.filter-option {
  @apply flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded;
}

.filter-checkbox {
  @apply w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600;
}

.filter-label {
  @apply text-sm theme-text-primary;
}

.filter-status {
  @apply border-t border-gray-200 dark:border-gray-700 pt-4;
}
</style>

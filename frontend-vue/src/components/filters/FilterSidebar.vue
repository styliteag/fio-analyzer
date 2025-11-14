<template>
  <div class="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-900">Filters</h2>
        <button
          v-if="filtersStore.hasActiveFilters"
          @click="filtersStore.clearAllFilters"
          class="text-sm text-blue-600 hover:text-blue-700"
          type="button"
        >
          Clear All
        </button>
      </div>

      <!-- Drive Types -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Drive Type
        </label>
        <MultiSelect
          v-model="driveTypesModel"
          :options="filtersStore.available.drive_types"
          placeholder="Select drive types..."
        />
      </div>

      <!-- Patterns (Read/Write) -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          I/O Pattern
        </label>
        <MultiSelect
          v-model="patternsModel"
          :options="filtersStore.available.patterns"
          placeholder="Select patterns..."
        />
      </div>

      <!-- Block Sizes -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Block Size
        </label>
        <MultiSelect
          v-model="blockSizesModel"
          :options="filtersStore.available.block_sizes"
          placeholder="Select block sizes..."
        />
      </div>

      <!-- Queue Depths -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Queue Depth
        </label>
        <MultiSelect
          v-model="queueDepthsModel"
          :options="filtersStore.available.queue_depths"
          placeholder="Select queue depths..."
        />
      </div>

      <!-- Protocols -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Protocol
        </label>
        <MultiSelect
          v-model="protocolsModel"
          :options="filtersStore.available.protocols"
          placeholder="Select protocols..."
        />
      </div>

      <!-- Drive Models -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Drive Model
        </label>
        <MultiSelect
          v-model="driveModelsModel"
          :options="filtersStore.available.drive_models"
          placeholder="Select drive models..."
        />
      </div>

      <!-- Direct I/O -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Direct I/O
        </label>
        <MultiSelect
          v-model="directsModel"
          :options="directOptions"
          placeholder="All (0=Buffered, 1=Direct)"
        />
        <p class="text-xs text-gray-500 mt-1">0 = Buffered, 1 = Direct I/O</p>
      </div>

      <!-- Sync -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Sync Mode
        </label>
        <MultiSelect
          v-model="syncsModel"
          :options="syncOptions"
          placeholder="All (0=Async, 1=Sync)"
        />
        <p class="text-xs text-gray-500 mt-1">0 = Async, 1 = Sync</p>
      </div>

      <!-- Active Filter Count -->
      <div v-if="filtersStore.hasActiveFilters" class="pt-4 border-t border-gray-200">
        <p class="text-sm text-gray-600">
          <span class="font-semibold">{{ filtersStore.activeFilterCount }}</span>
          {{ filtersStore.activeFilterCount === 1 ? 'filter' : 'filters' }} active
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '../../stores/filters'
import MultiSelect from '../ui/MultiSelect.vue'

const filtersStore = useFiltersStore()

// Options for direct and sync (0 or 1)
const directOptions = [0, 1]
const syncOptions = [0, 1]

// Computed models for two-way binding
const driveTypesModel = computed({
  get: () => filtersStore.active.drive_types,
  set: (value) => filtersStore.setFilter('drive_types', value)
})

const patternsModel = computed({
  get: () => filtersStore.active.patterns,
  set: (value) => filtersStore.setFilter('patterns', value)
})

const blockSizesModel = computed({
  get: () => filtersStore.active.block_sizes,
  set: (value) => filtersStore.setFilter('block_sizes', value)
})

const queueDepthsModel = computed({
  get: () => filtersStore.active.queue_depths,
  set: (value) => filtersStore.setFilter('queue_depths', value)
})

const protocolsModel = computed({
  get: () => filtersStore.active.protocols,
  set: (value) => filtersStore.setFilter('protocols', value)
})

const driveModelsModel = computed({
  get: () => filtersStore.active.drive_models,
  set: (value) => filtersStore.setFilter('drive_models', value)
})

const directsModel = computed({
  get: () => filtersStore.active.directs,
  set: (value) => filtersStore.setFilter('directs', value)
})

const syncsModel = computed({
  get: () => filtersStore.active.syncs,
  set: (value) => filtersStore.setFilter('syncs', value)
})
</script>

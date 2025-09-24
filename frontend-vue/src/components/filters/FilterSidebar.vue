<template>
  <div class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        Filters
      </h2>

      <div class="flex items-center space-x-2">
        <button
          class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="'Reset all filters'"
          @click="resetFilters"
        >
          <RotateCcwIcon class="w-4 h-4" />
        </button>

        <button
          v-if="collapsible"
          class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="isCollapsed ? 'Expand filters' : 'Collapse filters'"
          @click="toggleCollapsed"
        >
          <ChevronLeftIcon class="w-4 h-4" :class="{ 'rotate-180': isCollapsed }" />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div
      v-show="!isCollapsed"
      class="flex-1 overflow-y-auto p-6 space-y-6"
    >
      <!-- Active filters summary -->
      <ActiveFilters />

      <!-- Host selector -->
      <HostSelector
        v-model="selectedHosts"
        @update:model-value="updateHostsFilter"
      />

      <!-- Other filter sections -->
      <div class="space-y-4">
        <!-- Drive Types -->
        <FilterSection
          title="Drive Types"
          :options="availableFilters.drive_types"
          :selected="selectedDriveTypes"
          @update:selected="updateDriveTypesFilter"
        />

        <!-- Protocols -->
        <FilterSection
          title="Protocols"
          :options="availableFilters.protocols"
          :selected="selectedProtocols"
          @update:selected="updateProtocolsFilter"
        />

        <!-- Block Sizes -->
        <FilterSection
          title="Block Sizes"
          :options="availableFilters.block_sizes"
          :selected="selectedBlockSizes"
          @update:selected="updateBlockSizesFilter"
        />

        <!-- I/O Patterns -->
        <FilterSection
          title="I/O Patterns"
          :options="availableFilters.patterns"
          :selected="selectedPatterns"
          @update:selected="updatePatternsFilter"
        />

        <!-- Queue Depths -->
        <FilterSection
          title="Queue Depths"
          :options="availableFilters.queue_depths?.map(String)"
          :selected="selectedQueueDepths?.map(String)"
          @update:selected="updateQueueDepthsFilter"
        />

        <!-- Job Counts -->
        <FilterSection
          title="Job Counts"
          :options="availableFilters.num_jobs?.map(String)"
          :selected="selectedNumJobs?.map(String)"
          @update:selected="updateNumJobsFilter"
        />
      </div>

      <!-- Advanced filters toggle -->
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          class="flex items-center justify-between w-full text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          @click="showAdvanced = !showAdvanced"
        >
          <span class="font-medium">Advanced Filters</span>
          <ChevronDownIcon class="w-4 h-4" :class="{ 'rotate-180': showAdvanced }" />
        </button>

        <div
          v-if="showAdvanced"
          class="mt-4 space-y-4"
        >
          <!-- Sync Modes -->
          <FilterSection
            title="Sync Modes"
            :options="availableFilters.syncs?.map(String)"
            :selected="selectedSyncs?.map(String)"
            @update:selected="updateSyncsFilter"
          />

          <!-- Direct I/O -->
          <FilterSection
            title="Direct I/O"
            :options="availableFilters.directs?.map(String)"
            :selected="selectedDirects?.map(String)"
            @update:selected="updateDirectsFilter"
          />

          <!-- Test Sizes -->
          <FilterSection
            title="Test Sizes"
            :options="availableFilters.test_sizes"
            :selected="selectedTestSizes"
            @update:selected="updateTestSizesFilter"
          />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div
      v-show="!isCollapsed"
      class="border-t border-gray-200 dark:border-gray-700 p-4"
    >
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{{ filteredResultsCount }} results</span>
        <span>Last updated: {{ formatRelativeTime(lastUpdated) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFiltersStore } from '@/stores/filters'
import { useTestRunsStore } from '@/stores/testRuns'
import { formatRelativeTime } from '@/utils/formatters'
import FilterSection from './FilterSection.vue'
import HostSelector from './HostSelector.vue'
import ActiveFilters from './ActiveFilters.vue'
import { RotateCcw as RotateCcwIcon, ChevronLeft as ChevronLeftIcon, ChevronDown as ChevronDownIcon } from 'lucide-vue-next'

interface Props {
  collapsible?: boolean
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: true,
  collapsed: false,
})

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()

const filtersStore = useFiltersStore()
const testRunsStore = useTestRunsStore()

const isCollapsed = computed({
  get: () => props.collapsed,
  set: (value) => emit('update:collapsed', value),
})

const showAdvanced = ref(false)

// Computed properties
const availableFilters = computed(() => filtersStore.state.available || {
  drive_types: [],
  protocols: [],
  block_sizes: [],
  patterns: [],
  queue_depths: [],
  num_jobs: [],
  syncs: [],
  directs: [],
  test_sizes: [],
})

const filteredResultsCount = computed(() => {
  // In a real implementation, this would be the count after applying filters
  return testRunsStore.state.data.length
})

const lastUpdated = computed(() => filtersStore.state.lastUpdated || new Date())

// Computed properties for selected values from store
const selectedHosts = computed(() => filtersStore.state.active.hostnames || [])
const selectedDriveTypes = computed(() => filtersStore.state.active.drive_types || [])
const selectedProtocols = computed(() => filtersStore.state.active.protocols || [])
const selectedBlockSizes = computed(() => filtersStore.state.active.block_sizes || [])
const selectedPatterns = computed(() => filtersStore.state.active.patterns || [])
const selectedQueueDepths = computed(() => filtersStore.state.active.queue_depths || [])
const selectedNumJobs = computed(() => filtersStore.state.active.num_jobs || [])
const selectedSyncs = computed(() => filtersStore.state.active.syncs || [])
const selectedDirects = computed(() => filtersStore.state.active.directs || [])
const selectedTestSizes = computed(() => filtersStore.state.active.test_sizes || [])

// Methods
function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value
}

function resetFilters() {
  filtersStore.resetFilters()
}

// Filter update methods
function updateHostsFilter(hosts: string[]) {
  filtersStore.setFilter('hostnames', hosts)
}

function updateDriveTypesFilter(types: string[]) {
  filtersStore.setFilter('drive_types', types)
}

function updateProtocolsFilter(protocols: string[]) {
  filtersStore.setFilter('protocols', protocols)
}

function updateBlockSizesFilter(sizes: string[]) {
  filtersStore.setFilter('block_sizes', sizes)
}

function updatePatternsFilter(patterns: string[]) {
  filtersStore.setFilter('patterns', patterns)
}

function updateQueueDepthsFilter(depths: string[]) {
  const numericDepths = depths.map(d => parseInt(d)).filter(d => !isNaN(d))
  filtersStore.setFilter('queue_depths', numericDepths)
}

function updateNumJobsFilter(jobs: string[]) {
  const numericJobs = jobs.map(j => parseInt(j)).filter(j => !isNaN(j))
  filtersStore.setFilter('num_jobs', numericJobs)
}

function updateSyncsFilter(syncs: string[]) {
  const numericSyncs = syncs.map(s => parseInt(s)).filter(s => !isNaN(s))
  filtersStore.setFilter('syncs', numericSyncs)
}

function updateDirectsFilter(directs: string[]) {
  const numericDirects = directs.map(d => parseInt(d)).filter(d => !isNaN(d))
  filtersStore.setFilter('directs', numericDirects)
}

function updateTestSizesFilter(sizes: string[]) {
  filtersStore.setFilter('test_sizes', sizes)
}
</script>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
}
</style>

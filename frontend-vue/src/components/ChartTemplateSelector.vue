<template>
  <div class="chart-template-selector">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Chart Type</h3>
      <div class="flex space-x-2">
        <button
          v-for="template in chartTemplates"
          :key="template.id"
          :class="[
            'px-3 py-2 text-sm font-medium rounded-md transition-colors',
            selectedTemplate === template.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
          @click="selectTemplate(template.id)"
        >
          {{ template.name }}
        </button>
      </div>
    </div>

    <!-- Legacy select for backward compatibility -->
    <div class="legacy-selector mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Performance Metric
      </label>
      <select v-model="model" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
        <option value="iops">IOPS Performance</option>
        <option value="bw">Bandwidth Performance</option>
        <option value="latency">Latency Performance</option>
      </select>
    </div>

    <!-- Chart options based on selected template -->
    <div v-if="selectedTemplate === 'radar'" class="chart-options">
      <label class="block text-sm font-medium text-gray-700 mb-2">Display Options</label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input
            v-model="options.showLabels"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700">Show metric labels</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="options.fillArea"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700">Fill radar area</span>
        </label>
      </div>
    </div>

    <div v-if="selectedTemplate === 'line'" class="chart-options">
      <label class="block text-sm font-medium text-gray-700 mb-2">Line Chart Options</label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input
            v-model="options.smooth"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700">Smooth curves</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="options.showArea"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700">Fill area under lines</span>
        </label>
      </div>
    </div>

    <div v-if="selectedTemplate === 'bar3d'" class="chart-options">
      <label class="block text-sm font-medium text-gray-700 mb-2">3D Chart Options</label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input
            v-model="options.autoRotate"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700">Auto-rotate view</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface ChartTemplate {
  id: string
  name: string
  description: string
}

interface ChartOptions {
  showLabels?: boolean
  fillArea?: boolean
  smooth?: boolean
  showArea?: boolean
  autoRotate?: boolean
}

const props = defineProps<{
  modelValue: 'iops' | 'bw' | 'latency'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'iops' | 'bw' | 'latency']
  'template-change': [template: string]
  'options-change': [options: ChartOptions]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const selectedTemplate = ref('radar')
const options = ref<ChartOptions>({
  showLabels: true,
  fillArea: false,
  smooth: true,
  showArea: false,
  autoRotate: true
})

const chartTemplates: ChartTemplate[] = [
  { id: 'radar', name: 'Radar', description: 'Multi-metric comparison' },
  { id: 'line', name: 'Line', description: 'Time series data' },
  { id: 'bar3d', name: '3D Bars', description: 'Interactive 3D visualization' },
  { id: 'comparison', name: 'Comparison', description: 'IOPS vs Latency comparison' }
]

const selectTemplate = (templateId: string) => {
  selectedTemplate.value = templateId
  emit('template-change', templateId)
}

watch(options, (newOptions) => {
  emit('options-change', newOptions)
}, { deep: true })
</script>

<style scoped>
.chart-template-selector {
  @apply bg-white rounded-lg border border-gray-200 p-4;
}

.chart-options {
  @apply mt-4 p-3 bg-gray-50 rounded-md;
}
</style>



<template>
  <main style="padding:16px; display:grid; gap:12px">
    <h1>Filters</h1>

    <section v-if="filters">
      <label>
        Drive Type
        <select v-model="driveType" aria-label="Drive Type">
          <option value="">Any</option>
          <option v-for="opt in (filters.drive_types || [])" :key="String(opt)" :value="String(opt)">
            {{ String(opt) }}
          </option>
        </select>
      </label>

      <label>
        Drive Model
        <select v-model="driveModel" aria-label="Drive Model">
          <option value="">Any</option>
          <option v-for="opt in (filters.drive_models || [])" :key="String(opt)" :value="String(opt)">
            {{ String(opt) }}
          </option>
        </select>
      </label>

      <label>
        Pattern
        <select v-model="pattern" aria-label="Pattern">
          <option value="">Any</option>
          <option v-for="opt in (filters.read_write_patterns || [])" :key="String(opt)" :value="String(opt)">
            {{ String(opt) }}
          </option>
        </select>
      </label>

      <label>
        Block Size
        <select v-model="blockSize" aria-label="Block Size">
          <option value="">Any</option>
          <option v-for="opt in (filters.block_sizes || [])" :key="String(opt)" :value="String(opt)">
            {{ String(opt) }}
          </option>
        </select>
      </label>

      <div>
        <button class="button" @click="apply">Apply</button>
        <span style="margin-left:8px">Current: {{ summary }}</span>
      </div>
    </section>

    <pre v-else>{{ filters }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { getJson } from '../services/api';

type FiltersResponse = {
  drive_types?: string[];
  drive_models?: string[];
  read_write_patterns?: string[];
  block_sizes?: string[];
} | { error: string } | null;
const filters = ref<FiltersResponse>(null);
const driveType = ref('');
const driveModel = ref('');
const pattern = ref('');
const blockSize = ref('');

onMounted(async () => {
  try {
    filters.value = await getJson('/api/filters');
  } catch (e) {
    filters.value = { error: String(e) };
  }
});

const summary = computed(() => {
  return [driveType.value, driveModel.value, pattern.value, blockSize.value]
    .filter(Boolean)
    .join(' / ') || 'Any';
});

function apply() {
  // Placeholder: integrate with list pages via route/query in future steps
}
</script>



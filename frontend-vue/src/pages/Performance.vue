<template>
  <main style="padding:16px">
    <h1>Performance Data</h1>
    <label>
      Test Run IDs (comma-separated):
      <input v-model="idsInput" placeholder="1,2" />
    </label>
    <button @click="load">Load</button>
    <pre v-if="data">{{ data }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getJson } from '../services/api';

const idsInput = ref('');
const data = ref<any>(null);

async function load() {
  data.value = null;
  const query = new URLSearchParams();
  if (idsInput.value.trim()) query.set('test_run_ids', idsInput.value.trim());
  try {
    data.value = await getJson(`/api/test-runs/performance-data?${query.toString()}`);
  } catch (e) {
    data.value = { error: String(e) };
  }
}
</script>



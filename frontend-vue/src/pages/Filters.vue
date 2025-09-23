<template>
  <main style="padding:16px">
    <h1>Filters</h1>
    <pre v-if="filters">{{ filters }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getJson } from '../services/api';

const filters = ref<any>(null);

onMounted(async () => {
  try {
    filters.value = await getJson('/api/filters');
  } catch (e) {
    filters.value = { error: String(e) };
  }
});
</script>



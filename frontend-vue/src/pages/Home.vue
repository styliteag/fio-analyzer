<template>
  <main style="padding:16px">
    <h1>FIO Analyzer (Vue)</h1>
    <p>API Base: {{ apiBase }}</p>
    <div v-if="info"><pre>{{ info }}</pre></div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Api } from '../services/api';

const apiBase = import.meta.env.VITE_API_URL || '';
const info = ref<any>(null);

onMounted(async () => {
  try {
    info.value = await Api.info();
  } catch (e) {
    info.value = { error: String(e) };
  }
});
</script>



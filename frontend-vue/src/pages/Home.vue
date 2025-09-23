<template>
  <main class="grid-responsive app-main">
    <h1 style="grid-column:1/-1">FIO Analyzer (Vue)</h1>
    <p style="grid-column:1/-1">API Base: {{ apiBase }}</p>
    <div v-if="info" style="grid-column:1/-1">
      <pre>{{ info }}</pre>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Api } from '../services/api';

const apiBase = import.meta.env.VITE_API_URL || '';
interface InfoResponse { [key: string]: unknown }
const info = ref<InfoResponse | { error: string } | null>(null);

onMounted(async () => {
  try {
    info.value = await Api.info();
  } catch (e) {
    info.value = { error: String(e) };
  }
});
</script>



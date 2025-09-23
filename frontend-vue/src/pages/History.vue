<template>
  <main style="padding:16px">
    <h1>Time Series</h1>
    <button @click="load('servers')">
      Servers
    </button>
    <button @click="load('latest')">
      Latest
    </button>
    <button @click="load('history')">
      History
    </button>
    <button @click="load('trends')">
      Trends
    </button>
    <pre v-if="data">{{ data }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getJson } from '../services/api';

type TSResponse = Record<string, unknown>;
const data = ref<TSResponse | { error: string } | null>(null);

async function load(kind: 'servers'|'latest'|'history'|'trends') {
  data.value = null;
  try {
    data.value = await getJson(`/api/time-series/${kind}`);
  } catch (e) {
    data.value = { error: String(e) };
  }
}
</script>



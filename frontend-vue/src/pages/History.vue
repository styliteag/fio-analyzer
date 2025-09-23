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
import { Api } from '../services/api';

type TSResponse = Record<string, unknown>;
const data = ref<TSResponse | { error: string } | null>(null);

async function load(kind: 'servers'|'latest'|'history'|'trends') {
  data.value = null;
  try {
    if (kind === 'servers') data.value = await Api.timeSeriesServers();
    else if (kind === 'latest') data.value = await Api.timeSeriesLatest();
    else if (kind === 'history') data.value = await Api.timeSeriesHistory({});
    else if (kind === 'trends') data.value = await Api.timeSeriesTrends({});
  } catch (e) {
    data.value = { error: String(e) };
  }
}
</script>



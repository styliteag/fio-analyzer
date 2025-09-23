<template>
  <main style="padding:16px">
    <h1>Performance Data</h1>
    <TestRunMultiSelect v-model="selectedIds" />
    <div class="flex gap-2 items-end">
      <ChartTemplateSelector v-model="template" />
      <button class="button" @click="load">Load</button>
    </div>
    <pre v-if="data">{{ data }}</pre>
    <section v-if="chartData">
      <h2>IOPS</h2>
      <BasicLineChart :data="chartData" />
    </section>
    <section v-if="latencyChartData">
      <h2>Latency (avg / p95 / p99)</h2>
      <BasicLineChart :data="latencyChartData" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getJson } from '../services/api';
import BasicLineChart from '../components/BasicLineChart.vue';
import TestRunMultiSelect from '../components/TestRunMultiSelect.vue';
import ChartTemplateSelector from '../components/ChartTemplateSelector.vue';

const selectedIds = ref<number[]>([]);
const template = ref<'iops'|'bw'|'latency'>('iops');
type PerfResponse = {
  timestamps?: number[];
  iops?: number[];
  latencyAvg?: number[];
  latencyP95?: number[];
  latencyP99?: number[];
} | { error: string } | null;
const data = ref<PerfResponse>(null);

async function load() {
  data.value = null;
  const query = new URLSearchParams();
  if (selectedIds.value.length) query.set('test_run_ids', selectedIds.value.join(','));
  try {
    data.value = await getJson(`/api/test-runs/performance-data?${query.toString()}`);
  } catch (e) {
    data.value = { error: String(e) };
  }
}

const chartData = computed(() => {
  if (!data.value) return null;
  const labels = data.value.timestamps || [];
  if (template.value === 'iops') {
    const iops = data.value.iops || [];
    return { labels, datasets: [{ label: 'IOPS', data: iops, borderColor: '#3366cc', tension: 0.1 }] };
  }
  if (template.value === 'bw') {
    const bw = (data.value && 'error' in data.value ? [] : (data.value?.['bandwidth'] as number[] | undefined)) || [];
    return { labels, datasets: [{ label: 'Bandwidth', data: bw, borderColor: '#16a34a', tension: 0.1 }] };
  }
  return null;
});

const latencyChartData = computed(() => {
  if (!data.value || 'error' in data.value) return null;
  const labels = data.value.timestamps || [];
  const avg = data.value.latencyAvg || [];
  const p95 = data.value.latencyP95 || [];
  const p99 = data.value.latencyP99 || [];
  if (!avg.length && !p95.length && !p99.length) return null;
  return {
    labels,
    datasets: [
      { label: 'Avg (ms)', data: avg, borderColor: '#888', tension: 0.1 },
      { label: 'P95 (ms)', data: p95, borderColor: '#e69138', tension: 0.1 },
      { label: 'P99 (ms)', data: p99, borderColor: '#cc0000', tension: 0.1 },
    ],
  };
});
</script>



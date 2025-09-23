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
      <ExportButtons @export="onExport('iops', $event)" />
      <FullscreenContainer>
        <BasicLineChart :data="chartData" />
      </FullscreenContainer>
    </section>
    <section v-if="latencyChartData">
      <h2>Latency (avg / p95 / p99)</h2>
      <ExportButtons @export="onExport('latency', $event)" />
      <FullscreenContainer>
        <BasicLineChart :data="latencyChartData" />
      </FullscreenContainer>
    </section>
    <section v-if="radarData">
      <h2>Radar</h2>
      <ExportButtons @export="onExport('iops', $event)" />
      <FullscreenContainer>
        <RadarChart :data="radarData" />
      </FullscreenContainer>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Api } from '../services/api';
import BasicLineChart from '../components/BasicLineChart.vue';
import RadarChart from '../components/RadarChart.vue';
import FullscreenContainer from '../components/FullscreenContainer.vue';
import ExportButtons from '../components/ExportButtons.vue';
import TestRunMultiSelect from '../components/TestRunMultiSelect.vue';
import ChartTemplateSelector from '../components/ChartTemplateSelector.vue';

const selectedIds = ref<number[]>([]);
const template = ref<'iops'|'bw'|'latency'|'radar'>('iops');
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
    data.value = await Api.performanceData({ test_run_ids: selectedIds.value });
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

type RadarDataset = { label: string; data: number[]; borderColor?: string; backgroundColor?: string };
type RadarPayload = { labels: string[]; datasets: RadarDataset[] } | null;
const radarData = computed<RadarPayload>(() => {
  if (!data.value || 'error' in data.value) return null;
  const labels = ['IOPS', 'Avg Latency', 'P95', 'P99'];
  const iops = (data.value as Record<string, unknown>)?.['iops'] as number[] | undefined || [];
  const avg = (data.value as Record<string, unknown>)?.['latencyAvg'] as number[] | undefined || [];
  const p95 = (data.value as Record<string, unknown>)?.['latencyP95'] as number[] | undefined || [];
  const p99 = (data.value as Record<string, unknown>)?.['latencyP99'] as number[] | undefined || [];
  if (!iops.length && !avg.length && !p95.length && !p99.length) return null;
  const datasets: RadarDataset[] = [
    { label: 'Metrics', data: [iops[0] || 0, avg[0] || 0, p95[0] || 0, p99[0] || 0], borderColor: '#4c6ef5', backgroundColor: 'rgba(76,110,245,0.2)' },
  ];
  return { labels, datasets };
});

function onExport(which: 'iops'|'latency', format: 'png'|'csv') {
  const payload = which === 'iops' ? chartData.value : latencyChartData.value;
  if (!payload) return;
  if (format === 'csv') {
    const rows: string[] = [];
    const labels = (payload as { labels?: unknown[] } | null)?.labels || [];
    const datasets = (payload as { datasets?: Array<{ label: string; data: unknown[] }> } | null)?.datasets || [];
    rows.push(['label', ...labels].join(','));
    for (const ds of datasets) {
      rows.push([ds.label, ...(ds.data || [])].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${which}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    // Let user use browser's built-in screenshot of canvas via toDataURL
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const a = document.createElement('a');
      a.href = (canvas as HTMLCanvasElement).toDataURL('image/png');
      a.download = `${which}.png`;
      a.click();
    }
  }
}
</script>



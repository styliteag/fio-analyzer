<template>
  <Line
    :data="data"
    :options="resolvedOptions"
  />
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation,
} from 'chart.js';

import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Decimation);

const props = defineProps<{ data: ChartData; options?: ChartOptions }>();
const resolvedOptions = computed<ChartOptions>(() => (
  props.options ?? {
    parsing: false,
    animation: false,
    elements: { point: { radius: 0 } },
    plugins: { decimation: { enabled: true, algorithm: 'lttb', samples: 1000 } },
  }
));

</script>

<script lang="ts">
export default {};
</script>



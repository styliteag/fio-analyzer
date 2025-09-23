<template>
  <line :data="data" :options="options" />
</template>

<script setup lang="ts">
import { Line as line } from 'vue-chartjs';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Decimation);

defineProps<{ data: any; options?: any }>();

</script>

<script lang="ts">
export default {
  computed: {
    options(): any {
      // Provide sensible defaults for performance; allow caller override
      return (
        (this as any).$props.options || {
          parsing: false,
          animation: false,
          elements: { point: { radius: 0 } },
          plugins: { decimation: { enabled: true, algorithm: 'lttb', samples: 1000 } },
        }
      );
    },
  },
};
</script>



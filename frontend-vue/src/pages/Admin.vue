<template>
  <main style="padding:16px">
    <h1>Admin Users</h1>
    <pre v-if="users">{{ users }}</pre>
  </main>
  
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getJson } from '../services/api';

const users = ref<any>(null);

onMounted(async () => {
  try {
    users.value = await getJson('/api/users/');
  } catch (e) {
    users.value = { error: String(e) };
  }
});
</script>



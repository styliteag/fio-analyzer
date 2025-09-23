<template>
  <main style="padding:16px">
    <h1>Login</h1>
    <form @submit.prevent="login">
      <input
        v-model="username"
        placeholder="username"
      >
      <input
        v-model="password"
        placeholder="password"
        type="password"
      >
      <button>Login</button>
    </form>
    <pre v-if="me">{{ me }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { setBasicAuth, Api } from '../services/api';

const username = ref('');
const password = ref('');
type MeResponse = { username: string; role: string } | { error: string } | null;
const me = ref<MeResponse>(null);

async function login() {
  setBasicAuth(username.value, password.value);
  try {
    me.value = await Api.me();
  } catch (e) {
    me.value = { error: String(e) };
  }
}
</script>



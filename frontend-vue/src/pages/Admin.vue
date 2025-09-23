<template>
  <main style="padding:16px">
    <h1>Admin Users</h1>
    <form @submit.prevent="create">
      <input
        v-model="newUser"
        placeholder="username"
      >
      <input
        v-model="newPass"
        type="password"
        placeholder="password"
      >
      <button>Create</button>
    </form>
    <ul v-if="users?.length">
      <li
        v-for="u in users"
        :key="u.username"
      >
        {{ u.username }} ({{ u.role }})
        <button @click="remove(u.username)">
          Delete
        </button>
        <button @click="promptUpdate(u.username)">
          Set Password
        </button>
      </li>
    </ul>
    <pre v-else>{{ users }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getJson, Api } from '../services/api';

interface UserRow { username: string; role?: string }
const users = ref<UserRow[]>([]);
const newUser = ref('');
const newPass = ref('');

async function load() {
  try {
    users.value = await getJson<UserRow[]>('/api/users/');
  } catch (e) {
    users.value = [];
  }
}

async function create() {
  if (!newUser.value || !newPass.value) return;
  await Api.createUser(newUser.value, newPass.value);
  newUser.value = '';
  newPass.value = '';
  await load();
}

async function remove(username: string) {
  await Api.deleteUser(username);
  await load();
}

async function promptUpdate(username: string) {
  const pass = window.prompt(`Set new password for ${username}`) || '';
  if (!pass) return;
  await Api.updateUser(username, pass);
  await load();
}

onMounted(load);
</script>



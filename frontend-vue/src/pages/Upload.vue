<template>
  <main style="padding:16px">
    <h1>Upload FIO JSON</h1>
    <form @submit.prevent="submit">
      <input
        type="file"
        accept="application/json"
        @change="onFile"
      >
      <input
        v-model="drive_model"
        placeholder="drive_model"
      >
      <input
        v-model="drive_type"
        placeholder="drive_type"
      >
      <input
        v-model="hostname"
        placeholder="hostname"
      >
      <input
        v-model="protocol"
        placeholder="protocol"
      >
      <input
        v-model="description"
        placeholder="description"
      >
      <button :disabled="!file">
        Upload
      </button>
    </form>
    <pre v-if="result">{{ JSON.stringify(result, null, 2) }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Api } from '../services/api';

const file = ref<File | null>(null);
const drive_model = ref('');
const drive_type = ref('');
const hostname = ref('');
const protocol = ref('');
const description = ref('');
type UploadResult = Record<string, unknown> | { error: string } | null;
const result = ref<UploadResult>(null);

function onFile(e: Event) {
  const t = e.target as HTMLInputElement;
  file.value = (t.files && t.files[0]) || null;
}

async function submit() {
  if (!file.value) return;
  const form = new FormData();
  form.append('file', file.value);
  form.append('drive_model', drive_model.value);
  form.append('drive_type', drive_type.value);
  form.append('hostname', hostname.value);
  form.append('protocol', protocol.value);
  form.append('description', description.value);
  try {
    const res = await Api.uploadImport(form);
    result.value = res;
  } catch (e) {
    result.value = { error: String(e) };
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between max-w-4xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900">Upload FIO Test Data</h1>
        <router-link to="/" class="btn-secondary">
          Back to Comparison
        </router-link>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto p-6">
      <div class="card">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- File Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              FIO JSON Output File *
            </label>
            <input
              type="file"
              accept=".json"
              @change="handleFileChange"
              required
              class="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            <p class="mt-1 text-sm text-gray-500">
              Upload the JSON output file from your FIO benchmark test
            </p>
          </div>

          <!-- Hostname -->
          <div>
            <label for="hostname" class="block text-sm font-medium text-gray-700 mb-1">
              Hostname *
            </label>
            <input
              id="hostname"
              v-model="formData.hostname"
              type="text"
              required
              class="input-field"
              placeholder="e.g., server-01"
            />
          </div>

          <!-- Drive Model -->
          <div>
            <label for="drive_model" class="block text-sm font-medium text-gray-700 mb-1">
              Drive Model *
            </label>
            <input
              id="drive_model"
              v-model="formData.drive_model"
              type="text"
              required
              class="input-field"
              placeholder="e.g., Samsung SSD 980 PRO"
            />
          </div>

          <!-- Drive Type -->
          <div>
            <label for="drive_type" class="block text-sm font-medium text-gray-700 mb-1">
              Drive Type *
            </label>
            <select
              id="drive_type"
              v-model="formData.drive_type"
              required
              class="input-field"
            >
              <option value="">Select drive type...</option>
              <option value="NVMe">NVMe</option>
              <option value="SATA">SATA</option>
              <option value="SAS">SAS</option>
            </select>
          </div>

          <!-- Protocol -->
          <div>
            <label for="protocol" class="block text-sm font-medium text-gray-700 mb-1">
              Protocol *
            </label>
            <select
              id="protocol"
              v-model="formData.protocol"
              required
              class="input-field"
            >
              <option value="">Select protocol...</option>
              <option value="Local">Local</option>
              <option value="iSCSI">iSCSI</option>
              <option value="NFS">NFS</option>
            </select>
          </div>

          <!-- Description -->
          <div>
            <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              v-model="formData.description"
              rows="3"
              class="input-field"
              placeholder="Optional description of the test..."
            ></textarea>
          </div>

          <!-- Test Date -->
          <div>
            <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
              Test Date (optional)
            </label>
            <input
              id="date"
              v-model="formData.date"
              type="datetime-local"
              class="input-field"
            />
            <p class="mt-1 text-sm text-gray-500">
              Leave blank to use current date and time
            </p>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-green-800 font-semibold">{{ successMessage }}</p>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-800 font-semibold">{{ errorMessage }}</p>
          </div>

          <!-- Submit Button -->
          <div class="flex gap-4">
            <button
              type="submit"
              :disabled="loading || !selectedFile"
              class="btn-primary"
            >
              {{ loading ? 'Uploading...' : 'Upload Test Data' }}
            </button>
            <button
              type="button"
              @click="resetForm"
              :disabled="loading"
              class="btn-secondary"
            >
              Reset Form
            </button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../composables/useApi'

const api = useApi()

const selectedFile = ref<File | null>(null)
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const formData = ref({
  hostname: '',
  drive_model: '',
  drive_type: '',
  protocol: '',
  description: '',
  date: ''
})

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

async function handleSubmit() {
  if (!selectedFile.value) {
    errorMessage.value = 'Please select a file'
    return
  }

  loading.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const formDataToSend = new FormData()
    formDataToSend.append('file', selectedFile.value)
    formDataToSend.append('hostname', formData.value.hostname)
    formDataToSend.append('drive_model', formData.value.drive_model)
    formDataToSend.append('drive_type', formData.value.drive_type)
    formDataToSend.append('protocol', formData.value.protocol)

    if (formData.value.description) {
      formDataToSend.append('description', formData.value.description)
    }

    if (formData.value.date) {
      formDataToSend.append('date', formData.value.date)
    }

    const result = await api.uploadTestData(formDataToSend)
    successMessage.value = `Success! ${result.message} (Test Run ID: ${result.test_run_id})`

    // Reset form after successful upload
    setTimeout(() => {
      resetForm()
      successMessage.value = ''
    }, 3000)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Upload failed'
    console.error('Upload error:', error)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  selectedFile.value = null
  formData.value = {
    hostname: '',
    drive_model: '',
    drive_type: '',
    protocol: '',
    description: '',
    date: ''
  }
  successMessage.value = ''
  errorMessage.value = ''

  // Reset file input
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  if (fileInput) {
    fileInput.value = ''
  }
}
</script>

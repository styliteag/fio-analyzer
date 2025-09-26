<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Upload FIO Test Data
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Upload FIO benchmark results to analyze storage performance metrics
        </p>
      </div>

      <!-- Upload Form -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form class="space-y-6" @submit.prevent="handleUpload">
          <!-- File Upload Area -->
          <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <div class="space-y-4">
              <div class="mx-auto w-12 h-12 text-gray-400 dark:text-gray-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
              </div>
              <div>
                <label for="file-upload" class="cursor-pointer">
                  <span class="text-lg font-medium text-gray-900 dark:text-white">
                    Choose FIO result files
                  </span>
                  <span class="text-sm text-gray-500 dark:text-gray-400 block mt-1">
                    or drag and drop JSON files here
                  </span>
                </label>
                <input
                  id="file-upload"
                  ref="fileInput"
                  type="file"
                  multiple
                  accept=".json"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                <p>Supported formats: JSON files containing FIO benchmark results</p>
                <p>Maximum file size: 10MB per file</p>
              </div>
            </div>
          </div>

          <!-- Selected Files -->
          <div v-if="selectedFiles.length > 0" class="space-y-3">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Selected Files ({{ selectedFiles.length }})
            </h3>
            <div class="space-y-2">
              <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 text-blue-500">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ file.name }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatFileSize(file.size) }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  @click="removeFile(index)"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Upload Options -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Upload Options
            </h3>
            <div class="space-y-3">
              <label class="flex items-center">
                <input
                  v-model="uploadOptions.validateData"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Validate data before upload
                </span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="uploadOptions.overwriteExisting"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Overwrite existing test runs with same ID
                </span>
              </label>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              :disabled="selectedFiles.length === 0 || isUploading"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="clearFiles"
            >
              Clear Files
            </button>
            <button
              type="submit"
              :disabled="selectedFiles.length === 0 || isUploading"
              class="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <LoadingSpinner v-if="isUploading" class="w-4 h-4" />
              <span>{{ isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}` }}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Upload Results -->
      <div v-if="uploadResults" class="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Upload Results
        </h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span class="text-sm font-medium text-green-800 dark:text-green-200">
              Successfully imported
            </span>
            <span class="text-sm font-bold text-green-900 dark:text-green-100">
              {{ uploadResults.imported }}
            </span>
          </div>
          <div v-if="uploadResults.failed > 0" class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <span class="text-sm font-medium text-red-800 dark:text-red-200">
              Failed imports
            </span>
            <span class="text-sm font-bold text-red-900 dark:text-red-100">
              {{ uploadResults.failed }}
            </span>
          </div>
          <div v-if="uploadResults.test_run_ids?.length > 0" class="mt-4">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Test Run IDs: {{ uploadResults.test_run_ids.join(', ') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <ErrorMessage v-if="error" :message="error" class="mt-6" />

      <!-- Help Section -->
      <div class="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
          Upload Help
        </h3>
        <div class="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <p>• Upload JSON files containing FIO benchmark results</p>
          <p>• Each file should contain test run data with performance metrics</p>
          <p>• Files are automatically validated for required fields</p>
          <p>• Duplicate test runs can be overwritten if the option is enabled</p>
          <p>• Upload progress is shown in real-time</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useApi } from '@/composables/useApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'

interface UploadOptions {
  validateData: boolean
  overwriteExisting: boolean
}

interface UploadResults {
  imported: number
  failed: number
  test_run_ids?: number[]
}

const { uploadData } = useApi()

const fileInput = ref<HTMLInputElement>()
const selectedFiles = ref<File[]>([])
const isUploading = ref(false)
const error = ref<string>('')
const uploadResults = ref<UploadResults | null>(null)

const uploadOptions = reactive<UploadOptions>({
  validateData: true,
  overwriteExisting: false
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const newFiles = Array.from(target.files)
    selectedFiles.value = [...selectedFiles.value, ...newFiles]
  }
}

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1)
}

const clearFiles = () => {
  selectedFiles.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  uploadResults.value = null
  error.value = ''
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleUpload = async () => {
  if (selectedFiles.value.length === 0) return

  isUploading.value = true
  error.value = ''
  uploadResults.value = null

  try {
    const formData = new FormData()
    
    selectedFiles.value.forEach(file => {
      formData.append('files', file)
    })

    // Add upload options
    formData.append('validate_data', uploadOptions.validateData.toString())
    formData.append('overwrite_existing', uploadOptions.overwriteExisting.toString())

    const result = await uploadData(formData)
    uploadResults.value = result

    // Clear files after successful upload
    if (result.failed === 0) {
      clearFiles()
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.'
    error.value = errorMessage
    console.error('Upload error:', err)
  } finally {
    isUploading.value = false
  }
}
</script>

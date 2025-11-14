import { useAuthStore } from '../stores/auth'
import type { FilterOptions } from '../types/testRun'

export function useApi() {
  const authStore = useAuthStore()

  async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const authHeader = authStore.getAuthHeader()

    if (!authHeader) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': authHeader
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response
  }

  // Get filter options
  async function getFilters(): Promise<FilterOptions> {
    const response = await fetchWithAuth('/api/filters')
    return await response.json()
  }

  // Upload FIO test data
  async function uploadTestData(formData: FormData): Promise<{ message: string; test_run_id: number; filename: string }> {
    const response = await fetchWithAuth('/api/import', {
      method: 'POST',
      body: formData
    })
    return await response.json()
  }

  return {
    fetchWithAuth,
    getFilters,
    uploadTestData
  }
}

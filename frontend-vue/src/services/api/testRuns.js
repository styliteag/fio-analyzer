import { apiClient, ApiClientError } from './client';
// Test runs API service
export class TestRunsApiService {
    constructor() {
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: '/api/test-runs'
        });
    }
    /**
     * Get test runs with optional filtering and pagination
     */
    async getTestRuns(query) {
        try {
            let url = this.baseUrl;
            // Build query string from filters
            if (query) {
                const params = new URLSearchParams();
                // Add filter parameters
                Object.entries(query).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (typeof value === 'number') {
                            params.append(key, value.toString());
                        }
                        else if (typeof value === 'string') {
                            params.append(key, value);
                        }
                    }
                });
                const queryString = params.toString();
                if (queryString) {
                    url += `?${queryString}`;
                }
            }
            const response = await apiClient.get(url);
            // Handle both array and object responses
            if (Array.isArray(response)) {
                return response;
            }
            return response.data || [];
        }
        catch (error) {
            console.error('Failed to fetch test runs:', error);
            throw error;
        }
    }
    /**
     * Get a single test run by ID
     */
    async getTestRun(id) {
        try {
            const response = await apiClient.get(`${this.baseUrl}/${id}`);
            if (response.data) {
                return response.data;
            }
            throw new ApiClientError(500, 'Invalid response format');
        }
        catch (error) {
            console.error(`Failed to fetch test run ${id}:`, error);
            throw error;
        }
    }
    /**
     * Get performance data for specific test runs
     */
    async getPerformanceData(testRunIds) {
        if (!testRunIds || testRunIds.length === 0) {
            return [];
        }
        try {
            const idsParam = testRunIds.join(',');
            const response = await apiClient.get(`${this.baseUrl}/performance-data?test_run_ids=${idsParam}`);
            return response.data || [];
        }
        catch (error) {
            console.error('Failed to fetch performance data:', error);
            throw error;
        }
    }
    /**
     * Update a test run (partial update)
     */
    async updateTestRun(id, updates) {
        try {
            const response = await apiClient.put(`${this.baseUrl}/${id}`, updates);
            if (response.data) {
                return response.data;
            }
            throw new ApiClientError(500, 'Invalid response format');
        }
        catch (error) {
            console.error(`Failed to update test run ${id}:`, error);
            throw error;
        }
    }
    /**
     * Bulk update test runs
     */
    async bulkUpdateTestRuns(updates) {
        try {
            const response = await apiClient.put(`${this.baseUrl}/bulk`, updates);
            if (response.data) {
                return response.data;
            }
            throw new ApiClientError(500, 'Invalid response format');
        }
        catch (error) {
            console.error('Failed to bulk update test runs:', error);
            throw error;
        }
    }
    /**
     * Delete a test run
     */
    async deleteTestRun(id) {
        try {
            await apiClient.delete(`${this.baseUrl}/${id}`);
        }
        catch (error) {
            console.error(`Failed to delete test run ${id}:`, error);
            throw error;
        }
    }
    /**
     * Upload test run data
     */
    async uploadTestRuns(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await apiClient.upload('/api/import', formData);
            return response;
        }
        catch (error) {
            console.error('Failed to upload test runs:', error);
            throw error;
        }
    }
    /**
     * Bulk upload test run data from multiple files
     */
    async bulkUploadTestRuns(files) {
        try {
            const formData = new FormData();
            files.forEach((file) => {
                formData.append('files', file);
            });
            const response = await apiClient.upload('/api/import/bulk', formData);
            return response;
        }
        catch (error) {
            console.error('Failed to bulk upload test runs:', error);
            throw error;
        }
    }
    /**
     * Get test runs statistics
     */
    async getStatistics(query) {
        try {
            let url = `${this.baseUrl}/statistics`;
            if (query) {
                const params = new URLSearchParams();
                Object.entries(query).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (typeof value === 'number') {
                            params.append(key, value.toString());
                        }
                        else if (typeof value === 'string') {
                            params.append(key, value);
                        }
                    }
                });
                const queryString = params.toString();
                if (queryString) {
                    url += `?${queryString}`;
                }
            }
            const response = await apiClient.get(url);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch test runs statistics:', error);
            throw error;
        }
    }
    /**
     * Search test runs by text query
     */
    async searchTestRuns(query, filters) {
        try {
            const params = new URLSearchParams();
            params.append('q', query);
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (typeof value === 'number') {
                            params.append(key, value.toString());
                        }
                        else if (typeof value === 'string') {
                            params.append(key, value);
                        }
                    }
                });
            }
            const url = `${this.baseUrl}/search?${params.toString()}`;
            const response = await apiClient.get(url);
            if (Array.isArray(response)) {
                return response;
            }
            return response.data || [];
        }
        catch (error) {
            console.error('Failed to search test runs:', error);
            throw error;
        }
    }
    /**
     * Get test runs grouped by various criteria
     */
    async getGroupedTestRuns(groupBy, filters) {
        try {
            const params = new URLSearchParams();
            params.append('group_by', groupBy);
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (typeof value === 'number') {
                            params.append(key, value.toString());
                        }
                        else if (typeof value === 'string') {
                            params.append(key, value);
                        }
                    }
                });
            }
            const url = `${this.baseUrl}/grouped?${params.toString()}`;
            const response = await apiClient.get(url);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch grouped test runs:', error);
            throw error;
        }
    }
    /**
     * Export test runs to various formats
     */
    async exportTestRuns(format, filters) {
        try {
            const params = new URLSearchParams();
            params.append('format', format);
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (typeof value === 'number') {
                            params.append(key, value.toString());
                        }
                        else if (typeof value === 'string') {
                            params.append(key, value);
                        }
                    }
                });
            }
            const url = `${this.baseUrl}/export?${params.toString()}`;
            // For binary responses, we need to handle differently
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': format === 'json' ? 'application/json' :
                        format === 'csv' ? 'text/csv' :
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            });
            if (!response.ok) {
                throw new ApiClientError(response.status, `Export failed: ${response.statusText}`);
            }
            return await response.blob();
        }
        catch (error) {
            console.error('Failed to export test runs:', error);
            throw error;
        }
    }
}
// Create and export singleton instance
export const testRunsApi = new TestRunsApiService();

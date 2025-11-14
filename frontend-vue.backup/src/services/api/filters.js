import { apiClient, ApiClientError } from './client';
// Filters API service
export class FiltersApiService {
    constructor() {
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: '/api/filters'
        });
    }
    /**
     * Get all available filter options
     */
    async getFilters() {
        try {
            const response = await apiClient.get(this.baseUrl);
            if (response && typeof response === 'object') {
                return response;
            }
            throw new ApiClientError(500, 'Invalid response format for filters');
        }
        catch (error) {
            console.error('Failed to fetch filters:', error);
            throw error;
        }
    }
    /**
     * Get filter options for a specific category
     */
    async getFilterCategory(category) {
        try {
            const response = await apiClient.get(`${this.baseUrl}/${category}`);
            if (response.data && Array.isArray(response.data)) {
                return response.data;
            }
            throw new ApiClientError(500, `Invalid response format for ${category} filters`);
        }
        catch (error) {
            console.error(`Failed to fetch ${category} filters:`, error);
            throw error;
        }
    }
    /**
     * Get hostnames filter options
     */
    async getHostnames() {
        const result = await this.getFilterCategory('hostnames');
        return result;
    }
    /**
     * Get drive types filter options
     */
    async getDriveTypes() {
        const result = await this.getFilterCategory('drive_types');
        return result;
    }
    /**
     * Get drive models filter options
     */
    async getDriveModels() {
        const result = await this.getFilterCategory('drive_models');
        return result;
    }
    /**
     * Get protocols filter options
     */
    async getProtocols() {
        const result = await this.getFilterCategory('protocols');
        return result;
    }
    /**
     * Get block sizes filter options
     */
    async getBlockSizes() {
        const result = await this.getFilterCategory('block_sizes');
        return result;
    }
    /**
     * Get I/O patterns filter options
     */
    async getPatterns() {
        const result = await this.getFilterCategory('patterns');
        return result;
    }
    /**
     * Get sync modes filter options
     */
    async getSyncModes() {
        const result = await this.getFilterCategory('syncs');
        return result;
    }
    /**
     * Get queue depths filter options
     */
    async getQueueDepths() {
        const result = await this.getFilterCategory('queue_depths');
        return result;
    }
    /**
     * Get direct I/O modes filter options
     */
    async getDirectModes() {
        const result = await this.getFilterCategory('directs');
        return result;
    }
    /**
     * Get job counts filter options
     */
    async getJobCounts() {
        const result = await this.getFilterCategory('num_jobs');
        return result;
    }
    /**
     * Get test sizes filter options
     */
    async getTestSizes() {
        const result = await this.getFilterCategory('test_sizes');
        return result;
    }
    /**
     * Get durations filter options
     */
    async getDurations() {
        const result = await this.getFilterCategory('durations');
        return result;
    }
    /**
     * Get host-disk combinations filter options
     */
    async getHostDiskCombinations() {
        const result = await this.getFilterCategory('host_disk_combinations');
        return result;
    }
    /**
     * Validate filter values against available options
     */
    async validateFilters(filters) {
        try {
            const availableFilters = await this.getFilters();
            const invalidFields = [];
            const suggestions = {};
            Object.entries(filters).forEach(([category, values]) => {
                if (!values || (Array.isArray(values) && values.length === 0))
                    return;
                const valueArray = Array.isArray(values) ? values : [values];
                const availableValues = availableFilters[category];
                if (availableValues) {
                    const availableSet = new Set(availableValues.map(String));
                    const invalidValues = valueArray.filter(val => !availableSet.has(String(val)));
                    if (invalidValues.length > 0) {
                        invalidFields.push(category);
                        suggestions[category] = availableValues;
                    }
                }
            });
            return {
                valid: invalidFields.length === 0,
                invalidFields,
                suggestions,
            };
        }
        catch (error) {
            console.error('Failed to validate filters:', error);
            return {
                valid: false,
                invalidFields: Object.keys(filters),
                suggestions: {},
            };
        }
    }
    /**
     * Get filter statistics (usage counts, etc.)
     */
    async getFilterStatistics() {
        try {
            const filters = await this.getFilters();
            return {
                totalHosts: filters.hostnames?.length || 0,
                totalDriveTypes: filters.drive_types?.length || 0,
                totalDriveModels: filters.drive_models?.length || 0,
                totalProtocols: filters.protocols?.length || 0,
                totalBlockSizes: filters.block_sizes?.length || 0,
                totalPatterns: filters.patterns?.length || 0,
                mostCommonHost: filters.hostnames?.[0] || null,
                mostCommonDriveType: filters.drive_types?.[0] || null,
                mostCommonBlockSize: filters.block_sizes?.[0] || null,
            };
        }
        catch (error) {
            console.error('Failed to get filter statistics:', error);
            throw error;
        }
    }
    /**
     * Refresh filter options (force cache invalidation)
     */
    async refreshFilters() {
        try {
            // Add cache-busting parameter
            const response = await apiClient.get(`${this.baseUrl}?t=${Date.now()}`);
            if (response && typeof response === 'object') {
                return response.data || response;
            }
            throw new ApiClientError(500, 'Invalid response format for refreshed filters');
        }
        catch (error) {
            console.error('Failed to refresh filters:', error);
            throw error;
        }
    }
    /**
     * Search filter options
     */
    async searchFilters(query, category) {
        try {
            const params = new URLSearchParams();
            params.append('q', query);
            if (category) {
                params.append('category', category);
            }
            const response = await apiClient.get(`${this.baseUrl}/search?${params.toString()}`);
            return response;
        }
        catch (error) {
            console.error('Failed to search filters:', error);
            throw error;
        }
    }
    /**
     * Get filter suggestions based on partial input
     */
    async getFilterSuggestions(partial, category, limit = 10) {
        try {
            const params = new URLSearchParams();
            params.append('partial', partial);
            params.append('category', category);
            params.append('limit', limit.toString());
            const response = await apiClient.get(`${this.baseUrl}/suggestions?${params.toString()}`);
            return response.suggestions || [];
        }
        catch (error) {
            console.error('Failed to get filter suggestions:', error);
            return [];
        }
    }
    /**
     * Get recently used filter values
     */
    async getRecentFilters() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/recent`);
            return response;
        }
        catch (error) {
            console.error('Failed to get recent filters:', error);
            // Return empty defaults if endpoint doesn't exist
            return {
                hostnames: [],
                drive_types: [],
                block_sizes: [],
                patterns: [],
            };
        }
    }
    /**
     * Get filter combinations that exist in the data
     */
    async getValidCombinations() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/combinations`);
            return response;
        }
        catch (error) {
            console.error('Failed to get valid combinations:', error);
            // Return empty defaults if endpoint doesn't exist
            return {
                hostname_drive_model: [],
                drive_model_block_size: [],
                hostname_protocol: [],
            };
        }
    }
}
// Create and export singleton instance
export const filtersApi = new FiltersApiService();

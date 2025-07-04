// Test runs API service
import type { TestRun, FilterOptions } from '../../types';
import { apiCall } from './base';

export interface TestRunUpdateData {
    drive_model?: string;
    drive_type?: string;
    hostname?: string;
    protocol?: string;
    description?: string;
}

export interface TestRunsOptions {
    includeHistorical?: boolean;
}

// Fetch test runs with optional historical data
export const fetchTestRuns = async (options: TestRunsOptions = {}) => {
    const { includeHistorical = false } = options;
    const params = includeHistorical ? "?include_historical=true" : "";
    
    return apiCall<TestRun[]>(`/api/test-runs${params}`);
};

// Update a specific test run
export const updateTestRun = async (
    id: number,
    data: TestRunUpdateData,
) => {
    return apiCall(`/api/test-runs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
};

// Delete a test run
export const deleteTestRun = async (id: number) => {
    return apiCall(`/api/test-runs/${id}`, {
        method: "DELETE",
    });
};

// Bulk delete test runs
export const deleteTestRuns = async (ids: number[]) => {
    const results = await Promise.allSettled(
        ids.map(id => deleteTestRun(id))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return {
        successful,
        failed,
        total: ids.length,
    };
};

// Fetch filter options for UI
export const fetchFilters = async () => {
    return apiCall<FilterOptions>("/api/filters");
};
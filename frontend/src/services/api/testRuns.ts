// Test runs API service
import type { TestRun, FilterOptions } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';
import { apiCall, buildFilterParams } from './base';

export interface TestRunUpdateData {
    drive_model?: string;
    drive_type?: string;
    hostname?: string;
    protocol?: string;
    description?: string;
}

export interface TestRunsOptions {
    // Server-side filtering options
    hostnames?: string[];
    protocols?: string[];
    drive_types?: string[];
    drive_models?: string[];
    patterns?: string[];
    block_sizes?: (string | number)[];
    syncs?: number[];
    queue_depths?: number[];
    directs?: number[];
    num_jobs?: number[];
    test_sizes?: string[];
    durations?: number[];
}

// Fetch test runs with optional historical data and server-side filtering
export const fetchTestRuns = async (options: TestRunsOptions = {}) => {
    const { 
        hostnames,
        protocols,
        drive_types,
        drive_models,
        patterns,
        block_sizes,
        syncs,
        queue_depths,
        directs,
        num_jobs,
        test_sizes,
        durations
    } = options;
    
    // Build query parameters using shared utility
    const queryParams = buildFilterParams({
        hostnames,
        protocols,
        drive_types,
        drive_models,
        patterns,
        block_sizes,
        syncs,
        queue_depths,
        directs,
        num_jobs,
        test_sizes,
        durations
    });
    
    const queryString = queryParams.toString();
    const url = `/api/test-runs${queryString ? `?${queryString}` : ''}`;
    
    return apiCall<TestRun[]>(url);
};

// Helper function to convert ActiveFilters to TestRunsOptions
export const convertActiveFiltersToOptions = (
    activeFilters: ActiveFilters
): TestRunsOptions => {
    const options: TestRunsOptions = {};
    
    // Only include filters that have values
    if (activeFilters.hostnames.length > 0) {
        options.hostnames = activeFilters.hostnames;
    }
    if (activeFilters.protocols.length > 0) {
        options.protocols = activeFilters.protocols;
    }
    if (activeFilters.drive_types.length > 0) {
        options.drive_types = activeFilters.drive_types;
    }
    if (activeFilters.drive_models.length > 0) {
        options.drive_models = activeFilters.drive_models;
    }
    if (activeFilters.patterns.length > 0) {
        options.patterns = activeFilters.patterns;
    }
    if (activeFilters.block_sizes.length > 0) {
        options.block_sizes = activeFilters.block_sizes;
    }
    if (activeFilters.syncs.length > 0) {
        options.syncs = activeFilters.syncs;
    }
    if (activeFilters.queue_depths.length > 0) {
        options.queue_depths = activeFilters.queue_depths;
    }
    if (activeFilters.directs.length > 0) {
        options.directs = activeFilters.directs;
    }
    if (activeFilters.num_jobs.length > 0) {
        options.num_jobs = activeFilters.num_jobs;
    }
    if (activeFilters.test_sizes.length > 0) {
        options.test_sizes = activeFilters.test_sizes;
    }
    if (activeFilters.durations.length > 0) {
        options.durations = activeFilters.durations;
    }
    
    return options;
};

// Fetch a single test run by ID
export const fetchTestRun = async (id: number) => {
    return apiCall<TestRun>(`/api/test-runs/${id}`);
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

// Bulk update test runs
export const bulkUpdateTestRuns = async (
    testRunIds: number[],
    updates: TestRunUpdateData,
) => {
    return apiCall(`/api/test-runs/bulk`, {
        method: "PUT",
        body: JSON.stringify({
            testRunIds,
            updates,
        }),
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
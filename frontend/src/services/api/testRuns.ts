// Test runs API service
import type { TestRun, FilterOptions } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';
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
        includeHistorical = false,
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
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (includeHistorical) {
        queryParams.append('include_historical', 'true');
    }
    
    // Add filter parameters if they exist and have values
    if (hostnames && hostnames.length > 0) {
        queryParams.append('hostnames', hostnames.join(','));
    }
    if (protocols && protocols.length > 0) {
        queryParams.append('protocols', protocols.join(','));
    }
    if (drive_types && drive_types.length > 0) {
        queryParams.append('drive_types', drive_types.join(','));
    }
    if (drive_models && drive_models.length > 0) {
        queryParams.append('drive_models', drive_models.join(','));
    }
    if (patterns && patterns.length > 0) {
        queryParams.append('patterns', patterns.join(','));
    }
    if (block_sizes && block_sizes.length > 0) {
        queryParams.append('block_sizes', block_sizes.map(size => String(size)).join(','));
    }
    if (syncs && syncs.length > 0) {
        queryParams.append('syncs', syncs.join(','));
    }
    if (queue_depths && queue_depths.length > 0) {
        queryParams.append('queue_depths', queue_depths.join(','));
    }
    if (directs && directs.length > 0) {
        queryParams.append('directs', directs.join(','));
    }
    if (num_jobs && num_jobs.length > 0) {
        queryParams.append('num_jobs', num_jobs.join(','));
    }
    if (test_sizes && test_sizes.length > 0) {
        queryParams.append('test_sizes', test_sizes.join(','));
    }
    if (durations && durations.length > 0) {
        queryParams.append('durations', durations.join(','));
    }
    
    const queryString = queryParams.toString();
    const url = `/api/test-runs${queryString ? `?${queryString}` : ''}`;
    
    return apiCall<TestRun[]>(url);
};

// Helper function to convert ActiveFilters to TestRunsOptions
export const convertActiveFiltersToOptions = (
    activeFilters: ActiveFilters, 
    includeHistorical = false
): TestRunsOptions => {
    const options: TestRunsOptions = { includeHistorical };
    
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
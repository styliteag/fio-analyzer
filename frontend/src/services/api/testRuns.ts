// Test runs API service
import type { TestRun, FilterOptions, UUIDGroup } from '../../types';
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
    // Pagination options
    limit?: number;
    offset?: number;
    // Metadata options
    include_metadata?: boolean;
}

export interface TestRunsMetadataResponse {
    data: TestRun[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
}

// Helper function to extract test runs array from either response type
export const extractTestRuns = (response: TestRun[] | TestRunsMetadataResponse): TestRun[] => {
    if (Array.isArray(response)) {
        return response;
    }
    if ('data' in response) {
        return response.data;
    }
    return [];
};

// Fetch test runs with optional historical data and server-side filtering
export const fetchTestRuns = async (options: TestRunsOptions = {}, abortSignal?: AbortSignal) => {
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
        durations,
        limit,
        offset,
        include_metadata
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
    
    // Add pagination parameters if provided
    if (limit !== undefined) {
        queryParams.append('limit', limit.toString());
    }
    if (offset !== undefined) {
        queryParams.append('offset', offset.toString());
    }
    if (include_metadata) {
        queryParams.append('include_metadata', 'true');
    }
    
    const queryString = queryParams.toString();
    const url = `/api/test-runs${queryString ? `?${queryString}` : ''}`;
    
    // Return appropriate type based on whether metadata is requested
    if (include_metadata) {
        return apiCall<TestRunsMetadataResponse>(url, {
            signal: abortSignal
        });
    }
    
    return apiCall<TestRun[]>(url, {
        signal: abortSignal
    });
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
export const fetchTestRun = async (id: number, abortSignal?: AbortSignal) => {
    return apiCall<TestRun>(`/api/test-runs/${id}`, {
        signal: abortSignal
    });
};

// Update a specific test run
export const updateTestRun = async (
    id: number,
    data: TestRunUpdateData,
    abortSignal?: AbortSignal
) => {
    return apiCall(`/api/test-runs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        signal: abortSignal
    });
};

// Delete a test run
export const deleteTestRun = async (id: number, abortSignal?: AbortSignal) => {
    return apiCall(`/api/test-runs/${id}`, {
        method: "DELETE",
        signal: abortSignal
    });
};

// Bulk update test runs
export const bulkUpdateTestRuns = async (
    testRunIds: number[],
    updates: TestRunUpdateData,
    abortSignal?: AbortSignal
) => {
    return apiCall(`/api/test-runs/bulk`, {
        method: "PUT",
        body: JSON.stringify({
            test_run_ids: testRunIds,
            updates,
        }),
        signal: abortSignal
    });
};

// Bulk delete test runs
export const deleteTestRuns = async (ids: number[], abortSignal?: AbortSignal) => {
    const results = await Promise.allSettled(
        ids.map(id => deleteTestRun(id, abortSignal))
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
export const fetchFilters = async (abortSignal?: AbortSignal) => {
    return apiCall<FilterOptions>("/api/filters", {
        signal: abortSignal
    });
};

// Fetch test runs grouped by UUID
export const fetchTestRunsGroupedByUUID = async (
    groupBy: 'config_uuid' | 'run_uuid',
    abortSignal?: AbortSignal
) => {
    return apiCall<UUIDGroup[]>(`/api/test-runs/grouped-by-uuid?group_by=${groupBy}`, {
        signal: abortSignal
    });
};

// --- Saturation Test API ---

export interface SaturationRun {
    run_uuid: string;
    hostname: string;
    protocol: string;
    drive_type: string;
    drive_model: string;
    block_size: string | null;
    started: string;
    step_count: number;
}

export interface SaturationStep {
    id: number;
    iodepth: number;
    num_jobs: number;
    total_qd: number;
    iops: number | null;
    avg_latency_ms: number | null;
    p95_latency_ms: number | null;
    p99_latency_ms: number | null;
    bandwidth_mbs: number | null;
    timestamp: string;
}

export interface SaturationPatternData {
    steps: SaturationStep[];
    saturation_point: SaturationStep | null;
}

export interface SaturationData {
    run_uuid: string;
    hostname: string;
    protocol: string;
    drive_type: string;
    drive_model: string;
    block_size: string | null;
    threshold_ms: number;
    patterns: Record<string, SaturationPatternData>;
}

// Fetch list of saturation test runs
export const fetchSaturationRuns = async (hostname?: string, abortSignal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (hostname) {
        params.append('hostname', hostname);
    }
    const queryString = params.toString();
    const url = `/api/test-runs/saturation-runs${queryString ? `?${queryString}` : ''}`;
    return apiCall<SaturationRun[]>(url, { signal: abortSignal });
};

// Fetch detailed saturation data for a specific run
export const fetchSaturationData = async (runUuid: string, thresholdMs?: number, abortSignal?: AbortSignal) => {
    const params = new URLSearchParams();
    params.append('run_uuid', runUuid);
    if (thresholdMs !== undefined) {
        params.append('threshold_ms', thresholdMs.toString());
    }
    return apiCall<SaturationData>(`/api/test-runs/saturation-data?${params.toString()}`, { signal: abortSignal });
};

// Bulk update test runs by UUID
export const bulkUpdateTestRunsByUUID = async (
    uuid: string,
    uuidType: 'config_uuid' | 'run_uuid',
    updates: TestRunUpdateData,
    abortSignal?: AbortSignal
) => {
    const queryParam = uuidType === 'config_uuid' ? `config_uuid=${uuid}` : `run_uuid=${uuid}`;

    return apiCall(`/api/test-runs/bulk-by-uuid?${queryParam}`, {
        method: "PUT",
        body: JSON.stringify(updates),
        signal: abortSignal
    });
};
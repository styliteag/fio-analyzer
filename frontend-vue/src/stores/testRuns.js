import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
export const useTestRunsStore = defineStore('testRuns', () => {
    // Reactive state
    const state = ref({
        data: [],
        filters: null,
        isLoading: false,
        error: null,
        lastFetch: null,
        totalCount: 0,
        hasMore: false,
        currentPage: 1,
        pageSize: 1000, // Large default to get all data for visualization
    });
    // Computed properties
    const hasData = computed(() => state.value.data.length > 0);
    const isEmpty = computed(() => state.value.data.length === 0 && !state.value.isLoading);
    const hasFilters = computed(() => state.value.filters !== null);
    const uniqueHostnames = computed(() => {
        const hostnames = [...new Set(state.value.data.map(run => run.hostname))];
        return hostnames.sort();
    });
    const uniqueDriveTypes = computed(() => {
        const driveTypes = [...new Set(state.value.data.map(run => run.drive_type))];
        return driveTypes.sort();
    });
    const dateRange = computed(() => {
        if (state.value.data.length === 0)
            return null;
        const timestamps = state.value.data.map(run => new Date(run.timestamp).getTime());
        const minDate = new Date(Math.min(...timestamps));
        const maxDate = new Date(Math.max(...timestamps));
        return {
            start: minDate,
            end: maxDate,
            duration: maxDate.getTime() - minDate.getTime(),
        };
    });
    // Performance statistics
    const stats = computed(() => {
        if (state.value.data.length === 0)
            return null;
        const runs = state.value.data;
        const iopsValues = runs.map(r => r.iops).filter(v => v > 0);
        const latencyValues = runs.map(r => r.avg_latency).filter(v => v > 0);
        const bandwidthValues = runs.map(r => r.bandwidth).filter(v => v > 0);
        return {
            totalRuns: runs.length,
            avgIops: iopsValues.length > 0 ? iopsValues.reduce((a, b) => a + b, 0) / iopsValues.length : 0,
            avgLatency: latencyValues.length > 0 ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : 0,
            avgBandwidth: bandwidthValues.length > 0 ? bandwidthValues.reduce((a, b) => a + b, 0) / bandwidthValues.length : 0,
            maxIops: iopsValues.length > 0 ? Math.max(...iopsValues) : 0,
            minLatency: latencyValues.length > 0 ? Math.min(...latencyValues) : 0,
            hostCount: uniqueHostnames.value.length,
            driveTypeCount: uniqueDriveTypes.value.length,
        };
    });
    // Actions
    function setData(testRuns) {
        state.value.data = [...testRuns];
        state.value.lastFetch = Date.now();
        state.value.error = null;
    }
    function appendData(testRuns) {
        state.value.data = [...state.value.data, ...testRuns];
        state.value.lastFetch = Date.now();
    }
    function setFilters(filters) {
        state.value.filters = { ...filters };
    }
    function setLoading(loading) {
        state.value.isLoading = loading;
    }
    function setError(error) {
        state.value.error = error;
        if (error) {
            state.value.isLoading = false;
        }
    }
    function clearData() {
        state.value.data = [];
        state.value.lastFetch = null;
        state.value.error = null;
        state.value.totalCount = 0;
        state.value.hasMore = false;
        state.value.currentPage = 1;
    }
    function clearFilters() {
        state.value.filters = null;
    }
    function reset() {
        clearData();
        clearFilters();
    }
    // Filtering and searching
    function getFilteredData(filters) {
        let filtered = [...state.value.data];
        if (!filters || Object.keys(filters).length === 0) {
            return filtered;
        }
        // Apply filters
        Object.entries(filters).forEach(([key, values]) => {
            if (!values || (Array.isArray(values) && values.length === 0))
                return;
            const valueArray = Array.isArray(values) ? values : [values];
            filtered = filtered.filter(run => {
                const runValue = run[key];
                if (runValue === undefined || runValue === null)
                    return false;
                // Handle different filter types
                if (key === 'hostnames' && valueArray.includes(run.hostname))
                    return true;
                if (key === 'drive_types' && valueArray.includes(run.drive_type))
                    return true;
                if (key === 'drive_models' && valueArray.includes(run.drive_model))
                    return true;
                if (key === 'protocols' && valueArray.includes(run.protocol))
                    return true;
                if (key === 'block_sizes' && valueArray.includes(run.block_size))
                    return true;
                if (key === 'patterns' && valueArray.includes(run.read_write_pattern))
                    return true;
                if (key === 'queue_depths' && valueArray.includes(run.queue_depth))
                    return true;
                if (key === 'num_jobs' && valueArray.includes(run.num_jobs))
                    return true;
                if (key === 'syncs' && valueArray.includes(run.sync))
                    return true;
                if (key === 'directs' && valueArray.includes(run.direct))
                    return true;
                return false;
            });
        });
        return filtered;
    }
    function getRunsByHostname(hostname) {
        return state.value.data.filter(run => run.hostname === hostname);
    }
    function getRunsByDriveType(driveType) {
        return state.value.data.filter(run => run.drive_type === driveType);
    }
    function getRunsByDateRange(startDate, endDate) {
        return state.value.data.filter(run => {
            const runDate = new Date(run.timestamp);
            return runDate >= startDate && runDate <= endDate;
        });
    }
    // Pagination helpers
    function getPageData(page = 1, pageSize = state.value.pageSize) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return state.value.data.slice(start, end);
    }
    function setPagination(page, pageSize, totalCount) {
        state.value.currentPage = page;
        state.value.pageSize = pageSize;
        state.value.totalCount = totalCount;
        state.value.hasMore = (page * pageSize) < totalCount;
    }
    // Data analysis helpers
    function getPerformanceSummary() {
        if (state.value.data.length === 0)
            return null;
        const iopsValues = state.value.data.map(r => r.iops).filter(v => v > 0);
        const latencyValues = state.value.data.map(r => r.avg_latency).filter(v => v > 0);
        const bandwidthValues = state.value.data.map(r => r.bandwidth).filter(v => v > 0);
        return {
            iops: {
                min: iopsValues.length > 0 ? Math.min(...iopsValues) : 0,
                max: iopsValues.length > 0 ? Math.max(...iopsValues) : 0,
                avg: iopsValues.length > 0 ? iopsValues.reduce((a, b) => a + b, 0) / iopsValues.length : 0,
                count: iopsValues.length,
            },
            latency: {
                min: latencyValues.length > 0 ? Math.min(...latencyValues) : 0,
                max: latencyValues.length > 0 ? Math.max(...latencyValues) : 0,
                avg: latencyValues.length > 0 ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : 0,
                count: latencyValues.length,
            },
            bandwidth: {
                min: bandwidthValues.length > 0 ? Math.min(...bandwidthValues) : 0,
                max: bandwidthValues.length > 0 ? Math.max(...bandwidthValues) : 0,
                avg: bandwidthValues.length > 0 ? bandwidthValues.reduce((a, b) => a + b, 0) / bandwidthValues.length : 0,
                count: bandwidthValues.length,
            },
        };
    }
    return {
        // Reactive state (readonly)
        state: readonly(state),
        // Computed properties
        hasData,
        isEmpty,
        hasFilters,
        uniqueHostnames,
        uniqueDriveTypes,
        dateRange,
        stats,
        // Actions
        setData,
        appendData,
        setFilters,
        setLoading,
        setError,
        clearData,
        clearFilters,
        reset,
        // Filtering and searching
        getFilteredData,
        getRunsByHostname,
        getRunsByDriveType,
        getRunsByDateRange,
        // Pagination
        getPageData,
        setPagination,
        // Analysis
        getPerformanceSummary,
    };
});

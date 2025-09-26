import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
export const useFiltersStore = defineStore('filters', () => {
    // Reactive state
    const state = ref({
        active: {},
        available: null,
        applied: false,
        isLoading: false,
        error: null,
        lastUpdated: null,
    });
    // Computed properties
    const hasActiveFilters = computed(() => {
        return Object.values(state.value.active).some(values => values.length > 0);
    });
    const activeFilterCount = computed(() => {
        return Object.values(state.value.active).reduce((total, values) => total + values.length, 0);
    });
    const activeCategories = computed(() => {
        return Object.entries(state.value.active)
            .filter(([, values]) => values.length > 0)
            .map(([category]) => category);
    });
    const isDirty = computed(() => {
        // Check if current state differs from applied state
        return !state.value.applied && hasActiveFilters.value;
    });
    const appliedFilters = computed(() => {
        const appliedState = {
            selectedBlockSizes: [],
            selectedPatterns: [],
            selectedQueueDepths: [],
            selectedNumJobs: [],
            selectedProtocols: [],
            selectedHostDiskCombinations: [],
        };
        // Convert internal active state to FilterState interface
        Object.entries(state.value.active).forEach(([category, values]) => {
            switch (category) {
                case 'block_sizes':
                    appliedState.selectedBlockSizes = values;
                    break;
                case 'patterns':
                    appliedState.selectedPatterns = values;
                    break;
                case 'queue_depths':
                    appliedState.selectedQueueDepths = values;
                    break;
                case 'num_jobs':
                    appliedState.selectedNumJobs = values;
                    break;
                case 'protocols':
                    appliedState.selectedProtocols = values;
                    break;
                case 'hostnames':
                    // Handle hostnames filtering - could be extended
                    break;
                case 'host_disk_combinations':
                    appliedState.selectedHostDiskCombinations = values;
                    break;
            }
        });
        return appliedState;
    });
    // Filter manipulation actions
    function setFilter(category, values) {
        state.value.active[category] = [...values];
        state.value.applied = false;
        state.value.lastUpdated = Date.now();
    }
    function addFilter(category, value) {
        if (!state.value.active[category]) {
            state.value.active[category] = [];
        }
        if (!state.value.active[category].includes(value)) {
            state.value.active[category].push(value);
            state.value.applied = false;
            state.value.lastUpdated = Date.now();
        }
    }
    function removeFilter(category, value) {
        if (!state.value.active[category])
            return;
        const index = state.value.active[category].indexOf(value);
        if (index > -1) {
            state.value.active[category].splice(index, 1);
            state.value.applied = false;
            state.value.lastUpdated = Date.now();
        }
    }
    function toggleFilter(category, value) {
        if (state.value.active[category]?.includes(value)) {
            removeFilter(category, value);
        }
        else {
            addFilter(category, value);
        }
    }
    function clearCategory(category) {
        state.value.active[category] = [];
        state.value.applied = false;
        state.value.lastUpdated = Date.now();
    }
    function clearAllFilters() {
        Object.keys(state.value.active).forEach(category => {
            state.value.active[category] = [];
        });
        state.value.applied = false;
        state.value.lastUpdated = Date.now();
    }
    function resetFilters() {
        clearAllFilters();
        saveToStorage();
    }
    function applyFilters() {
        state.value.applied = true;
        saveToStorage();
    }
    // Available options management
    function setAvailableFilters(options) {
        state.value.available = { ...options };
        // Remove any active filters that are no longer available
        Object.keys(state.value.active).forEach(category => {
            if (state.value.available && category in state.value.available) {
                const availableValues = state.value.available[category];
                state.value.active[category] = state.value.active[category].filter(value => availableValues.includes(value));
            }
        });
    }
    // Validation
    function isValidFilter(category, value) {
        if (!state.value.available)
            return true;
        const availableValues = state.value.available[category];
        if (!availableValues)
            return true;
        return availableValues.includes(value);
    }
    function getAvailableValues(category) {
        if (!state.value.available)
            return [];
        const values = state.value.available[category];
        return values || [];
    }
    // API parameter conversion
    function getApiParams() {
        const params = {};
        // Convert filter categories to API parameter names
        const apiMappings = {
            hostnames: 'hostnames',
            drive_types: 'drive_types',
            drive_models: 'drive_models',
            protocols: 'protocols',
            patterns: 'patterns',
            block_sizes: 'block_sizes',
            syncs: 'syncs',
            queue_depths: 'queue_depths',
            directs: 'directs',
            num_jobs: 'num_jobs',
            test_sizes: 'test_sizes',
            durations: 'durations',
        };
        Object.entries(state.value.active).forEach(([category, values]) => {
            if (values.length > 0) {
                const apiParam = apiMappings[category];
                if (apiParam) {
                    params[apiParam] = values.join(',');
                }
            }
        });
        return params;
    }
    // State management
    function setLoading(loading) {
        state.value.isLoading = loading;
    }
    function setError(error) {
        state.value.error = error;
        if (error) {
            state.value.isLoading = false;
        }
    }
    // Persistence
    function saveToStorage() {
        try {
            const data = {
                active: { ...state.value.active },
                applied: state.value.applied,
                timestamp: state.value.lastUpdated,
            };
            localStorage.setItem('fio-filters', JSON.stringify(data));
        }
        catch (error) {
            console.warn('Failed to save filters to localStorage:', error);
        }
    }
    function loadFromStorage() {
        try {
            const stored = localStorage.getItem('fio-filters');
            if (!stored)
                return false;
            const data = JSON.parse(stored);
            if (!data.active || typeof data.active !== 'object')
                return false;
            state.value.active = { ...data.active };
            state.value.applied = data.applied || false;
            state.value.lastUpdated = data.timestamp || null;
            return true;
        }
        catch (error) {
            console.warn('Failed to load filters from localStorage:', error);
            return false;
        }
    }
    function clearStorage() {
        try {
            localStorage.removeItem('fio-filters');
        }
        catch (error) {
            console.warn('Failed to clear filters from localStorage:', error);
        }
    }
    // Utility methods
    function getFilterSummary() {
        return activeCategories.value.map(category => ({
            category,
            values: state.value.active[category],
            displayName: formatCategoryName(category),
        }));
    }
    function formatCategoryName(category) {
        const names = {
            block_sizes: 'Block Sizes',
            patterns: 'I/O Patterns',
            queue_depths: 'Queue Depths',
            num_jobs: 'Job Count',
            protocols: 'Protocols',
            hostnames: 'Hostnames',
            drive_types: 'Drive Types',
            drive_models: 'Drive Models',
            syncs: 'Sync Mode',
            directs: 'Direct I/O',
            test_sizes: 'Test Sizes',
            durations: 'Duration',
            host_disk_combinations: 'Host-Disk Combinations',
        };
        return names[category] || category;
    }
    // Initialize from storage
    loadFromStorage();
    return {
        // Reactive state
        state,
        // Computed properties
        hasActiveFilters,
        activeFilterCount,
        activeCategories,
        isDirty,
        appliedFilters,
        // Filter manipulation
        setFilter,
        addFilter,
        removeFilter,
        toggleFilter,
        clearCategory,
        clearAllFilters,
        resetFilters,
        applyFilters,
        // Available options
        setAvailableFilters,
        // Validation
        isValidFilter,
        getAvailableValues,
        // API integration
        getApiParams,
        // State management
        setLoading,
        setError,
        // Persistence
        saveToStorage,
        loadFromStorage,
        clearStorage,
        // Utilities
        getFilterSummary,
        formatCategoryName,
    };
});

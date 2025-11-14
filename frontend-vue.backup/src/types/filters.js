/**
 * Filter State Management Types
 * Based on data-model.md specifications
 */
// Default filter state
export const defaultFilterState = {
    selectedBlockSizes: [],
    selectedPatterns: [],
    selectedQueueDepths: [],
    selectedNumJobs: [],
    selectedProtocols: [],
    selectedHostDiskCombinations: []
};
// Filter utility functions
export function isFilterActive(state) {
    return (state.selectedBlockSizes.length > 0 ||
        state.selectedPatterns.length > 0 ||
        state.selectedQueueDepths.length > 0 ||
        state.selectedNumJobs.length > 0 ||
        state.selectedProtocols.length > 0 ||
        state.selectedHostDiskCombinations.length > 0);
}
export function getActiveFilterCount(state) {
    return (state.selectedBlockSizes.length +
        state.selectedPatterns.length +
        state.selectedQueueDepths.length +
        state.selectedNumJobs.length +
        state.selectedProtocols.length +
        state.selectedHostDiskCombinations.length);
}
export function resetFilterState() {
    return { ...defaultFilterState };
}
export function mergeFilterStates(base, updates) {
    return {
        selectedBlockSizes: updates.selectedBlockSizes ?? base.selectedBlockSizes,
        selectedPatterns: updates.selectedPatterns ?? base.selectedPatterns,
        selectedQueueDepths: updates.selectedQueueDepths ?? base.selectedQueueDepths,
        selectedNumJobs: updates.selectedNumJobs ?? base.selectedNumJobs,
        selectedProtocols: updates.selectedProtocols ?? base.selectedProtocols,
        selectedHostDiskCombinations: updates.selectedHostDiskCombinations ?? base.selectedHostDiskCombinations
    };
}
// Filter predicate functions for data filtering
export function matchesFilters(item, filters) {
    if (filters.selectedBlockSizes.length > 0 && (!item.block_size || !filters.selectedBlockSizes.includes(item.block_size))) {
        return false;
    }
    if (filters.selectedPatterns.length > 0 && (!item.read_write_pattern || !filters.selectedPatterns.includes(item.read_write_pattern))) {
        return false;
    }
    if (filters.selectedQueueDepths.length > 0 && (item.queue_depth === undefined || !filters.selectedQueueDepths.includes(item.queue_depth))) {
        return false;
    }
    if (filters.selectedNumJobs.length > 0 && (item.num_jobs === undefined || item.num_jobs === null || !filters.selectedNumJobs.includes(item.num_jobs))) {
        return false;
    }
    if (filters.selectedProtocols.length > 0 && (!item.protocol || !filters.selectedProtocols.includes(item.protocol))) {
        return false;
    }
    return true;
}
export function createHostDiskKey(hostname, protocol, driveModel) {
    return `${hostname} - ${protocol} - ${driveModel}`;
}

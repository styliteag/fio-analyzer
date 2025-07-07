import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Settings, Check, X, Plus, Minus } from 'lucide-react';
import { useTestRunSelection, TestRunSelectionOptions } from '../../hooks/useTestRunSelection';
import { useTestRunOperations } from '../../hooks/useTestRunOperations';
import { useTestRunFilters } from '../../hooks/useTestRunFilters';
import type { TestRun, FilterOptions } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';
import TestRunFilters from './TestRunFilters';
import TestRunGrid from './TestRunGrid';
import TestRunActions from './TestRunActions';
import BulkEditModal from '../BulkEditModal';
import EditTestRunModal from '../EditTestRunModal';

interface TestRunManagerProps {
    selectedRuns: TestRun[];
    onSelectionChange: (runs: TestRun[]) => void;
    testRuns: TestRun[];
    activeFilters: ActiveFilters;
    filteredRuns: TestRun[];
    hasActiveFilters: boolean;
    onFilterChange: (filterType: keyof ActiveFilters, values: (string | number)[]) => void;
    onClearAllFilters?: () => void;
    filters: FilterOptions;
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
}

const TestRunManager: React.FC<TestRunManagerProps> = ({
    selectedRuns,
    onSelectionChange,
    testRuns,
    activeFilters,
    filteredRuns,
    hasActiveFilters,
    onFilterChange,
    onClearAllFilters,
    filters,
    loading,
    error,
    onRefresh,
}) => {
    const [isSelectedRunsExpanded, setIsSelectedRunsExpanded] = useState(false);
    const [autoSelectEnabled, setAutoSelectEnabled] = useState(true);

    // Configure auto-selection options
    const selectionOptions: TestRunSelectionOptions = useMemo(() => ({
        autoSelectAll: autoSelectEnabled,
        autoSelectOnFilterChange: autoSelectEnabled,
    }), [autoSelectEnabled]);

    // Use the hook to get dynamic filter options
    const { dynamicFilterOptions } = useTestRunFilters(testRuns);

    const {
        handleSelectAllMatching,
        getUnselectedMatchingCount,
        clearSelection,
        isAutoSelectionActive,
        toggleAutoSelection,
    } = useTestRunSelection(selectedRuns, onSelectionChange, filteredRuns, selectionOptions);

    const {
        state: operationState,
        handleEditTestRun,
        handleCloseEditModal,
        handleSaveTestRun,
        handleBulkEdit,
        handleCloseBulkEditModal,
        handleBulkSave,
        handleDeleteTestRun,
        handleBulkDelete,
    } = useTestRunOperations(
        testRuns,
        onRefresh,
        selectedRuns,
        onSelectionChange,
        onRefresh
    );

    const handleDeleteWithAlert = useCallback(async (testRun: TestRun) => {
        const result = await handleDeleteTestRun(testRun);
        if (!result.success && result.error) {
            alert(result.error);
        }
    }, [handleDeleteTestRun]);

    const handleBulkDeleteWithAlert = useCallback(async () => {
        const result = await handleBulkDelete();
        if (result.error) {
            alert(result.error);
        }
    }, [handleBulkDelete]);

    const toggleSelectedRunsExpanded = useCallback(() => {
        setIsSelectedRunsExpanded(!isSelectedRunsExpanded);
    }, [isSelectedRunsExpanded]);

    const toggleAutoSelect = useCallback(() => {
        setAutoSelectEnabled(!autoSelectEnabled);
        if (!autoSelectEnabled && filteredRuns.length > 0) {
            // Enable auto-select and immediately select all filtered runs
            onSelectionChange(filteredRuns);
        }
    }, [autoSelectEnabled, filteredRuns, onSelectionChange]);

    // Smart default for selected runs: collapsed when auto-selected, expanded when manually selected
    const shouldShowSelectedRunsCollapsed = useMemo(() => {
        return !isSelectedRunsExpanded && (isAutoSelectionActive || selectedRuns.length === 0);
    }, [isSelectedRunsExpanded, isAutoSelectionActive, selectedRuns.length]);

    if (loading) {
        return (
            <div className="theme-card rounded-lg shadow-md p-4 mb-4 border">
                <div className="flex items-center justify-center py-8">
                    <div className="theme-text-secondary">Loading test runs...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="theme-card rounded-lg shadow-md p-4 mb-4 border">
                <div className="flex items-center justify-center py-8">
                    <div className="theme-text-error">Error: {error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="theme-card rounded-lg shadow-md p-4 mb-4 border">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                    <Settings className="mr-2 theme-text-secondary" size={18} />
                    <h2 className="text-lg font-semibold theme-text-primary">
                        Test Run Selection
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {/* Clear All Filters Button */}
                    {onClearAllFilters && (
                        <button
                            type="button"
                            onClick={onClearAllFilters}
                            className="flex items-center gap-1 px-2 py-1 text-xs theme-btn-secondary rounded transition-colors hover:theme-btn-secondary-hover"
                            title="Clear all active filters"
                        >
                            <X size={12} />
                            Clear All Filters
                        </button>
                    )}
                    
                    {/* Auto-select toggle */}
                    <button
                        type="button"
                        onClick={toggleAutoSelect}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            autoSelectEnabled
                                ? 'theme-btn-primary'
                                : 'theme-btn-secondary'
                        }`}
                        title={autoSelectEnabled ? 'Disable auto-selection' : 'Enable auto-selection'}
                    >
                        {autoSelectEnabled ? <Check size={12} /> : <X size={12} />}
                        Auto-select
                    </button>
                </div>
            </div>

            {/* Filters - Always Visible */}
            <div className="mb-4">
                <TestRunFilters
                    filters={filters}
                    activeFilters={activeFilters}
                    onFilterChange={onFilterChange}
                    dynamicFilterOptions={dynamicFilterOptions}
                    useDynamicFilters={true}
                    onClearAllFilters={onClearAllFilters}
                    testRuns={testRuns}
                    filteredRuns={filteredRuns}
                />
            </div>

            {/* Quick Actions - Always Visible */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm theme-text-secondary">
                        {filteredRuns.length} available, {selectedRuns.length} selected
                    </span>
                </div>
            </div>

        </div>
    );
};

export default TestRunManager;
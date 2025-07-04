import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Settings, Check, X, Plus, Minus } from 'lucide-react';
import { useTestRunSelection, TestRunSelectionOptions } from '../../hooks/useTestRunSelection';
import { useTestRunOperations } from '../../hooks/useTestRunOperations';
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
                />
            </div>

            {/* Quick Actions - Always Visible */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm theme-text-secondary">
                        {filteredRuns.length} available, {selectedRuns.length} selected
                    </span>
                    {hasActiveFilters && (
                        <span className="px-2 py-1 theme-bg-accent theme-text-accent rounded text-xs">
                            Filtered
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={clearSelection}
                        className="flex items-center gap-1 px-2 py-1 text-xs theme-btn-secondary rounded"
                        disabled={selectedRuns.length === 0}
                    >
                        <Minus size={12} />
                        Clear All
                    </button>
                    <button
                        type="button"
                        onClick={toggleAutoSelection}
                        className="flex items-center gap-1 px-2 py-1 text-xs theme-btn-primary rounded"
                        disabled={filteredRuns.length === 0}
                    >
                        <Plus size={12} />
                        {isAutoSelectionActive ? 'Deselect All' : 'Select All'}
                    </button>
                    {hasActiveFilters && getUnselectedMatchingCount() > 0 && (
                        <button
                            type="button"
                            onClick={handleSelectAllMatching}
                            className="flex items-center gap-1 px-2 py-1 text-xs theme-btn-primary rounded"
                        >
                            <Plus size={12} />
                            Add Filtered ({getUnselectedMatchingCount()})
                        </button>
                    )}
                </div>
            </div>

            {/* Selected Runs Section */}
            {selectedRuns.length > 0 && (
                <div>
                    {/* Selected Runs Header */}
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-md font-medium theme-text-primary">
                            Selected Runs ({selectedRuns.length})
                        </h3>
                        <button
                            type="button"
                            onClick={toggleSelectedRunsExpanded}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs theme-btn-secondary transition-colors"
                            title={isSelectedRunsExpanded ? 'Collapse selected runs' : 'Expand selected runs'}
                        >
                            {isSelectedRunsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isSelectedRunsExpanded ? 'Collapse' : 'Expand'}
                        </button>
                    </div>

                    {/* Collapsed Selected Runs View */}
                    {shouldShowSelectedRunsCollapsed && (
                        <div className="flex items-center justify-between py-2 px-3 theme-bg-tertiary rounded-md">
                            <div className="flex items-center gap-4 text-sm theme-text-secondary">
                                <span>{selectedRuns.length} test runs selected</span>
                                {isAutoSelectionActive && (
                                    <span className="px-2 py-1 theme-bg-accent theme-text-accent rounded text-xs">
                                        Auto-selected
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleBulkEdit}
                                    className="flex items-center gap-1 px-2 py-1 text-xs theme-btn-secondary rounded"
                                    disabled={selectedRuns.length === 0}
                                >
                                    Edit All
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Expanded Selected Runs View */}
                    {isSelectedRunsExpanded && (
                        <div>
                            <TestRunActions
                                selectedRuns={selectedRuns}
                                hasActiveFilters={hasActiveFilters}
                                unselectedMatchingCount={getUnselectedMatchingCount()}
                                onSelectAllMatching={handleSelectAllMatching}
                                onBulkEdit={handleBulkEdit}
                                onBulkDelete={handleBulkDeleteWithAlert}
                                bulkDeleting={operationState.bulkDeleting}
                            />
                            <TestRunGrid
                                selectedRuns={selectedRuns}
                                onEdit={handleEditTestRun}
                                onDelete={handleDeleteWithAlert}
                                deleting={operationState.deleting}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <EditTestRunModal
                testRun={operationState.testRunToEdit}
                isOpen={operationState.editModalOpen}
                onClose={handleCloseEditModal}
                onSave={handleSaveTestRun}
            />

            <BulkEditModal
                testRuns={selectedRuns}
                isOpen={operationState.bulkEditModalOpen}
                onClose={handleCloseBulkEditModal}
                onSave={handleBulkSave}
            />
        </div>
    );
};

export default TestRunManager;
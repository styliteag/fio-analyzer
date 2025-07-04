import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Settings } from 'lucide-react';
import Select from 'react-select';
import { getSelectStyles } from '../../hooks/useThemeColors';
import { useTestRunFilters } from '../../hooks/useTestRunFilters';
import { useTestRunSelection } from '../../hooks/useTestRunSelection';
import { useTestRunOperations } from '../../hooks/useTestRunOperations';
import { fetchTestRuns, fetchFilters } from '../../services/api/testRuns';
import type { FilterOptions, TestRun } from '../../types';
import TestRunFilters from './TestRunFilters';
import TestRunGrid from './TestRunGrid';
import TestRunActions from './TestRunActions';
import BulkEditModal from '../BulkEditModal';
import EditTestRunModal from '../EditTestRunModal';

interface TestRunSelectorProps {
    selectedRuns: TestRun[];
    onSelectionChange: (runs: TestRun[]) => void;
    refreshTrigger?: number;
}

const TestRunSelector: React.FC<TestRunSelectorProps> = ({
    selectedRuns,
    onSelectionChange,
    refreshTrigger = 0,
}) => {
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [filters, setFilters] = useState<FilterOptions>({
        drive_types: [],
        drive_models: [],
        patterns: [],
        block_sizes: [],
        hostnames: [],
        protocols: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Custom hooks for managing filters, selection, and operations
    const {
        activeFilters,
        filteredRuns,
        hasActiveFilters,
        updateFilter,
    } = useTestRunFilters(testRuns);

    const {
        runOptions,
        selectedOptions,
        handleRunSelection,
        handleSelectAllMatching,
        getUnselectedMatchingCount,
    } = useTestRunSelection(selectedRuns, onSelectionChange, filteredRuns);

    const loadFilters = useCallback(async () => {
        try {
            const result = await fetchFilters();
            if (result.error) {
                setError(result.error);
            } else if (result.data) {
                setFilters(result.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load filters');
        }
    }, []);

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
        setTestRuns,
        selectedRuns,
        onSelectionChange,
        loadFilters
    );

    const loadTestRuns = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await fetchTestRuns();
            if (result.error) {
                setError(result.error);
            } else if (result.data) {
                setTestRuns(result.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load test runs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTestRuns();
        loadFilters();
    }, [loadTestRuns, loadFilters, refreshTrigger]);

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
            <h2 className="text-lg font-semibold mb-3 flex items-center theme-text-primary">
                <Settings className="mr-2 theme-text-secondary" size={18} />
                Test Run Selection
            </h2>

            {/* Filters */}
            <TestRunFilters
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={updateFilter}
            />

            {/* Test Run Selection */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium theme-text-secondary">
                        <Calendar size={14} className="inline mr-1 theme-text-tertiary" />
                        Select Test Runs ({filteredRuns.length} available)
                    </label>
                    {hasActiveFilters() && getUnselectedMatchingCount() > 0 && (
                        <button
                            type="button"
                            onClick={handleSelectAllMatching}
                            className="inline-flex items-center px-2 py-1 text-xs theme-btn-primary rounded transition-colors"
                            title={`Add all ${getUnselectedMatchingCount()} matching test runs`}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add All ({getUnselectedMatchingCount()})
                        </button>
                    )}
                </div>
                <Select
                    isMulti
                    options={runOptions}
                    value={selectedOptions}
                    onChange={handleRunSelection}
                    placeholder="Select test runs to compare..."
                    className="text-sm"
                    maxMenuHeight={150}
                    menuPlacement="auto"
                    menuShouldScrollIntoView={true}
                    styles={{
                        ...getSelectStyles(),
                        control: (base) => ({
                            ...getSelectStyles().control(base),
                            maxHeight: "120px",
                            overflowY: "auto",
                        }),
                        valueContainer: (base) => ({
                            ...base,
                            maxHeight: "100px",
                            overflowY: "auto",
                        }),
                        multiValue: (base) => ({
                            ...getSelectStyles().multiValue(base),
                            fontSize: "0.75rem",
                            margin: "1px",
                        }),
                    }}
                />
            </div>

            {/* Selected Runs Preview */}
            {selectedRuns.length > 0 && (
                <div className="mt-4">
                    <TestRunActions
                        selectedRuns={selectedRuns}
                        hasActiveFilters={hasActiveFilters()}
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

export default TestRunSelector;
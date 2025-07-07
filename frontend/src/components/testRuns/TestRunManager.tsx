import React, { useState, useCallback } from 'react';
import { Settings, Check, X } from 'lucide-react';
import { useTestRunFilters } from '../../hooks/useTestRunFilters';
import type { TestRun, FilterOptions } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';
import TestRunFilters from './TestRunFilters';

interface TestRunManagerProps {
    selectedRuns: TestRun[];
    onSelectionChange: (runs: TestRun[]) => void;
    testRuns: TestRun[];
    activeFilters: ActiveFilters;
    filteredRuns: TestRun[];
    onFilterChange: (filterType: keyof ActiveFilters, values: (string | number)[]) => void;
    onClearAllFilters?: () => void;
    filters: FilterOptions;
    loading: boolean;
    error: string | null;
}

const TestRunManager: React.FC<TestRunManagerProps> = ({
    selectedRuns,
    onSelectionChange,
    testRuns,
    activeFilters,
    filteredRuns,
    onFilterChange,
    onClearAllFilters,
    filters,
    loading,
    error,
}) => {
    const [autoSelectEnabled, setAutoSelectEnabled] = useState(true);

    // Use the hook to get dynamic filter options
    const { dynamicFilterOptions } = useTestRunFilters(testRuns);

    const toggleAutoSelect = useCallback(() => {
        setAutoSelectEnabled(!autoSelectEnabled);
        if (!autoSelectEnabled && filteredRuns.length > 0) {
            // Enable auto-select and immediately select all filtered runs
            onSelectionChange(filteredRuns);
        }
    }, [autoSelectEnabled, filteredRuns, onSelectionChange]);

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
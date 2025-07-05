import { useCallback, useMemo, useEffect, useRef } from 'react';
import type { TestRun } from '../types';

export interface TestRunOption {
    value: TestRun;
    label: string;
    key: number;
}

export interface TestRunSelectionOptions {
    autoSelectAll?: boolean;
    autoSelectOnFilterChange?: boolean;
}

export const useTestRunSelection = (
    selectedRuns: TestRun[],
    onSelectionChange: (runs: TestRun[]) => void,
    filteredRuns: TestRun[],
    options: TestRunSelectionOptions = {}
) => {
    const runOptions = useMemo(() => {
        return filteredRuns.map((run) => {
            const date = new Date(run.timestamp);
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            return {
                value: run,
                label: `${run.drive_model} - ${run.test_name} (${formattedDate})`,
                key: run.id,
            };
        });
    }, [filteredRuns]);

    const selectedOptions = useMemo(() => {
        return selectedRuns.map((run) => {
            const date = new Date(run.timestamp);
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            return {
                value: run,
                label: `${run.drive_model} - ${run.test_name} (${formattedDate})`,
                key: run.id,
            };
        });
    }, [selectedRuns]);

    // Track if this is the initial load and if auto-selection has been applied
    const initialLoadRef = useRef(true);
    const previousFilteredRunsRef = useRef<TestRun[]>([]);
    const { autoSelectAll = false, autoSelectOnFilterChange = false } = options;

    // Auto-select all filtered runs on initial load if enabled
    useEffect(() => {
        if (autoSelectAll && initialLoadRef.current && filteredRuns.length > 0 && selectedRuns.length === 0) {
            onSelectionChange(filteredRuns);
            initialLoadRef.current = false;
        } else if (filteredRuns.length > 0) {
            initialLoadRef.current = false;
        }
    }, [autoSelectAll, filteredRuns, selectedRuns.length, onSelectionChange]);

    // Auto-select all filtered runs when filters change if enabled
    useEffect(() => {
        if (autoSelectOnFilterChange && !initialLoadRef.current && filteredRuns.length > 0) {
            const previousIds = previousFilteredRunsRef.current.map(run => run.id);
            const currentIds = filteredRuns.map(run => run.id);
            
            // Check if the filtered runs have actually changed
            const hasChanged = previousIds.length !== currentIds.length || 
                              previousIds.some(id => !currentIds.includes(id)) ||
                              currentIds.some(id => !previousIds.includes(id));
            
            if (hasChanged) {
                onSelectionChange(filteredRuns);
            }
        }
        previousFilteredRunsRef.current = filteredRuns;
    }, [autoSelectOnFilterChange, filteredRuns, onSelectionChange]);

    const handleRunSelection = useCallback((
        selectedOptions: readonly TestRunOption[] | null,
    ) => {
        const selected = selectedOptions
            ? selectedOptions.map((option) => option.value)
            : [];
        onSelectionChange(selected);
    }, [onSelectionChange]);

    const handleSelectAllMatching = useCallback(() => {
        // Get all filtered runs that aren't already selected
        const newRuns = filteredRuns.filter(
            (run) => !selectedRuns.some((selected) => selected.id === run.id),
        );

        // Add them to the current selection
        const updatedSelectedRuns = [...selectedRuns, ...newRuns];
        onSelectionChange(updatedSelectedRuns);
    }, [filteredRuns, selectedRuns, onSelectionChange]);

    const getUnselectedMatchingCount = useCallback(() => {
        return filteredRuns.filter(
            (run) => !selectedRuns.some((selected) => selected.id === run.id),
        ).length;
    }, [filteredRuns, selectedRuns]);

    const isRunSelected = useCallback((run: TestRun) => {
        return selectedRuns.some((selected) => selected.id === run.id);
    }, [selectedRuns]);

    const removeFromSelection = useCallback((runId: number) => {
        const updatedSelectedRuns = selectedRuns.filter(
            (run) => run.id !== runId,
        );
        onSelectionChange(updatedSelectedRuns);
    }, [selectedRuns, onSelectionChange]);

    const clearSelection = useCallback(() => {
        onSelectionChange([]);
    }, [onSelectionChange]);

    const isAutoSelectionActive = useMemo(() => {
        return autoSelectAll && selectedRuns.length === filteredRuns.length && 
               filteredRuns.length > 0 && 
               filteredRuns.every(run => selectedRuns.some(selected => selected.id === run.id));
    }, [autoSelectAll, selectedRuns, filteredRuns]);

    const toggleAutoSelection = useCallback(() => {
        if (isAutoSelectionActive) {
            clearSelection();
        } else {
            onSelectionChange(filteredRuns);
        }
    }, [isAutoSelectionActive, clearSelection, onSelectionChange, filteredRuns]);

    return {
        runOptions,
        selectedOptions,
        handleRunSelection,
        handleSelectAllMatching,
        getUnselectedMatchingCount,
        isRunSelected,
        removeFromSelection,
        clearSelection,
        isAutoSelectionActive,
        toggleAutoSelection,
        autoSelectAll,
        autoSelectOnFilterChange,
    };
};
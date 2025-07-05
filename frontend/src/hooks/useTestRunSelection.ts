import { useCallback, useMemo } from 'react';
import type { TestRun } from '../types';

export interface TestRunOption {
    value: TestRun;
    label: string;
    key: number;
}

export const useTestRunSelection = (
    selectedRuns: TestRun[],
    onSelectionChange: (runs: TestRun[]) => void,
    filteredRuns: TestRun[]
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

    return {
        runOptions,
        selectedOptions,
        handleRunSelection,
        handleSelectAllMatching,
        getUnselectedMatchingCount,
        isRunSelected,
        removeFromSelection,
        clearSelection,
    };
};
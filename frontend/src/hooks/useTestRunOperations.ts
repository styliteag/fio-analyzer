import { useState, useCallback } from 'react';
import type { TestRun } from '../types';
import { deleteTestRun } from '../services/api/testRuns';
import { useApiCall } from './useApiCall';

export interface OperationState {
    editModalOpen: boolean;
    testRunToEdit: TestRun | null;
    bulkEditModalOpen: boolean;
    deleting: number | null;
    bulkDeleting: boolean;
}

export interface DeleteResult {
    success: boolean;
    error?: string;
}

export const useTestRunOperations = (
    _testRuns: TestRun[],
    setTestRuns: (runs: TestRun[] | ((prev: TestRun[]) => TestRun[])) => void,
    selectedRuns: TestRun[],
    onSelectionChange: (runs: TestRun[]) => void,
    onFiltersRefresh: () => void
) => {
    const [state, setState] = useState<OperationState>({
        editModalOpen: false,
        testRunToEdit: null,
        bulkEditModalOpen: false,
        deleting: null,
        bulkDeleting: false,
    });

    const handleEditTestRun = useCallback((testRun: TestRun) => {
        setState(prev => ({
            ...prev,
            testRunToEdit: testRun,
            editModalOpen: true,
        }));
    }, []);

    const handleCloseEditModal = useCallback(() => {
        setState(prev => ({
            ...prev,
            editModalOpen: false,
            testRunToEdit: null,
        }));
    }, []);

    const handleSaveTestRun = useCallback((updatedTestRun: TestRun) => {
        // Update the test runs list
        setTestRuns((prev) =>
            prev.map((run) => (run.id === updatedTestRun.id ? updatedTestRun : run)),
        );

        // Update selected runs if this run is selected
        const updatedSelectedRuns = selectedRuns.map((run) =>
            run.id === updatedTestRun.id ? updatedTestRun : run,
        );
        onSelectionChange(updatedSelectedRuns);

        // Refresh filters to include any new drive types/models
        onFiltersRefresh();
    }, [setTestRuns, selectedRuns, onSelectionChange, onFiltersRefresh]);

    const handleBulkEdit = useCallback(() => {
        setState(prev => ({
            ...prev,
            bulkEditModalOpen: true,
        }));
    }, []);

    const handleCloseBulkEditModal = useCallback(() => {
        setState(prev => ({
            ...prev,
            bulkEditModalOpen: false,
        }));
    }, []);

    const handleBulkSave = useCallback((updatedRuns: TestRun[]) => {
        // Update the test runs list with all updated runs
        setTestRuns((prev) => {
            const updatedMap = new Map(updatedRuns.map((run) => [run.id, run]));
            return prev.map((run) => updatedMap.get(run.id) || run);
        });

        // Update selected runs with the updated data
        const updatedMap = new Map(updatedRuns.map((run) => [run.id, run]));
        const updatedSelectedRuns = selectedRuns.map(
            (run) => updatedMap.get(run.id) || run,
        );
        onSelectionChange(updatedSelectedRuns);

        // Refresh filters to include any new drive types/models
        onFiltersRefresh();
    }, [setTestRuns, selectedRuns, onSelectionChange, onFiltersRefresh]);

    // Use standardized API call for single test run deletion
    const {
        loading: deleteLoading,
        execute: executeDelete
    } = useApiCall({
        onSuccess: () => {
            // Refresh filters
            onFiltersRefresh();
        },
        onError: (error) => console.error('Delete failed:', error)
    });

    const handleDeleteTestRun = useCallback(async (testRun: TestRun): Promise<DeleteResult> => {
        if (
            !confirm(
                `Are you sure you want to delete the test run "${testRun.test_name}" for ${testRun.drive_model}?`,
            )
        ) {
            return { success: false };
        }

        setState(prev => ({ ...prev, deleting: testRun.id }));

        try {
            const success = await executeDelete(() => deleteTestRun(testRun.id));
            
            if (!success) {
                return { success: false, error: 'Failed to delete test run' };
            }

            // Remove from test runs list
            setTestRuns((prev) => prev.filter((run) => run.id !== testRun.id));

            // Remove from selected runs if it was selected
            const updatedSelectedRuns = selectedRuns.filter(
                (run) => run.id !== testRun.id,
            );
            onSelectionChange(updatedSelectedRuns);

            return { success: true };
        } finally {
            setState(prev => ({ ...prev, deleting: null }));
        }
    }, [setTestRuns, selectedRuns, onSelectionChange, executeDelete]);

    const handleBulkDelete = useCallback(async (): Promise<DeleteResult> => {
        if (
            !confirm(
                `Are you sure you want to delete all ${selectedRuns.length} selected test runs? This action cannot be undone.`,
            )
        ) {
            return { success: false };
        }

        setState(prev => ({ ...prev, bulkDeleting: true }));
        let deletedCount = 0;
        let failedCount = 0;

        try {
            // Delete each test run sequentially to avoid overwhelming the server
            for (const testRun of selectedRuns) {
                try {
                    const result = await deleteTestRun(testRun.id);
                    if (!result.error) {
                        deletedCount++;
                        // Remove from test runs list immediately
                        setTestRuns((prev) => prev.filter((run) => run.id !== testRun.id));
                    } else {
                        failedCount++;
                        console.error(`Failed to delete test run ${testRun.id}:`, result.error);
                    }
                } catch (err) {
                    console.error(`Failed to delete test run ${testRun.id}:`, err);
                    failedCount++;
                }
            }

            // Clear selected runs since they've been deleted
            onSelectionChange([]);

            // Refresh filters
            onFiltersRefresh();

            // Return summary
            const message = failedCount > 0 
                ? `Bulk delete completed. ${deletedCount} test runs deleted successfully, ${failedCount} failed.`
                : `All ${deletedCount} test runs deleted successfully.`;

            return { success: true, error: message };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : "An unexpected error occurred during bulk delete" 
            };
        } finally {
            setState(prev => ({ ...prev, bulkDeleting: false }));
        }
    }, [selectedRuns, setTestRuns, onSelectionChange, onFiltersRefresh]);

    return {
        state,
        deleteLoading,
        handleEditTestRun,
        handleCloseEditModal,
        handleSaveTestRun,
        handleBulkEdit,
        handleCloseBulkEditModal,
        handleBulkSave,
        handleDeleteTestRun,
        handleBulkDelete,
    };
};
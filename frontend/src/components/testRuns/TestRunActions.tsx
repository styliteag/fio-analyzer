import React from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import type { TestRun } from '../../types';

interface TestRunActionsProps {
    selectedRuns: TestRun[];
    hasActiveFilters: boolean;
    unselectedMatchingCount: number;
    onSelectAllMatching: () => void;
    onBulkEdit: () => void;
    onBulkDelete: () => void;
    bulkDeleting: boolean;
}

const TestRunActions: React.FC<TestRunActionsProps> = ({
    selectedRuns,
    hasActiveFilters,
    unselectedMatchingCount,
    onSelectAllMatching,
    onBulkEdit,
    onBulkDelete,
    bulkDeleting,
}) => {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium theme-text-secondary">
                    Selected Runs ({selectedRuns.length}):
                </h3>
                {selectedRuns.length > 1 && (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onBulkEdit}
                            className="inline-flex items-center px-2 py-1 text-xs theme-btn-secondary border rounded transition-colors"
                            title="Edit all selected test runs at once"
                            disabled={bulkDeleting}
                        >
                            <Users className="h-3 w-3 mr-1" />
                            Edit All
                        </button>
                        <button
                            type="button"
                            onClick={onBulkDelete}
                            className="inline-flex items-center px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white border border-red-600 rounded transition-colors"
                            title="Delete all selected test runs"
                            disabled={bulkDeleting}
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {bulkDeleting ? "Deleting..." : "Delete All"}
                        </button>
                    </div>
                )}
            </div>
            {hasActiveFilters && unselectedMatchingCount > 0 && (
                <button
                    type="button"
                    onClick={onSelectAllMatching}
                    className="inline-flex items-center px-2 py-1 text-xs theme-btn-primary rounded transition-colors"
                    title={`Add all ${unselectedMatchingCount} matching test runs`}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add All ({unselectedMatchingCount})
                </button>
            )}
        </div>
    );
};

export default TestRunActions;
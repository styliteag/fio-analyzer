import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import type { TestRun } from '../../types';

interface TestRunGridProps {
    selectedRuns: TestRun[];
    onEdit: (testRun: TestRun) => void;
    onDelete: (testRun: TestRun) => void;
    deleting: number | null;
}

const TestRunGrid: React.FC<TestRunGridProps> = ({
    selectedRuns,
    onEdit,
    onDelete,
    deleting,
}) => {
    // Configuration for responsive grid columns
    const SELECTED_RUNS_COLUMNS = {
        sm: 2, // 2 columns on small screens (mobile)
        md: 3, // 3 columns on medium screens (tablet)
        lg: 4, // 4 columns on large screens (laptop)
        xl: 5, // 5 columns on extra large screens (desktop)
        "2xl": 6, // 6 columns on 2xl screens (wide desktop)
    };

    if (selectedRuns.length === 0) {
        return null;
    }

    return (
        <div className="mt-4">
            <div className="max-h-48 overflow-y-auto border theme-border-secondary rounded-md p-2 theme-bg-tertiary">
                <div
                    className={`grid gap-2 grid-cols-${SELECTED_RUNS_COLUMNS.sm} md:grid-cols-${SELECTED_RUNS_COLUMNS.md} lg:grid-cols-${SELECTED_RUNS_COLUMNS.lg} xl:grid-cols-${SELECTED_RUNS_COLUMNS.xl} 2xl:grid-cols-${SELECTED_RUNS_COLUMNS["2xl"]}`}
                >
                    {selectedRuns.map((run) => (
                        <div
                            key={run.id}
                            className="theme-bg-secondary p-2 rounded text-xs relative group border theme-border-primary"
                        >
                            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
                                <button
                                    type="button"
                                    onClick={() => onEdit(run)}
                                    className="p-0.5 rounded theme-hover"
                                    title="Edit drive info"
                                    disabled={deleting === run.id}
                                >
                                    <Edit2 className="h-2.5 w-2.5 theme-text-secondary" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(run)}
                                    className="p-0.5 rounded theme-hover"
                                    title="Delete test run"
                                    disabled={deleting === run.id}
                                >
                                    <Trash2 className="h-2.5 w-2.5 theme-text-error" />
                                </button>
                            </div>
                            <div className="pl-6">
                                <div className="font-medium theme-text-primary text-xs truncate">
                                    {run.drive_model}
                                </div>
                                <div className="theme-text-secondary text-xs truncate">
                                    {run.test_name}
                                </div>
                                <div className="theme-text-tertiary text-xs">
                                    {run.block_size}, QD{run.queue_depth}
                                </div>
                                {(run.hostname || run.protocol) && (
                                    <div className="theme-text-tertiary text-xs truncate mt-0.5">
                                        {run.hostname && <span>📡 {run.hostname}</span>}
                                        {run.hostname && run.protocol && (
                                            <span className="mx-1">•</span>
                                        )}
                                        {run.protocol && <span>🔗 {run.protocol}</span>}
                                    </div>
                                )}
                                <div className="theme-text-tertiary mt-0.5">
                                    <span className="inline-block px-1 py-0.5 theme-bg-accent theme-text-accent rounded text-xs">
                                        {run.drive_type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TestRunGrid;
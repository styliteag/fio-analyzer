import React from 'react';
import { Edit2, Trash2, HardDrive, Network, Server, Activity } from 'lucide-react';
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

    // Helper function to get drive type icon
    const getDriveTypeIcon = (driveType: string) => {
        switch (driveType.toLowerCase()) {
            case 'nvme':
            case 'ssd':
                return <HardDrive className="h-3 w-3" />;
            case 'hdd':
                return <HardDrive className="h-3 w-3" />;
            default:
                return <HardDrive className="h-3 w-3" />;
        }
    };

    // Helper function to get protocol icon
    const getProtocolIcon = (protocol: string) => {
        switch (protocol.toLowerCase()) {
            case 'nfs':
            case 'smb':
                return <Network className="h-3 w-3" />;
            case 'nvme':
                return <Activity className="h-3 w-3" />;
            default:
                return <Network className="h-3 w-3" />;
        }
    };

    // Helper function to format date
    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    };

    return (
        <div className="mt-4">
            <div className="max-h-60 overflow-y-auto border theme-border-secondary rounded-md p-3 theme-bg-tertiary">
                <div
                    className={`grid gap-3 grid-cols-${SELECTED_RUNS_COLUMNS.sm} md:grid-cols-${SELECTED_RUNS_COLUMNS.md} lg:grid-cols-${SELECTED_RUNS_COLUMNS.lg} xl:grid-cols-${SELECTED_RUNS_COLUMNS.xl} 2xl:grid-cols-${SELECTED_RUNS_COLUMNS["2xl"]}`}
                >
                    {selectedRuns.map((run) => (
                        <div
                            key={run.id}
                            className="theme-bg-secondary p-3 rounded-md text-xs relative group border theme-border-primary hover:theme-bg-primary transition-colors"
                        >
                            {/* Action buttons */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => onEdit(run)}
                                    className="p-1 rounded theme-hover"
                                    title="Edit drive info"
                                    disabled={deleting === run.id}
                                >
                                    <Edit2 className="h-3 w-3 theme-text-secondary" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(run)}
                                    className="p-1 rounded theme-hover"
                                    title="Delete test run"
                                    disabled={deleting === run.id}
                                >
                                    <Trash2 className="h-3 w-3 theme-text-error" />
                                </button>
                            </div>

                            {/* Drive info */}
                            <div className="space-y-1">
                                <div className="font-medium theme-text-primary text-sm truncate pr-8">
                                    {run.drive_model}
                                </div>
                                
                                {/* Test pattern */}
                                <div className="flex items-center gap-1 theme-text-secondary">
                                    <Activity className="h-3 w-3" />
                                    <span className="truncate">{run.test_name}</span>
                                </div>

                                {/* Block size and queue depth */}
                                <div className="flex items-center gap-2 theme-text-tertiary text-xs">
                                    <span>{run.block_size}</span>
                                    <span>•</span>
                                    <span>QD{run.queue_depth}</span>
                                </div>

                                {/* Hostname and protocol */}
                                {(run.hostname || run.protocol) && (
                                    <div className="flex items-center gap-2 theme-text-tertiary text-xs">
                                        {run.hostname && (
                                            <div className="flex items-center gap-1">
                                                <Server className="h-3 w-3" />
                                                <span className="truncate">{run.hostname}</span>
                                            </div>
                                        )}
                                        {run.protocol && (
                                            <div className="flex items-center gap-1">
                                                {getProtocolIcon(run.protocol)}
                                                <span>{run.protocol}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Drive type and date */}
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1">
                                        {getDriveTypeIcon(run.drive_type)}
                                        <span className="px-2 py-0.5 theme-bg-accent theme-text-accent rounded text-xs">
                                            {run.drive_type}
                                        </span>
                                    </div>
                                    <span className="theme-text-tertiary text-xs">
                                        {formatDate(run.timestamp)}
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
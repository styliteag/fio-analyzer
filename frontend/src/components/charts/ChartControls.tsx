// Chart interactive controls component
import React from 'react';
import { ArrowUpDown, Filter, Layers } from 'lucide-react';
import { Select } from '../ui';
import type { PerformanceData } from '../../types';

export type SortOption = 
    | "name"
    | "iops" 
    | "latency"
    | "bandwidth"
    | "blocksize"
    | "drivemodel"
    | "protocol"
    | "hostname"
    | "queuedepth";

export type GroupOption = 
    | "none"
    | "drive"
    | "test"
    | "blocksize"
    | "protocol"
    | "hostname"
    | "queuedepth"
    | "iodepth"
    | "numjobs"
    | "direct"
    | "sync"
    | "testsize"
    | "duration";

// Helper function to get available group options based on data
const getAvailableGroupOptions = (data: PerformanceData[]): { value: GroupOption; label: string }[] => {
    const baseOptions = [
        { value: "none" as GroupOption, label: "No Grouping" },
        { value: "drive" as GroupOption, label: "Drive Model" },
        { value: "test" as GroupOption, label: "Test Type" },
        { value: "blocksize" as GroupOption, label: "Block Size" },
    ];

    // Check for protocol diversity
    const protocols = new Set(data.map(item => item.protocol).filter(Boolean));
    if (protocols.size > 1) {
        baseOptions.push({ value: "protocol" as GroupOption, label: "Protocol" });
    }

    // Check for hostname diversity
    const hostnames = new Set(data.map(item => item.hostname).filter(Boolean));
    if (hostnames.size > 1) {
        baseOptions.push({ value: "hostname" as GroupOption, label: "Hostname" });
    }

    // Check for queue depth diversity
    const queueDepths = new Set(data.map(item => item.queue_depth || (item as any).iodepth).filter(d => d !== undefined && d !== null));
    if (queueDepths.size > 1) {
        baseOptions.push({ value: "queuedepth" as GroupOption, label: "Queue Depth" });
    }

    // Check for IO depth diversity (separate from queue depth)
    const ioDepths = new Set(data.map(item => (item as any).iodepth).filter(d => d !== undefined && d !== null));
    if (ioDepths.size > 1) {
        baseOptions.push({ value: "iodepth" as GroupOption, label: "IO Depth" });
    }

    // Check for num jobs diversity
    const numJobs = new Set(data.map(item => (item as any).num_jobs).filter(d => d !== undefined && d !== null));
    if (numJobs.size > 1) {
        baseOptions.push({ value: "numjobs" as GroupOption, label: "Number of Jobs" });
    }

    // Check for direct IO diversity
    const directIO = new Set(data.map(item => (item as any).direct).filter(d => d !== undefined && d !== null));
    if (directIO.size > 1) {
        baseOptions.push({ value: "direct" as GroupOption, label: "Direct IO" });
    }

    // Check for sync mode diversity
    const syncModes = new Set(data.map(item => (item as any).sync).filter(d => d !== undefined && d !== null));
    if (syncModes.size > 1) {
        baseOptions.push({ value: "sync" as GroupOption, label: "Sync Mode" });
    }

    // Check for test size diversity
    const testSizes = new Set(data.map(item => (item as any).test_size).filter(Boolean));
    if (testSizes.size > 1) {
        baseOptions.push({ value: "testsize" as GroupOption, label: "Test Size" });
    }

    // Check for duration diversity
    const durations = new Set(data.map(item => (item as any).duration).filter(d => d !== undefined && d !== null));
    if (durations.size > 1) {
        baseOptions.push({ value: "duration" as GroupOption, label: "Runtime" });
    }

    return baseOptions;
};

export interface ChartControlsProps {
    sortBy: SortOption;
    setSortBy: (sort: SortOption) => void;
    sortOrder: "asc" | "desc";
    setSortOrder: (order: "asc" | "desc") => void;
    groupBy: GroupOption;
    setGroupBy: (group: GroupOption) => void;
    showControls: boolean;
    onToggleControls: () => void;
    data?: PerformanceData[];
    className?: string;
}

const ChartControls: React.FC<ChartControlsProps> = ({
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    groupBy,
    setGroupBy,
    showControls,
    onToggleControls,
    data = [],
    className = '',
}) => {
    const sortOptions = [
        { value: "name", label: "Name" },
        { value: "iops", label: "IOPS" },
        { value: "latency", label: "Latency" },
        { value: "bandwidth", label: "Bandwidth" },
        { value: "blocksize", label: "Block Size" },
        { value: "drivemodel", label: "Drive Model" },
        { value: "protocol", label: "Protocol" },
        { value: "hostname", label: "Hostname" },
        { value: "queuedepth", label: "Queue Depth" },
    ];

    const groupOptions = getAvailableGroupOptions(data);

    return (
        <div className={className}>
            {/* Controls Toggle Button */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={onToggleControls}
                    className="flex items-center px-3 py-2 text-sm border rounded-lg transition-colors theme-border-primary theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary"
                >
                    <Filter size={16} className="mr-2" />
                    {showControls ? 'Hide Controls' : 'Show Controls'}
                </button>
            </div>

            {/* Interactive Controls */}
            {showControls && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border theme-border-primary theme-bg-secondary">
                    {/* Sort By */}
                    <div>
                        <label className="block text-sm font-medium mb-2 theme-text-primary">
                            <ArrowUpDown size={16} className="inline mr-1" />
                            Sort By
                        </label>
                        <Select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            options={sortOptions}
                            fullWidth
                        />
                    </div>

                    {/* Sort Order */}
                    <div>
                        <label className="block text-sm font-medium mb-2 theme-text-primary">
                            Order
                        </label>
                        <Select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                            options={[
                                { value: "asc", label: "Ascending" },
                                { value: "desc", label: "Descending" },
                            ]}
                            fullWidth
                        />
                    </div>

                    {/* Group By */}
                    <div>
                        <label className="block text-sm font-medium mb-2 theme-text-primary">
                            <Layers size={16} className="inline mr-1" />
                            Group By
                        </label>
                        <Select
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value as GroupOption)}
                            options={groupOptions}
                            fullWidth
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartControls;
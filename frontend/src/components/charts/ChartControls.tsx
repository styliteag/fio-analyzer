// Chart interactive controls component
import React from 'react';
import { ArrowUpDown, Filter, Layers } from 'lucide-react';
import { Select } from '../ui';

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

export interface ChartControlsProps {
    sortBy: SortOption;
    setSortBy: (sort: SortOption) => void;
    sortOrder: "asc" | "desc";
    setSortOrder: (order: "asc" | "desc") => void;
    groupBy: GroupOption;
    setGroupBy: (group: GroupOption) => void;
    showControls: boolean;
    onToggleControls: () => void;
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

    const groupOptions = [
        { value: "none", label: "No Grouping" },
        { value: "drive", label: "Drive Model" },
        { value: "test", label: "Test Type" },
        { value: "blocksize", label: "Block Size" },
        { value: "protocol", label: "Protocol" },
        { value: "hostname", label: "Hostname" },
        { value: "queuedepth", label: "Queue Depth" },
        { value: "iodepth", label: "IO Depth" },
        { value: "numjobs", label: "Number of Jobs" },
        { value: "direct", label: "Direct IO" },
        { value: "sync", label: "Sync Mode" },
        { value: "testsize", label: "Test Size" },
        { value: "duration", label: "Runtime" },
    ];

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
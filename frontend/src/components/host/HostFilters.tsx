import React, { memo, useCallback, useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import type { TestCoverage } from '../../services/api/hostAnalysis';

interface HostFiltersProps {
    testCoverage: TestCoverage;
    selectedBlockSizes: string[];
    selectedPatterns: string[];
    selectedQueueDepths: number[];
    selectedNumJobs: number[];
    selectedProtocols: string[];
    selectedHostDiskCombinations: string[];
    onBlockSizeChange: (blockSizes: string[]) => void;
    onPatternChange: (patterns: string[]) => void;
    onQueueDepthChange: (queueDepths: number[]) => void;
    onNumJobsChange: (numJobs: number[]) => void;
    onProtocolChange: (protocols: string[]) => void;
    onHostDiskCombinationChange: (combinations: string[]) => void;
    onReset: () => void;
}

// Individual FilterSection component for better memoization
const FilterSection = memo<{
    title: string;
    options: (string | number)[];
    selectedValues: (string | number)[];
    onChange: (values: any[]) => void;
    colorClass: string;
    prefix?: string;
}>(({ title, options, selectedValues, onChange, colorClass, prefix = '' }) => {
    const handleFilterChange = useCallback((value: string | number) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    }, [selectedValues, onChange]);

    return (
        <div>
            <h4 className="font-medium theme-text-primary mb-3">{title}</h4>
            <div className="flex flex-wrap gap-2">
                {options.map(option => {
                    const displayValue = typeof option === 'number' && prefix 
                        ? `${prefix}${option}` 
                        : option.toString();
                    const isSelected = selectedValues.includes(option);
                    
                    return (
                        <button
                            key={option.toString()}
                            onClick={() => handleFilterChange(option)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                isSelected
                                    ? colorClass + ' text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {displayValue}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

FilterSection.displayName = 'FilterSection';

// ActiveFilters summary component for better memoization
const ActiveFilters = memo<{
    selectedBlockSizes: string[];
    selectedPatterns: string[];
    selectedQueueDepths: number[];
    selectedNumJobs: number[];
    selectedProtocols: string[];
    selectedHostDiskCombinations: string[];
}>(({ selectedBlockSizes, selectedPatterns, selectedQueueDepths, selectedNumJobs, selectedProtocols, selectedHostDiskCombinations }) => {
    const hasActiveFilters = useMemo(() => {
        return selectedBlockSizes.length > 0 || 
               selectedPatterns.length > 0 || 
               selectedQueueDepths.length > 0 || 
               selectedNumJobs.length > 0 ||
               selectedProtocols.length > 0 || 
               selectedHostDiskCombinations.length > 0;
    }, [selectedBlockSizes, selectedPatterns, selectedQueueDepths, selectedNumJobs, selectedProtocols, selectedHostDiskCombinations]);

    return (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm theme-text-secondary">
                <div className="mb-2">
                    <span className="font-medium">Active Filters:</span>
                </div>
                <div className="space-y-1">
                    {selectedBlockSizes.length > 0 && (
                        <div>Block Sizes: {selectedBlockSizes.join(', ')}</div>
                    )}
                    {selectedPatterns.length > 0 && (
                        <div>Patterns: {selectedPatterns.join(', ')}</div>
                    )}
                    {selectedQueueDepths.length > 0 && (
                        <div>Queue Depths: {selectedQueueDepths.map(qd => `QD${qd}`).join(', ')}</div>
                    )}
                    {selectedNumJobs.length > 0 && (
                        <div>Num Jobs: {selectedNumJobs.map(nj => `Jobs:${nj}`).join(', ')}</div>
                    )}
                    {selectedProtocols.length > 0 && (
                        <div>Protocols: {selectedProtocols.join(', ')}</div>
                    )}
                    {selectedHostDiskCombinations.length > 0 && (
                        <div>Host-Disk: {selectedHostDiskCombinations.join(', ')}</div>
                    )}
                    {!hasActiveFilters && (
                        <div className="italic">No filters applied</div>
                    )}
                </div>
            </div>
        </div>
    );
});

ActiveFilters.displayName = 'ActiveFilters';

const HostFilters: React.FC<HostFiltersProps> = ({
    testCoverage,
    selectedBlockSizes,
    selectedPatterns,
    selectedQueueDepths,
    selectedNumJobs,
    selectedProtocols,
    selectedHostDiskCombinations,
    onBlockSizeChange,
    onPatternChange,
    onQueueDepthChange,
    onNumJobsChange,
    onProtocolChange,
    onHostDiskCombinationChange,
    onReset
}) => {
    // Memoized reset handler
    const handleReset = useCallback(() => {
        onReset();
    }, [onReset]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 theme-text-primary" />
                    <h3 className="text-lg font-semibold theme-text-primary">Filters</h3>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="flex items-center gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                </Button>
            </div>

            <div className="space-y-6">
                <FilterSection
                    title="Block Sizes"
                    options={testCoverage.blockSizes}
                    selectedValues={selectedBlockSizes}
                    onChange={onBlockSizeChange}
                    colorClass="bg-blue-500"
                />
                
                <FilterSection
                    title="Read/Write Patterns"
                    options={testCoverage.patterns}
                    selectedValues={selectedPatterns}
                    onChange={onPatternChange}
                    colorClass="bg-green-500"
                />
                
                <FilterSection
                    title="Queue Depths"
                    options={testCoverage.queueDepths}
                    selectedValues={selectedQueueDepths}
                    onChange={onQueueDepthChange}
                    colorClass="bg-purple-500"
                    prefix="QD"
                />
                
                <FilterSection
                    title="Number of Jobs"
                    options={testCoverage.numJobs}
                    selectedValues={selectedNumJobs}
                    onChange={onNumJobsChange}
                    colorClass="bg-cyan-500"
                    prefix="Jobs:"
                />
                
                <FilterSection
                    title="Protocols"
                    options={testCoverage.protocols}
                    selectedValues={selectedProtocols}
                    onChange={onProtocolChange}
                    colorClass="bg-orange-500"
                />
                
                <FilterSection
                    title="Host-Protocol-Disk"
                    options={testCoverage.hostDiskCombinations}
                    selectedValues={selectedHostDiskCombinations}
                    onChange={onHostDiskCombinationChange}
                    colorClass="bg-indigo-500"
                />

                <ActiveFilters
                    selectedBlockSizes={selectedBlockSizes}
                    selectedPatterns={selectedPatterns}
                    selectedQueueDepths={selectedQueueDepths}
                    selectedNumJobs={selectedNumJobs}
                    selectedProtocols={selectedProtocols}
                    selectedHostDiskCombinations={selectedHostDiskCombinations}
                />
            </div>
        </div>
    );
};

// Export memoized version with deep comparison for arrays
export default memo(HostFilters, (prevProps, nextProps) => {
    // Check if testCoverage object changed
    if (prevProps.testCoverage !== nextProps.testCoverage) {
        return false;
    }

    // Check if callback functions changed (these should be memoized by parent)
    if (prevProps.onReset !== nextProps.onReset ||
        prevProps.onBlockSizeChange !== nextProps.onBlockSizeChange ||
        prevProps.onPatternChange !== nextProps.onPatternChange ||
        prevProps.onQueueDepthChange !== nextProps.onQueueDepthChange ||
        prevProps.onNumJobsChange !== nextProps.onNumJobsChange ||
        prevProps.onProtocolChange !== nextProps.onProtocolChange ||
        prevProps.onHostDiskCombinationChange !== nextProps.onHostDiskCombinationChange) {
        return false;
    }

    // Helper function to compare arrays
    const arraysEqual = (a: any[], b: any[]) => {
        if (a.length !== b.length) return false;
        return a.every((val, index) => val === b[index]);
    };

    // Compare selected filter arrays
    return arraysEqual(prevProps.selectedBlockSizes, nextProps.selectedBlockSizes) &&
           arraysEqual(prevProps.selectedPatterns, nextProps.selectedPatterns) &&
           arraysEqual(prevProps.selectedQueueDepths, nextProps.selectedQueueDepths) &&
           arraysEqual(prevProps.selectedNumJobs, nextProps.selectedNumJobs) &&
           arraysEqual(prevProps.selectedProtocols, nextProps.selectedProtocols) &&
           arraysEqual(prevProps.selectedHostDiskCombinations, nextProps.selectedHostDiskCombinations);
});
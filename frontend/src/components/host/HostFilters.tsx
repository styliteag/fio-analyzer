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
    selectedFilterHosts: string[];
    selectedDriveTypes: string[];
    selectedDriveModels: string[];
    selectedSyncs: number[];
    selectedDirects: number[];
    selectedIoDepths: number[];
    selectedTestSizes: string[];
    selectedDurations: number[];
    onBlockSizeChange: (blockSizes: string[]) => void;
    onPatternChange: (patterns: string[]) => void;
    onQueueDepthChange: (queueDepths: number[]) => void;
    onNumJobsChange: (numJobs: number[]) => void;
    onProtocolChange: (protocols: string[]) => void;
    onFilterHostChange: (hosts: string[]) => void;
    onDriveTypeChange: (types: string[]) => void;
    onDriveModelChange: (models: string[]) => void;
    onSyncChange: (syncs: number[]) => void;
    onDirectChange: (directs: number[]) => void;
    onIoDepthChange: (ioDepths: number[]) => void;
    onTestSizeChange: (testSizes: string[]) => void;
    onDurationChange: (durations: number[]) => void;
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
    labelMap?: Record<string | number, string>;
}>(({ title, options, selectedValues, onChange, colorClass, prefix = '', labelMap }) => {
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
                    let displayValue: string;
                    if (labelMap && option in labelMap) {
                        displayValue = labelMap[option];
                    } else if (typeof option === 'number' && prefix) {
                        displayValue = `${prefix}${option}`;
                    } else {
                        displayValue = option.toString();
                    }
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
    selectedFilterHosts: string[];
    selectedDriveTypes: string[];
    selectedDriveModels: string[];
    selectedSyncs: number[];
    selectedDirects: number[];
    selectedIoDepths: number[];
    selectedTestSizes: string[];
    selectedDurations: number[];
}>(({ selectedBlockSizes, selectedPatterns, selectedQueueDepths, selectedNumJobs, selectedProtocols,     selectedFilterHosts, selectedDriveTypes, selectedDriveModels, selectedSyncs, selectedDirects, selectedIoDepths, selectedTestSizes, selectedDurations }) => {
    const hasActiveFilters = useMemo(() => {
        return selectedBlockSizes.length > 0 || 
               selectedPatterns.length > 0 || 
               selectedQueueDepths.length > 0 || 
               selectedNumJobs.length > 0 ||
               selectedProtocols.length > 0 || 
               selectedFilterHosts.length > 0 ||
               selectedDriveTypes.length > 0 ||
               selectedDriveModels.length > 0 ||
               selectedSyncs.length > 0 ||
               selectedDirects.length > 0 ||
               selectedIoDepths.length > 0 ||
               selectedTestSizes.length > 0 ||
               selectedDurations.length > 0;
    }, [selectedBlockSizes, selectedPatterns, selectedQueueDepths, selectedNumJobs, selectedProtocols, selectedFilterHosts, selectedDriveTypes, selectedDriveModels, selectedSyncs, selectedDirects, selectedIoDepths, selectedTestSizes, selectedDurations]);

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
                    {selectedFilterHosts.length > 0 && (
                        <div>Hosts: {selectedFilterHosts.join(', ')}</div>
                    )}
                    {selectedDriveTypes.length > 0 && (
                        <div>Drive Types: {selectedDriveTypes.join(', ')}</div>
                    )}
                    {selectedDriveModels.length > 0 && (
                        <div>Drive Models: {selectedDriveModels.join(', ')}</div>
                    )}
                    {selectedSyncs.length > 0 && (
                        <div>Sync: {selectedSyncs.map(s => s === 1 ? 'On' : 'Off').join(', ')}</div>
                    )}
                    {selectedDirects.length > 0 && (
                        <div>Direct I/O: {selectedDirects.map(d => d === 1 ? 'On' : 'Off').join(', ')}</div>
                    )}
                    {selectedIoDepths.length > 0 && (
                        <div>I/O Depth: {selectedIoDepths.map(d => `IOD${d}`).join(', ')}</div>
                    )}
                    {selectedTestSizes.length > 0 && (
                        <div>Test Size: {selectedTestSizes.join(', ')}</div>
                    )}
                    {selectedDurations.length > 0 && (
                        <div>Duration: {selectedDurations.map(d => `${d}s`).join(', ')}</div>
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
    selectedFilterHosts,
    selectedDriveTypes,
    selectedDriveModels,
    selectedSyncs,
    selectedDirects,
    selectedIoDepths,
    selectedTestSizes,
    selectedDurations,
    onBlockSizeChange,
    onPatternChange,
    onQueueDepthChange,
    onNumJobsChange,
    onProtocolChange,
    onFilterHostChange,
    onDriveTypeChange,
    onDriveModelChange,
    onSyncChange,
    onDirectChange,
    onIoDepthChange,
    onTestSizeChange,
    onDurationChange,
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
                    title="Hosts"
                    options={testCoverage.hosts}
                    selectedValues={selectedFilterHosts}
                    onChange={onFilterHostChange}
                    colorClass="bg-indigo-500"
                />
                
                <FilterSection
                    title="Drive Type"
                    options={testCoverage.driveTypes}
                    selectedValues={selectedDriveTypes}
                    onChange={onDriveTypeChange}
                    colorClass="bg-rose-500"
                />
                
                <FilterSection
                    title="Drive Model"
                    options={testCoverage.driveModels}
                    selectedValues={selectedDriveModels}
                    onChange={onDriveModelChange}
                    colorClass="bg-fuchsia-500"
                />
                
                <FilterSection
                    title="Sync Mode"
                    options={testCoverage.syncs}
                    selectedValues={selectedSyncs}
                    onChange={onSyncChange}
                    colorClass="bg-pink-500"
                    labelMap={{ 0: 'Off', 1: 'On' }}
                />
                
                <FilterSection
                    title="Direct I/O"
                    options={testCoverage.directs}
                    selectedValues={selectedDirects}
                    onChange={onDirectChange}
                    colorClass="bg-amber-500"
                    labelMap={{ 0: 'Off', 1: 'On' }}
                />
                
                <FilterSection
                    title="I/O Depth"
                    options={testCoverage.ioDepths}
                    selectedValues={selectedIoDepths}
                    onChange={onIoDepthChange}
                    colorClass="bg-teal-500"
                    prefix="IOD"
                />
                
                <FilterSection
                    title="Test Size"
                    options={testCoverage.testSizes}
                    selectedValues={selectedTestSizes}
                    onChange={onTestSizeChange}
                    colorClass="bg-violet-500"
                />
                
                <FilterSection
                    title="Duration"
                    options={testCoverage.durations}
                    selectedValues={selectedDurations}
                    onChange={onDurationChange}
                    colorClass="bg-emerald-500"
                    prefix=""
                    labelMap={Object.fromEntries(testCoverage.durations.map(d => [d, `${d}s`]))}
                />

                <ActiveFilters
                    selectedBlockSizes={selectedBlockSizes}
                    selectedPatterns={selectedPatterns}
                    selectedQueueDepths={selectedQueueDepths}
                    selectedNumJobs={selectedNumJobs}
                    selectedProtocols={selectedProtocols}
                    selectedFilterHosts={selectedFilterHosts}
                    selectedDriveTypes={selectedDriveTypes}
                    selectedDriveModels={selectedDriveModels}
                    selectedSyncs={selectedSyncs}
                    selectedDirects={selectedDirects}
                    selectedIoDepths={selectedIoDepths}
                    selectedTestSizes={selectedTestSizes}
                    selectedDurations={selectedDurations}
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
        prevProps.onFilterHostChange !== nextProps.onFilterHostChange ||
        prevProps.onDriveTypeChange !== nextProps.onDriveTypeChange ||
        prevProps.onDriveModelChange !== nextProps.onDriveModelChange ||
        prevProps.onSyncChange !== nextProps.onSyncChange ||
        prevProps.onDirectChange !== nextProps.onDirectChange ||
        prevProps.onIoDepthChange !== nextProps.onIoDepthChange ||
        prevProps.onTestSizeChange !== nextProps.onTestSizeChange ||
        prevProps.onDurationChange !== nextProps.onDurationChange) {
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
           arraysEqual(prevProps.selectedFilterHosts, nextProps.selectedFilterHosts) &&
           arraysEqual(prevProps.selectedDriveTypes, nextProps.selectedDriveTypes) &&
           arraysEqual(prevProps.selectedDriveModels, nextProps.selectedDriveModels) &&
           arraysEqual(prevProps.selectedSyncs, nextProps.selectedSyncs) &&
           arraysEqual(prevProps.selectedDirects, nextProps.selectedDirects) &&
           arraysEqual(prevProps.selectedIoDepths, nextProps.selectedIoDepths) &&
           arraysEqual(prevProps.selectedTestSizes, nextProps.selectedTestSizes) &&
           arraysEqual(prevProps.selectedDurations, nextProps.selectedDurations);
});
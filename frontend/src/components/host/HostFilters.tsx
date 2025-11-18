import React, { memo, useCallback, useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import type { TestCoverage, HostAnalysisData } from '../../services/api/hostAnalysis';

interface HostFiltersProps {
    testCoverage: TestCoverage;
    combinedHostData: HostAnalysisData | null;
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
    availableOptions?: Set<string | number>;
    optionCounts?: Map<string | number, number>;
}>(({ title, options, selectedValues, onChange, colorClass, prefix = '', labelMap, availableOptions, optionCounts }) => {
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
                    const isAvailable = availableOptions === undefined || availableOptions.has(option);
                    const runCount = optionCounts?.get(option) ?? 0;
                    const tooltipText = `${runCount} run${runCount !== 1 ? 's' : ''}`;
                    
                    return (
                        <div key={option.toString()} className="relative group">
                            <button
                                onClick={() => isAvailable && handleFilterChange(option)}
                                disabled={!isAvailable}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    !isAvailable
                                        ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                                        : isSelected
                                            ? colorClass + ' text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {displayValue}
                            </button>
                            {/* Tooltip */}
                            {isAvailable && (
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                    {tooltipText}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-0">
                                        <div className="border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
                                    </div>
                                </div>
                            )}
                        </div>
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
    combinedHostData,
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

    // Calculate available options - check if selecting each option would result in any matching data
    const availableOptions = useMemo(() => {
        if (!combinedHostData) {
            return {
                blockSizes: new Set<string>(),
                patterns: new Set<string>(),
                queueDepths: new Set<number>(),
                numJobs: new Set<number>(),
                protocols: new Set<string>(),
                hosts: new Set<string>(),
                driveTypes: new Set<string>(),
                driveModels: new Set<string>(),
                syncs: new Set<number>(),
                directs: new Set<number>(),
                ioDepths: new Set<number>(),
                testSizes: new Set<string>(),
                durations: new Set<number>()
            };
        }

        // Helper function to check if a drive matches current filters (can exclude specific fields)
        const driveMatches = (drive: any, testHost?: string, testProtocol?: string, testDriveType?: string, testDriveModel?: string) => {
            const hostMatch = testHost !== undefined ? drive.hostname === testHost : (selectedFilterHosts.length === 0 || selectedFilterHosts.includes(drive.hostname));
            const protocolMatch = testProtocol !== undefined ? drive.protocol === testProtocol : (selectedProtocols.length === 0 || selectedProtocols.includes(drive.protocol));
            const driveTypeMatch = testDriveType !== undefined ? drive.drive_type === testDriveType : (selectedDriveTypes.length === 0 || selectedDriveTypes.includes(drive.drive_type));
            const driveModelMatch = testDriveModel !== undefined ? drive.drive_model === testDriveModel : (selectedDriveModels.length === 0 || selectedDriveModels.includes(drive.drive_model));
            return hostMatch && protocolMatch && driveTypeMatch && driveModelMatch;
        };

        // Helper function to check if a config matches current filters (can test specific values)
        const configMatches = (config: any, testBlockSize?: string, testPattern?: string, testQueueDepth?: number, testNumJobs?: number, testSync?: number, testDirect?: number, testIoDepth?: number, testTestSize?: string, testDuration?: number) => {
            const blockSizeMatch = testBlockSize !== undefined ? config.block_size === testBlockSize : (selectedBlockSizes.length === 0 || selectedBlockSizes.includes(config.block_size));
            const patternMatch = testPattern !== undefined ? config.read_write_pattern === testPattern : (selectedPatterns.length === 0 || selectedPatterns.includes(config.read_write_pattern));
            const queueDepthMatch = testQueueDepth !== undefined ? config.queue_depth === testQueueDepth : (selectedQueueDepths.length === 0 || selectedQueueDepths.includes(config.queue_depth));
            const numJobsMatch = testNumJobs !== undefined 
                ? (config.num_jobs !== null && config.num_jobs !== undefined && config.num_jobs === testNumJobs)
                : (selectedNumJobs.length === 0 || (config.num_jobs !== null && config.num_jobs !== undefined && selectedNumJobs.includes(config.num_jobs)));
            const syncMatch = testSync !== undefined
                ? (config.sync !== null && config.sync !== undefined && config.sync === testSync)
                : (selectedSyncs.length === 0 || (config.sync !== null && config.sync !== undefined && selectedSyncs.includes(config.sync)));
            const directMatch = testDirect !== undefined
                ? (config.direct !== null && config.direct !== undefined && config.direct === testDirect)
                : (selectedDirects.length === 0 || (config.direct !== null && config.direct !== undefined && selectedDirects.includes(config.direct)));
            const ioDepthMatch = testIoDepth !== undefined
                ? (config.iodepth !== null && config.iodepth !== undefined && config.iodepth === testIoDepth)
                : (selectedIoDepths.length === 0 || (config.iodepth !== null && config.iodepth !== undefined && selectedIoDepths.includes(config.iodepth)));
            const testSizeMatch = testTestSize !== undefined
                ? (config.test_size !== null && config.test_size !== undefined && config.test_size === testTestSize)
                : (selectedTestSizes.length === 0 || (config.test_size !== null && config.test_size !== undefined && selectedTestSizes.includes(config.test_size)));
            const durationMatch = testDuration !== undefined
                ? (config.duration !== null && config.duration !== undefined && config.duration === testDuration)
                : (selectedDurations.length === 0 || (config.duration !== null && config.duration !== undefined && selectedDurations.includes(config.duration)));
            return blockSizeMatch && patternMatch && queueDepthMatch && numJobsMatch && syncMatch && directMatch && ioDepthMatch && testSizeMatch && durationMatch;
        };

        const blockSizes = new Set<string>();
        const patterns = new Set<string>();
        const queueDepths = new Set<number>();
        const numJobs = new Set<number>();
        const protocols = new Set<string>();
        const hosts = new Set<string>();
        const driveTypes = new Set<string>();
        const driveModels = new Set<string>();
        const syncs = new Set<number>();
        const directs = new Set<number>();
        const ioDepths = new Set<number>();
        const testSizes = new Set<string>();
        const durations = new Set<number>();

        // Check each option from testCoverage to see if selecting it would result in any matching data
        // For each option, we check if there's at least one drive/config that matches when we select that option
        
        // Check each host option
        testCoverage.hosts.forEach(host => {
            const hasMatch = combinedHostData.drives.some(drive => {
                if (driveMatches(drive, host)) {
                    return drive.configurations.some(config => configMatches(config));
                }
                return false;
            });
            if (hasMatch) {
                hosts.add(host);
            }
        });
        
        // Check each protocol option
        testCoverage.protocols.forEach(protocol => {
            const hasMatch = combinedHostData.drives.some(drive => {
                if (driveMatches(drive, undefined, protocol)) {
                    return drive.configurations.some(config => configMatches(config));
                }
                return false;
            });
            if (hasMatch) {
                protocols.add(protocol);
            }
        });
        
        // Check each drive type option
        testCoverage.driveTypes.forEach(driveType => {
            const hasMatch = combinedHostData.drives.some(drive => {
                if (driveMatches(drive, undefined, undefined, driveType)) {
                    return drive.configurations.some(config => configMatches(config));
                }
                return false;
            });
            if (hasMatch) {
                driveTypes.add(driveType);
            }
        });
        
        // Check each drive model option
        testCoverage.driveModels.forEach(driveModel => {
            const hasMatch = combinedHostData.drives.some(drive => {
                if (driveMatches(drive, undefined, undefined, undefined, driveModel)) {
                    return drive.configurations.some(config => configMatches(config));
                }
                return false;
            });
            if (hasMatch) {
                driveModels.add(driveModel);
            }
        });

        // Check configuration-level options - only check drives that match current drive-level filters
        combinedHostData.drives.forEach(drive => {
            if (!driveMatches(drive)) {
                return; // Skip drives that don't match current drive-level filters
            }
            
            // Check each block size option
            testCoverage.blockSizes.forEach(blockSize => {
                const hasMatch = drive.configurations.some(config => 
                    config.block_size === blockSize && configMatches(config, blockSize)
                );
                if (hasMatch) {
                    blockSizes.add(blockSize);
                }
            });
            
            // Check each pattern option
            testCoverage.patterns.forEach(pattern => {
                const hasMatch = drive.configurations.some(config => 
                    config.read_write_pattern === pattern && configMatches(config, undefined, pattern)
                );
                if (hasMatch) {
                    patterns.add(pattern);
                }
            });
            
            // Check each queue depth option
            testCoverage.queueDepths.forEach(queueDepth => {
                const hasMatch = drive.configurations.some(config => 
                    config.queue_depth === queueDepth && configMatches(config, undefined, undefined, queueDepth)
                );
                if (hasMatch) {
                    queueDepths.add(queueDepth);
                }
            });
            
            // Check each num jobs option
            testCoverage.numJobs.forEach(numJob => {
                const hasMatch = drive.configurations.some(config => 
                    config.num_jobs !== null && config.num_jobs !== undefined && 
                    config.num_jobs === numJob && 
                    configMatches(config, undefined, undefined, undefined, numJob)
                );
                if (hasMatch) {
                    numJobs.add(numJob);
                }
            });
            
            // Check each sync option
            testCoverage.syncs.forEach(sync => {
                const hasMatch = drive.configurations.some(config => 
                    config.sync !== null && config.sync !== undefined && 
                    config.sync === sync && 
                    configMatches(config, undefined, undefined, undefined, undefined, sync)
                );
                if (hasMatch) {
                    syncs.add(sync);
                }
            });
            
            // Check each direct option
            testCoverage.directs.forEach(direct => {
                const hasMatch = drive.configurations.some(config => 
                    config.direct !== null && config.direct !== undefined && 
                    config.direct === direct && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, direct)
                );
                if (hasMatch) {
                    directs.add(direct);
                }
            });
            
            // Check each iodepth option
            testCoverage.ioDepths.forEach(ioDepth => {
                const hasMatch = drive.configurations.some(config => 
                    config.iodepth !== null && config.iodepth !== undefined && 
                    config.iodepth === ioDepth && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, undefined, ioDepth)
                );
                if (hasMatch) {
                    ioDepths.add(ioDepth);
                }
            });
            
            // Check each test size option
            testCoverage.testSizes.forEach(testSize => {
                const hasMatch = drive.configurations.some(config => 
                    config.test_size !== null && config.test_size !== undefined && 
                    config.test_size === testSize && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, undefined, undefined, testSize)
                );
                if (hasMatch) {
                    testSizes.add(testSize);
                }
            });
            
            // Check each duration option
            testCoverage.durations.forEach(duration => {
                const hasMatch = drive.configurations.some(config => 
                    config.duration !== null && config.duration !== undefined && 
                    config.duration === duration && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, duration)
                );
                if (hasMatch) {
                    durations.add(duration);
                }
            });
        });

        return {
            blockSizes,
            patterns,
            queueDepths,
            numJobs,
            protocols,
            hosts,
            driveTypes,
            driveModels,
            syncs,
            directs,
            ioDepths,
            testSizes,
            durations
        };
    }, [
        combinedHostData,
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
        selectedDurations
    ]);

    // Calculate run counts for each filter option
    const optionCounts = useMemo(() => {
        if (!combinedHostData) {
            return {
                blockSizes: new Map<string | number, number>(),
                patterns: new Map<string | number, number>(),
                queueDepths: new Map<string | number, number>(),
                numJobs: new Map<string | number, number>(),
                protocols: new Map<string | number, number>(),
                hosts: new Map<string | number, number>(),
                driveTypes: new Map<string | number, number>(),
                driveModels: new Map<string | number, number>(),
                syncs: new Map<string | number, number>(),
                directs: new Map<string | number, number>(),
                ioDepths: new Map<string | number, number>(),
                testSizes: new Map<string | number, number>(),
                durations: new Map<string | number, number>()
            };
        }

        // Reuse the same helper functions from availableOptions
        const driveMatches = (drive: any, testHost?: string, testProtocol?: string, testDriveType?: string, testDriveModel?: string) => {
            const hostMatch = testHost !== undefined ? drive.hostname === testHost : (selectedFilterHosts.length === 0 || selectedFilterHosts.includes(drive.hostname));
            const protocolMatch = testProtocol !== undefined ? drive.protocol === testProtocol : (selectedProtocols.length === 0 || selectedProtocols.includes(drive.protocol));
            const driveTypeMatch = testDriveType !== undefined ? drive.drive_type === testDriveType : (selectedDriveTypes.length === 0 || selectedDriveTypes.includes(drive.drive_type));
            const driveModelMatch = testDriveModel !== undefined ? drive.drive_model === testDriveModel : (selectedDriveModels.length === 0 || selectedDriveModels.includes(drive.drive_model));
            return hostMatch && protocolMatch && driveTypeMatch && driveModelMatch;
        };

        const configMatches = (config: any, testBlockSize?: string, testPattern?: string, testQueueDepth?: number, testNumJobs?: number, testSync?: number, testDirect?: number, testIoDepth?: number, testTestSize?: string, testDuration?: number) => {
            const blockSizeMatch = testBlockSize !== undefined ? config.block_size === testBlockSize : (selectedBlockSizes.length === 0 || selectedBlockSizes.includes(config.block_size));
            const patternMatch = testPattern !== undefined ? config.read_write_pattern === testPattern : (selectedPatterns.length === 0 || selectedPatterns.includes(config.read_write_pattern));
            const queueDepthMatch = testQueueDepth !== undefined ? config.queue_depth === testQueueDepth : (selectedQueueDepths.length === 0 || selectedQueueDepths.includes(config.queue_depth));
            const numJobsMatch = testNumJobs !== undefined 
                ? (config.num_jobs !== null && config.num_jobs !== undefined && config.num_jobs === testNumJobs)
                : (selectedNumJobs.length === 0 || (config.num_jobs !== null && config.num_jobs !== undefined && selectedNumJobs.includes(config.num_jobs)));
            const syncMatch = testSync !== undefined
                ? (config.sync !== null && config.sync !== undefined && config.sync === testSync)
                : (selectedSyncs.length === 0 || (config.sync !== null && config.sync !== undefined && selectedSyncs.includes(config.sync)));
            const directMatch = testDirect !== undefined
                ? (config.direct !== null && config.direct !== undefined && config.direct === testDirect)
                : (selectedDirects.length === 0 || (config.direct !== null && config.direct !== undefined && selectedDirects.includes(config.direct)));
            const ioDepthMatch = testIoDepth !== undefined
                ? (config.iodepth !== null && config.iodepth !== undefined && config.iodepth === testIoDepth)
                : (selectedIoDepths.length === 0 || (config.iodepth !== null && config.iodepth !== undefined && selectedIoDepths.includes(config.iodepth)));
            const testSizeMatch = testTestSize !== undefined
                ? (config.test_size !== null && config.test_size !== undefined && config.test_size === testTestSize)
                : (selectedTestSizes.length === 0 || (config.test_size !== null && config.test_size !== undefined && selectedTestSizes.includes(config.test_size)));
            const durationMatch = testDuration !== undefined
                ? (config.duration !== null && config.duration !== undefined && config.duration === testDuration)
                : (selectedDurations.length === 0 || (config.duration !== null && config.duration !== undefined && selectedDurations.includes(config.duration)));
            return blockSizeMatch && patternMatch && queueDepthMatch && numJobsMatch && syncMatch && directMatch && ioDepthMatch && testSizeMatch && durationMatch;
        };

        const blockSizes = new Map<string | number, number>();
        const patterns = new Map<string | number, number>();
        const queueDepths = new Map<string | number, number>();
        const numJobs = new Map<string | number, number>();
        const protocols = new Map<string | number, number>();
        const hosts = new Map<string | number, number>();
        const driveTypes = new Map<string | number, number>();
        const driveModels = new Map<string | number, number>();
        const syncs = new Map<string | number, number>();
        const directs = new Map<string | number, number>();
        const ioDepths = new Map<string | number, number>();
        const testSizes = new Map<string | number, number>();
        const durations = new Map<string | number, number>();

        // Count runs for each host option
        testCoverage.hosts.forEach(host => {
            let count = 0;
            combinedHostData.drives.forEach(drive => {
                if (driveMatches(drive, host)) {
                    count += drive.configurations.filter(config => configMatches(config)).length;
                }
            });
            hosts.set(host, count);
        });

        // Count runs for each protocol option
        testCoverage.protocols.forEach(protocol => {
            let count = 0;
            combinedHostData.drives.forEach(drive => {
                if (driveMatches(drive, undefined, protocol)) {
                    count += drive.configurations.filter(config => configMatches(config)).length;
                }
            });
            protocols.set(protocol, count);
        });

        // Count runs for each drive type option
        testCoverage.driveTypes.forEach(driveType => {
            let count = 0;
            combinedHostData.drives.forEach(drive => {
                if (driveMatches(drive, undefined, undefined, driveType)) {
                    count += drive.configurations.filter(config => configMatches(config)).length;
                }
            });
            driveTypes.set(driveType, count);
        });

        // Count runs for each drive model option
        testCoverage.driveModels.forEach(driveModel => {
            let count = 0;
            combinedHostData.drives.forEach(drive => {
                if (driveMatches(drive, undefined, undefined, undefined, driveModel)) {
                    count += drive.configurations.filter(config => configMatches(config)).length;
                }
            });
            driveModels.set(driveModel, count);
        });

        // Count runs for configuration-level options
        combinedHostData.drives.forEach(drive => {
            if (!driveMatches(drive)) {
                return;
            }

            // Count for each block size
            testCoverage.blockSizes.forEach(blockSize => {
                const count = drive.configurations.filter(config => 
                    config.block_size === blockSize && configMatches(config, blockSize)
                ).length;
                blockSizes.set(blockSize, (blockSizes.get(blockSize) || 0) + count);
            });

            // Count for each pattern
            testCoverage.patterns.forEach(pattern => {
                const count = drive.configurations.filter(config => 
                    config.read_write_pattern === pattern && configMatches(config, undefined, pattern)
                ).length;
                patterns.set(pattern, (patterns.get(pattern) || 0) + count);
            });

            // Count for each queue depth
            testCoverage.queueDepths.forEach(queueDepth => {
                const count = drive.configurations.filter(config => 
                    config.queue_depth === queueDepth && configMatches(config, undefined, undefined, queueDepth)
                ).length;
                queueDepths.set(queueDepth, (queueDepths.get(queueDepth) || 0) + count);
            });

            // Count for each num jobs
            testCoverage.numJobs.forEach(numJob => {
                const count = drive.configurations.filter(config => 
                    config.num_jobs !== null && config.num_jobs !== undefined && 
                    config.num_jobs === numJob && 
                    configMatches(config, undefined, undefined, undefined, numJob)
                ).length;
                numJobs.set(numJob, (numJobs.get(numJob) || 0) + count);
            });

            // Count for each sync
            testCoverage.syncs.forEach(sync => {
                const count = drive.configurations.filter(config => 
                    config.sync !== null && config.sync !== undefined && 
                    config.sync === sync && 
                    configMatches(config, undefined, undefined, undefined, undefined, sync)
                ).length;
                syncs.set(sync, (syncs.get(sync) || 0) + count);
            });

            // Count for each direct
            testCoverage.directs.forEach(direct => {
                const count = drive.configurations.filter(config => 
                    config.direct !== null && config.direct !== undefined && 
                    config.direct === direct && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, direct)
                ).length;
                directs.set(direct, (directs.get(direct) || 0) + count);
            });

            // Count for each iodepth
            testCoverage.ioDepths.forEach(ioDepth => {
                const count = drive.configurations.filter(config => 
                    config.iodepth !== null && config.iodepth !== undefined && 
                    config.iodepth === ioDepth && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, undefined, ioDepth)
                ).length;
                ioDepths.set(ioDepth, (ioDepths.get(ioDepth) || 0) + count);
            });

            // Count for each test size
            testCoverage.testSizes.forEach(testSize => {
                const count = drive.configurations.filter(config => 
                    config.test_size !== null && config.test_size !== undefined && 
                    config.test_size === testSize && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, undefined, undefined, testSize)
                ).length;
                testSizes.set(testSize, (testSizes.get(testSize) || 0) + count);
            });

            // Count for each duration
            testCoverage.durations.forEach(duration => {
                const count = drive.configurations.filter(config => 
                    config.duration !== null && config.duration !== undefined && 
                    config.duration === duration && 
                    configMatches(config, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, duration)
                ).length;
                durations.set(duration, (durations.get(duration) || 0) + count);
            });
        });

        return {
            blockSizes,
            patterns,
            queueDepths,
            numJobs,
            protocols,
            hosts,
            driveTypes,
            driveModels,
            syncs,
            directs,
            ioDepths,
            testSizes,
            durations
        };
    }, [
        combinedHostData,
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
        selectedDurations
    ]);

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
                    availableOptions={availableOptions.blockSizes}
                    optionCounts={optionCounts.blockSizes}
                />
                
                <FilterSection
                    title="Read/Write Patterns"
                    options={testCoverage.patterns}
                    selectedValues={selectedPatterns}
                    onChange={onPatternChange}
                    colorClass="bg-green-500"
                    availableOptions={availableOptions.patterns}
                    optionCounts={optionCounts.patterns}
                />
                
                <FilterSection
                    title="Queue Depths"
                    options={testCoverage.queueDepths}
                    selectedValues={selectedQueueDepths}
                    onChange={onQueueDepthChange}
                    colorClass="bg-purple-500"
                    prefix="QD"
                    availableOptions={availableOptions.queueDepths}
                    optionCounts={optionCounts.queueDepths}
                />
                
                <FilterSection
                    title="Number of Jobs"
                    options={testCoverage.numJobs}
                    selectedValues={selectedNumJobs}
                    onChange={onNumJobsChange}
                    colorClass="bg-cyan-500"
                    prefix="Jobs:"
                    availableOptions={availableOptions.numJobs}
                    optionCounts={optionCounts.numJobs}
                />
                
                <FilterSection
                    title="Protocols"
                    options={testCoverage.protocols}
                    selectedValues={selectedProtocols}
                    onChange={onProtocolChange}
                    colorClass="bg-orange-500"
                    availableOptions={availableOptions.protocols}
                    optionCounts={optionCounts.protocols}
                />
                
                <FilterSection
                    title="Hosts"
                    options={testCoverage.hosts}
                    selectedValues={selectedFilterHosts}
                    onChange={onFilterHostChange}
                    colorClass="bg-indigo-500"
                    availableOptions={availableOptions.hosts}
                    optionCounts={optionCounts.hosts}
                />
                
                <FilterSection
                    title="Drive Type"
                    options={testCoverage.driveTypes}
                    selectedValues={selectedDriveTypes}
                    onChange={onDriveTypeChange}
                    colorClass="bg-rose-500"
                    availableOptions={availableOptions.driveTypes}
                    optionCounts={optionCounts.driveTypes}
                />
                
                <FilterSection
                    title="Drive Model"
                    options={testCoverage.driveModels}
                    selectedValues={selectedDriveModels}
                    onChange={onDriveModelChange}
                    colorClass="bg-fuchsia-500"
                    availableOptions={availableOptions.driveModels}
                    optionCounts={optionCounts.driveModels}
                />
                
                <FilterSection
                    title="Sync Mode"
                    options={testCoverage.syncs}
                    selectedValues={selectedSyncs}
                    onChange={onSyncChange}
                    colorClass="bg-pink-500"
                    labelMap={{ 0: 'Off', 1: 'On' }}
                    availableOptions={availableOptions.syncs}
                    optionCounts={optionCounts.syncs}
                />
                
                <FilterSection
                    title="Direct I/O"
                    options={testCoverage.directs}
                    selectedValues={selectedDirects}
                    onChange={onDirectChange}
                    colorClass="bg-amber-500"
                    labelMap={{ 0: 'Off', 1: 'On' }}
                    availableOptions={availableOptions.directs}
                    optionCounts={optionCounts.directs}
                />
                
                <FilterSection
                    title="I/O Depth"
                    options={testCoverage.ioDepths}
                    selectedValues={selectedIoDepths}
                    onChange={onIoDepthChange}
                    colorClass="bg-teal-500"
                    prefix="IOD"
                    availableOptions={availableOptions.ioDepths}
                    optionCounts={optionCounts.ioDepths}
                />
                
                <FilterSection
                    title="Test Size"
                    options={testCoverage.testSizes}
                    selectedValues={selectedTestSizes}
                    onChange={onTestSizeChange}
                    colorClass="bg-violet-500"
                    availableOptions={availableOptions.testSizes}
                    optionCounts={optionCounts.testSizes}
                />
                
                <FilterSection
                    title="Duration"
                    options={testCoverage.durations}
                    selectedValues={selectedDurations}
                    onChange={onDurationChange}
                    colorClass="bg-emerald-500"
                    prefix=""
                    labelMap={Object.fromEntries(testCoverage.durations.map(d => [d, `${d}s`]))}
                    availableOptions={availableOptions.durations}
                    optionCounts={optionCounts.durations}
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

    // Check if combinedHostData changed
    if (prevProps.combinedHostData !== nextProps.combinedHostData) {
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
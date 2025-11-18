import { useState, useMemo, useCallback } from 'react';
import type { HostAnalysisData } from '../services/api/hostAnalysis';

export interface UseHostFiltersReturn {
    // Filter states
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
    
    // Filter setters
    setSelectedBlockSizes: (sizes: string[]) => void;
    setSelectedPatterns: (patterns: string[]) => void;
    setSelectedQueueDepths: (depths: number[]) => void;
    setSelectedNumJobs: (numJobs: number[]) => void;
    setSelectedProtocols: (protocols: string[]) => void;
    setSelectedFilterHosts: (hosts: string[]) => void;
    setSelectedDriveTypes: (types: string[]) => void;
    setSelectedDriveModels: (models: string[]) => void;
    setSelectedSyncs: (syncs: number[]) => void;
    setSelectedDirects: (directs: number[]) => void;
    setSelectedIoDepths: (ioDepths: number[]) => void;
    setSelectedTestSizes: (testSizes: string[]) => void;
    setSelectedDurations: (durations: number[]) => void;
    
    // Filtered data
    filteredDrives: any[];
    
    // Actions
    resetFilters: () => void;
}

export interface UseHostFiltersProps {
    combinedHostData: HostAnalysisData | null;
}

export const useHostFilters = ({ combinedHostData }: UseHostFiltersProps): UseHostFiltersReturn => {
    // Filter states
    const [selectedBlockSizes, setSelectedBlockSizes] = useState<string[]>([]);
    const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
    const [selectedQueueDepths, setSelectedQueueDepths] = useState<number[]>([]);
    const [selectedNumJobs, setSelectedNumJobs] = useState<number[]>([]);
    const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
    const [selectedFilterHosts, setSelectedFilterHosts] = useState<string[]>([]);
    const [selectedDriveTypes, setSelectedDriveTypes] = useState<string[]>([]);
    const [selectedDriveModels, setSelectedDriveModels] = useState<string[]>([]);
    const [selectedSyncs, setSelectedSyncs] = useState<number[]>([]);
    const [selectedDirects, setSelectedDirects] = useState<number[]>([]);
    const [selectedIoDepths, setSelectedIoDepths] = useState<number[]>([]);
    const [selectedTestSizes, setSelectedTestSizes] = useState<string[]>([]);
    const [selectedDurations, setSelectedDurations] = useState<number[]>([]);

    // Reset filters function
    const resetFilters = useCallback(() => {
        setSelectedBlockSizes([]);
        setSelectedPatterns([]);
        setSelectedQueueDepths([]);
        setSelectedNumJobs([]);
        setSelectedProtocols([]);
        setSelectedFilterHosts([]);
        setSelectedDriveTypes([]);
        setSelectedDriveModels([]);
        setSelectedSyncs([]);
        setSelectedDirects([]);
        setSelectedIoDepths([]);
        setSelectedTestSizes([]);
        setSelectedDurations([]);
    }, []);

    // Filter drives based on selected criteria
    const filteredDrives = useMemo((): any[] => {
        if (!combinedHostData) {
            return [];
        }

        const result = combinedHostData.drives.filter(drive => {
            // Filter drives by selected hosts, protocols, drive types, and drive models separately
            const hostMatch = selectedFilterHosts.length === 0 || selectedFilterHosts.includes(drive.hostname);
            const protocolMatch = selectedProtocols.length === 0 || selectedProtocols.includes(drive.protocol);
            const driveTypeMatch = selectedDriveTypes.length === 0 || selectedDriveTypes.includes(drive.drive_type);
            const driveModelMatch = selectedDriveModels.length === 0 || selectedDriveModels.includes(drive.drive_model);
            return hostMatch && protocolMatch && driveTypeMatch && driveModelMatch;
        }).map(drive => ({
            ...drive,
            configurations: drive.configurations.filter(config => {
                const blockSizeMatch = selectedBlockSizes.length === 0 || selectedBlockSizes.includes(config.block_size);
                const patternMatch = selectedPatterns.length === 0 || selectedPatterns.includes(config.read_write_pattern);
                const queueDepthMatch = selectedQueueDepths.length === 0 || selectedQueueDepths.includes(config.queue_depth);
                const numJobsMatch = selectedNumJobs.length === 0 || (config.num_jobs !== null && config.num_jobs !== undefined && selectedNumJobs.includes(config.num_jobs));
                const syncMatch = selectedSyncs.length === 0 || (config.sync !== null && config.sync !== undefined && selectedSyncs.includes(config.sync));
                const directMatch = selectedDirects.length === 0 || (config.direct !== null && config.direct !== undefined && selectedDirects.includes(config.direct));
                const ioDepthMatch = selectedIoDepths.length === 0 || (config.iodepth !== null && config.iodepth !== undefined && selectedIoDepths.includes(config.iodepth));
                const testSizeMatch = selectedTestSizes.length === 0 || (config.test_size !== null && config.test_size !== undefined && selectedTestSizes.includes(config.test_size));
                const durationMatch = selectedDurations.length === 0 || (config.duration !== null && config.duration !== undefined && selectedDurations.includes(config.duration));

                return blockSizeMatch && patternMatch && queueDepthMatch && numJobsMatch && syncMatch && directMatch && ioDepthMatch && testSizeMatch && durationMatch;
            })
        })).filter(drive => drive.configurations.length > 0);


        return result;
    }, [
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
        selectedDurations
    ]);

    return {
        // Filter states
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
        
        // Filter setters
        setSelectedBlockSizes,
        setSelectedPatterns,
        setSelectedQueueDepths,
        setSelectedNumJobs,
        setSelectedProtocols,
        setSelectedFilterHosts,
        setSelectedDriveTypes,
        setSelectedDriveModels,
        setSelectedSyncs,
        setSelectedDirects,
        setSelectedIoDepths,
        setSelectedTestSizes,
        setSelectedDurations,
        
        // Filtered data
        filteredDrives,
        
        // Actions
        resetFilters
    };
};
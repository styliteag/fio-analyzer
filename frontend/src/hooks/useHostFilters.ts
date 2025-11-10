import { useState, useMemo, useCallback } from 'react';
import type { HostAnalysisData } from '../services/api/hostAnalysis';

export interface UseHostFiltersReturn {
    // Filter states
    selectedBlockSizes: string[];
    selectedPatterns: string[];
    selectedQueueDepths: number[];
    selectedNumJobs: number[];
    selectedProtocols: string[];
    selectedHostDiskCombinations: string[];
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
    setSelectedHostDiskCombinations: (combinations: string[]) => void;
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
    const [selectedHostDiskCombinations, setSelectedHostDiskCombinations] = useState<string[]>([]);
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
        setSelectedHostDiskCombinations([]);
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
            // Filter drives by selected host-disk combinations
            if (selectedHostDiskCombinations.length === 0) {
                return true;
            }
            // Use the same key format as the heatmap component: hostname-protocol-driveModel-driveType-driveIndex
            // Since we don't have driveIndex here, we'll match by hostname-protocol-driveModel-driveType pattern
            const included = selectedHostDiskCombinations.some(combo => {
                const [comboHostname, comboProtocol, comboDriveModel] = combo.split(' - ');
                return drive.hostname === comboHostname &&
                       drive.protocol === comboProtocol &&
                       drive.drive_model === comboDriveModel;
            });
            return included;
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
        selectedHostDiskCombinations,
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
        selectedHostDiskCombinations,
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
        setSelectedHostDiskCombinations,
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
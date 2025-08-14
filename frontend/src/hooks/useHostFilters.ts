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
    
    // Filter setters
    setSelectedBlockSizes: (sizes: string[]) => void;
    setSelectedPatterns: (patterns: string[]) => void;
    setSelectedQueueDepths: (depths: number[]) => void;
    setSelectedNumJobs: (numJobs: number[]) => void;
    setSelectedProtocols: (protocols: string[]) => void;
    setSelectedHostDiskCombinations: (combinations: string[]) => void;
    
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

    // Reset filters function
    const resetFilters = useCallback(() => {
        setSelectedBlockSizes([]);
        setSelectedPatterns([]);
        setSelectedQueueDepths([]);
        setSelectedNumJobs([]);
        setSelectedProtocols([]);
        setSelectedHostDiskCombinations([]);
    }, []);

    // Filter drives based on selected criteria
    const filteredDrives = useMemo(() => {
        if (!combinedHostData) return [];

        return combinedHostData.drives.filter(drive => {
            // Filter drives by selected host-disk combinations
            if (selectedHostDiskCombinations.length === 0) return true;
            const driveCombo = `${drive.hostname} - ${drive.protocol} - ${drive.drive_model}`;
            return selectedHostDiskCombinations.includes(driveCombo);
        }).map(drive => ({
            ...drive,
            configurations: drive.configurations.filter(config => {
                const blockSizeMatch = selectedBlockSizes.length === 0 || selectedBlockSizes.includes(config.block_size);
                const patternMatch = selectedPatterns.length === 0 || selectedPatterns.includes(config.read_write_pattern);
                const queueDepthMatch = selectedQueueDepths.length === 0 || selectedQueueDepths.includes(config.queue_depth);
                const numJobsMatch = selectedNumJobs.length === 0 || (config.num_jobs !== null && config.num_jobs !== undefined && selectedNumJobs.includes(config.num_jobs));
                
                return blockSizeMatch && patternMatch && queueDepthMatch && numJobsMatch;
            })
        })).filter(drive => drive.configurations.length > 0);
    }, [
        combinedHostData,
        selectedBlockSizes,
        selectedPatterns,
        selectedQueueDepths,
        selectedNumJobs,
        selectedHostDiskCombinations
    ]);

    return {
        // Filter states
        selectedBlockSizes,
        selectedPatterns,
        selectedQueueDepths,
        selectedNumJobs,
        selectedProtocols,
        selectedHostDiskCombinations,
        
        // Filter setters
        setSelectedBlockSizes,
        setSelectedPatterns,
        setSelectedQueueDepths,
        setSelectedNumJobs,
        setSelectedProtocols,
        setSelectedHostDiskCombinations,
        
        // Filtered data
        filteredDrives,
        
        // Actions
        resetFilters
    };
};
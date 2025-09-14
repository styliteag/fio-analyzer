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
    const filteredDrives = useMemo((): any[] => {
        console.log('=== FILTER DEBUG ===');
        console.log('selectedHostDiskCombinations:', selectedHostDiskCombinations);
        console.log('selectedBlockSizes:', selectedBlockSizes);
        console.log('selectedPatterns:', selectedPatterns);
        console.log('selectedQueueDepths:', selectedQueueDepths);
        console.log('selectedNumJobs:', selectedNumJobs);

        if (!combinedHostData) {
            console.log('No combinedHostData available');
            return [];
        }

        console.log('Total drives before filtering:', combinedHostData.drives.length);

        // Debug: show all drives before filtering
        combinedHostData.drives.forEach((drive, index) => {
            console.log(`Pre-filter drive ${index}: hostname=${drive.hostname}, protocol=${drive.protocol}, drive_model=${drive.drive_model}, drive_type=${drive.drive_type}, configs=${drive.configurations?.length || 0}`);
        });

        const result = combinedHostData.drives.filter(drive => {
            // Filter drives by selected host-disk combinations
            if (selectedHostDiskCombinations.length === 0) {
                console.log(`Including drive (no filters): hostname=${drive.hostname}, protocol=${drive.protocol}, drive_model=${drive.drive_model}`);
                return true;
            }
            const driveCombo = `${drive.hostname} - ${drive.protocol} - ${drive.drive_model}`;
            const included = selectedHostDiskCombinations.includes(driveCombo);
            console.log(`Drive ${drive.hostname}-${drive.protocol}-${drive.drive_model}: ${included ? 'INCLUDED' : 'FILTERED OUT'}`);
            return included;
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

        // Debug: show final filtered drives
        result.forEach((drive, index) => {
            console.log(`Post-filter drive ${index}: hostname=${drive.hostname}, protocol=${drive.protocol}, drive_model=${drive.drive_model}, configs=${drive.configurations?.length || 0}`);
        });

        console.log('Filtered drives result:', result.length);
        console.log('Hostnames in filtered drives:', [...new Set(result.map((d: any) => d.hostname))]);
        console.log('=== END FILTER DEBUG ===');

        return result;
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
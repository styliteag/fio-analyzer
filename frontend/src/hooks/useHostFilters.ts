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

        // Show what filters are actually active
        console.log('=== ACTIVE FILTERS SUMMARY ===');
        console.log(`Host-Disk filters active: ${selectedHostDiskCombinations.length > 0}`);
        console.log(`Block size filters active: ${selectedBlockSizes.length > 0}`);
        console.log(`Pattern filters active: ${selectedPatterns.length > 0}`);
        console.log(`Queue depth filters active: ${selectedQueueDepths.length > 0}`);
        console.log(`Num jobs filters active: ${selectedNumJobs.length > 0}`);
        console.log('=== END ACTIVE FILTERS SUMMARY ===');

        if (!combinedHostData) {
            console.log('No combinedHostData available');
            return [];
        }

        console.log('Total drives before filtering:', combinedHostData.drives.length);

        // Debug: show all drives before filtering
        console.log('=== ALL DRIVES BEFORE FILTERING ===');
        combinedHostData.drives.forEach((drive, index) => {
            console.log(`Pre-filter drive ${index}: hostname=${drive.hostname}, protocol=${drive.protocol}, drive_model=${drive.drive_model}, drive_type=${drive.drive_type}, configs=${drive.configurations?.length || 0}`);
        });
        console.log('=== END ALL DRIVES BEFORE FILTERING ===');

        // Show available host-disk combinations for debugging
        const availableCombinations = [...new Set(combinedHostData.drives.map(drive =>
            `${drive.hostname} - ${drive.protocol} - ${drive.drive_model}`
        ))];
        console.log('Available host-disk combinations:', availableCombinations);

        const result = combinedHostData.drives.filter(drive => {
            // Filter drives by selected host-disk combinations
            if (selectedHostDiskCombinations.length === 0) {
                console.log(`Including drive (no filters): hostname=${drive.hostname}, protocol=${drive.protocol}, drive_model=${drive.drive_model}`);
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

        console.log('=== FINAL FILTERED RESULT ===');
        console.log('Filtered drives result:', result.length);
        console.log('Hostnames in filtered drives:', [...new Set(result.map((d: any) => d.hostname))]);
        console.log('Drive models in filtered drives:', [...new Set(result.map((d: any) => d.drive_model))]);
        console.log('Protocols in filtered drives:', [...new Set(result.map((d: any) => d.protocol))]);

        // Show sample configurations from filtered data
        if (result.length > 0) {
            console.log('Sample filtered configurations:');
            result.slice(0, 2).forEach((drive, driveIndex) => {
                drive.configurations.slice(0, 2).forEach((config, configIndex) => {
                    console.log(`  Drive ${driveIndex} Config ${configIndex}: IOPS=${config.iops}, BW=${config.bandwidth}, Pattern=${config.read_write_pattern}`);
                });
            });
        }
        console.log('=== END FINAL FILTERED RESULT ===');
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
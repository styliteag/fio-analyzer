import { useState, useMemo, useCallback } from 'react';
import type { HostAnalysisData } from '../services/api/hostAnalysis';

export interface UseHostFiltersReturn {
    // Filter states
    selectedBlockSizes: string[];
    selectedPatterns: string[];
    selectedQueueDepths: number[];
    selectedNumJobs: number[];
    selectedSyncs: number[];
    selectedDirects: number[];
    selectedIoDepths: number[];
    selectedTestSizes: string[];
    selectedDurations: number[];
    
    // Hierarchical filter states
    selectedHosts: string[];
    selectedHostProtocols: string[]; // Format: "host-protocol"
    selectedHostProtocolTypes: string[]; // Format: "host-protocol-type"
    selectedHostProtocolTypeModels: string[]; // Format: "host-protocol-type-model"
    
    // Filter setters
    setSelectedBlockSizes: (sizes: string[]) => void;
    setSelectedPatterns: (patterns: string[]) => void;
    setSelectedQueueDepths: (depths: number[]) => void;
    setSelectedNumJobs: (numJobs: number[]) => void;
    setSelectedSyncs: (syncs: number[]) => void;
    setSelectedDirects: (directs: number[]) => void;
    setSelectedIoDepths: (ioDepths: number[]) => void;
    setSelectedTestSizes: (testSizes: string[]) => void;
    setSelectedDurations: (durations: number[]) => void;
    
    // Hierarchical filter setters
    setSelectedHosts: (hosts: string[]) => void;
    setSelectedHostProtocols: (combos: string[]) => void;
    setSelectedHostProtocolTypes: (combos: string[]) => void;
    setSelectedHostProtocolTypeModels: (combos: string[]) => void;
    
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
    const [selectedSyncs, setSelectedSyncs] = useState<number[]>([]);
    const [selectedDirects, setSelectedDirects] = useState<number[]>([]);
    const [selectedIoDepths, setSelectedIoDepths] = useState<number[]>([]);
    const [selectedTestSizes, setSelectedTestSizes] = useState<string[]>([]);
    const [selectedDurations, setSelectedDurations] = useState<number[]>([]);

    // Hierarchical filter states
    const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
    const [selectedHostProtocols, setSelectedHostProtocols] = useState<string[]>([]);
    const [selectedHostProtocolTypes, setSelectedHostProtocolTypes] = useState<string[]>([]);
    const [selectedHostProtocolTypeModels, setSelectedHostProtocolTypeModels] = useState<string[]>([]);

    // Reset filters function
    const resetFilters = useCallback(() => {
        setSelectedBlockSizes([]);
        setSelectedPatterns([]);
        setSelectedQueueDepths([]);
        setSelectedNumJobs([]);
        setSelectedSyncs([]);
        setSelectedDirects([]);
        setSelectedIoDepths([]);
        setSelectedTestSizes([]);
        setSelectedDurations([]);
        setSelectedHosts([]);
        setSelectedHostProtocols([]);
        setSelectedHostProtocolTypes([]);
        setSelectedHostProtocolTypeModels([]);
    }, []);

    // Filter drives based on selected criteria
    const filteredDrives = useMemo((): any[] => {
        if (!combinedHostData) {
            return [];
        }

        const result = combinedHostData.drives.filter(drive => {
            // Hierarchical filtering: check each level
            // Level 1: Host
            const hostMatch = selectedHosts.length === 0 || selectedHosts.includes(drive.hostname);
            if (!hostMatch) return false;

            // Level 2: Host-Protocol
            const hostProtocolKey = `${drive.hostname}-${drive.protocol}`;
            const hostProtocolMatch = selectedHostProtocols.length === 0 || selectedHostProtocols.includes(hostProtocolKey);
            if (!hostProtocolMatch) return false;

            // Level 3: Host-Protocol-Type
            const hostProtocolTypeKey = `${drive.hostname}-${drive.protocol}-${drive.drive_type}`;
            const hostProtocolTypeMatch = selectedHostProtocolTypes.length === 0 || selectedHostProtocolTypes.includes(hostProtocolTypeKey);
            if (!hostProtocolTypeMatch) return false;

            // Level 4: Host-Protocol-Type-Model
            const hostProtocolTypeModelKey = `${drive.hostname}-${drive.protocol}-${drive.drive_type}-${drive.drive_model}`;
            const hostProtocolTypeModelMatch = selectedHostProtocolTypeModels.length === 0 || selectedHostProtocolTypeModels.includes(hostProtocolTypeModelKey);
            if (!hostProtocolTypeModelMatch) return false;

            return true;
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
        selectedSyncs,
        selectedDirects,
        selectedIoDepths,
        selectedTestSizes,
        selectedDurations,
        selectedHosts,
        selectedHostProtocols,
        selectedHostProtocolTypes,
        selectedHostProtocolTypeModels
    ]);

    return {
        // Filter states
        selectedBlockSizes,
        selectedPatterns,
        selectedQueueDepths,
        selectedNumJobs,
        selectedSyncs,
        selectedDirects,
        selectedIoDepths,
        selectedTestSizes,
        selectedDurations,
        
        // Hierarchical filter states
        selectedHosts,
        selectedHostProtocols,
        selectedHostProtocolTypes,
        selectedHostProtocolTypeModels,
        
        // Filter setters
        setSelectedBlockSizes,
        setSelectedPatterns,
        setSelectedQueueDepths,
        setSelectedNumJobs,
        setSelectedSyncs,
        setSelectedDirects,
        setSelectedIoDepths,
        setSelectedTestSizes,
        setSelectedDurations,
        
        // Hierarchical filter setters
        setSelectedHosts,
        setSelectedHostProtocols,
        setSelectedHostProtocolTypes,
        setSelectedHostProtocolTypeModels,
        
        // Filtered data
        filteredDrives,
        
        // Actions
        resetFilters
    };
};
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchHostAnalysis, getHostList, type HostAnalysisData } from '../services/api/hostAnalysis';

export interface UseHostDataProps {
    // No longer using hostname from URL
}

export interface UseHostDataReturn {
    // Host list data
    availableHosts: string[];
    loadingHosts: boolean;
    selectedHosts: string[];
    
    // Host analysis data
    hostDataMap: Record<string, HostAnalysisData>;
    combinedHostData: HostAnalysisData | null;
    loading: boolean;
    error: string | null;
    
    // Actions
    handleHostsChange: (newHosts: string[]) => void;
    refreshData: () => void;
}

export const useHostData = (): UseHostDataReturn => {
    // Host list states
    const [availableHosts, setAvailableHosts] = useState<string[]>([]);
    const [loadingHosts, setLoadingHosts] = useState(true);
    const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
    
    // Host analysis data states
    const [hostDataMap, setHostDataMap] = useState<Record<string, HostAnalysisData>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load available hosts
    const loadHostList = useCallback(async () => {
        try {
            setLoadingHosts(true);
            const hosts = await getHostList();
            setAvailableHosts(hosts);
            
            // Don't auto-select any host - let user choose
        } catch (err) {
            console.error('Failed to load host list:', err);
            setError('Failed to load available hosts');
        } finally {
            setLoadingHosts(false);
        }
    }, []);

    // Load host analysis data for multiple hosts
    const loadHostsData = useCallback(async (hosts: string[] = selectedHosts) => {
        if (hosts.length === 0) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const dataMap: Record<string, HostAnalysisData> = {};
            
            // Load data for each host
            for (const host of hosts) {
                try {
                    const data = await fetchHostAnalysis(host);
                    dataMap[host] = data;
                } catch (err) {
                    console.error(`Failed to load data for host ${host}:`, err);
                    // Continue with other hosts even if one fails
                }
            }
            
            setHostDataMap(dataMap);
        } catch (err) {
            console.error('Failed to load host analysis:', err);
            setError(err instanceof Error ? err.message : 'Failed to load host analysis');
        } finally {
            setLoading(false);
        }
    }, [selectedHosts]);

    // Handle host selection change
    const handleHostsChange = useCallback((newHosts: string[]) => {
        setSelectedHosts(newHosts);
        loadHostsData(newHosts);
    }, [loadHostsData]);

    // Refresh data function
    const refreshData = useCallback(() => {
        if (selectedHosts.length > 0) {
            loadHostsData(selectedHosts);
        } else {
            loadHostList();
        }
    }, [selectedHosts, loadHostsData, loadHostList]);

    // Load host list on component mount
    useEffect(() => {
        loadHostList();
    }, [loadHostList]);


    // Load host data when selected hosts change (after host list is loaded)
    useEffect(() => {
        if (selectedHosts.length > 0 && !loadingHosts) {
            loadHostsData(selectedHosts);
        }
    }, [selectedHosts, loadingHosts, loadHostsData]);

    // Combine data from all selected hosts
    const combinedHostData = useMemo(() => {
        const allHosts = Object.values(hostDataMap);
        if (allHosts.length === 0) return null;
        
        // Combine all drives from all hosts
        const allDrives = allHosts.flatMap(hostData => hostData.drives);
        
        // Combine test coverage from all hosts
        const allBlockSizes = [...new Set(allHosts.flatMap(h => h.testCoverage.blockSizes))].sort();
        const allPatterns = [...new Set(allHosts.flatMap(h => h.testCoverage.patterns))].sort();
        const allQueueDepths = [...new Set(allHosts.flatMap(h => h.testCoverage.queueDepths))].sort((a, b) => a - b);
        const allNumJobs = [...new Set(allHosts.flatMap(h => h.testCoverage.numJobs))].sort((a, b) => a - b);
        const allProtocols = [...new Set(allHosts.flatMap(h => h.testCoverage.protocols))].sort();
        const allHosts_list = [...new Set(allHosts.flatMap(h => h.testCoverage.hosts))].sort();
        const allDriveTypes = [...new Set(allHosts.flatMap(h => h.testCoverage.driveTypes))].sort();
        const allDriveModels = [...new Set(allHosts.flatMap(h => h.testCoverage.driveModels))].sort();
        const allSyncs = [...new Set(allHosts.flatMap(h => h.testCoverage.syncs))].sort((a, b) => a - b);
        const allDirects = [...new Set(allHosts.flatMap(h => h.testCoverage.directs))].sort((a, b) => a - b);
        const allIoDepths = [...new Set(allHosts.flatMap(h => h.testCoverage.ioDepths))].sort((a, b) => a - b);
        const allTestSizes = [...new Set(allHosts.flatMap(h => h.testCoverage.testSizes))].sort();
        const allDurations = [...new Set(allHosts.flatMap(h => h.testCoverage.durations))].sort((a, b) => a - b);
        
        // Use first host as template and combine data
        const primaryHost = allHosts[0];
        return {
            ...primaryHost,
            drives: allDrives,
            testCoverage: {
                blockSizes: allBlockSizes,
                patterns: allPatterns,
                queueDepths: allQueueDepths,
                numJobs: allNumJobs,
                protocols: allProtocols,
                hosts: allHosts_list,
                driveTypes: allDriveTypes,
                driveModels: allDriveModels,
                syncs: allSyncs,
                directs: allDirects,
                ioDepths: allIoDepths,
                testSizes: allTestSizes,
                durations: allDurations
            },
            totalTests: allHosts.reduce((sum, h) => sum + h.totalTests, 0),
            hostname: selectedHosts.length === 1 ? selectedHosts[0] : `${selectedHosts.length} hosts`
        };
    }, [hostDataMap, selectedHosts]);

    return {
        // Host list data
        availableHosts,
        loadingHosts,
        selectedHosts,
        
        // Host analysis data
        hostDataMap,
        combinedHostData,
        loading,
        error,
        
        // Actions
        handleHostsChange,
        refreshData
    };
};
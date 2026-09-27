import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { clearHostFilters } from './useHostFilters';
import { compareSyncModes } from '../utils/syncMode';
import { useUpdateUrlParams, useUrlList, writeList } from './useUrlState';
import { fetchHostAnalysis, getHostList, type HostAnalysisData } from '../services/api/hostAnalysis';

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
    failedHosts: string[];

    // Actions
    handleHostsChange: (newHosts: string[]) => void;
    refreshData: () => void;
}

export const HOSTS_PARAM = 'hosts';

export const useHostData = (): UseHostDataReturn => {
    // Selected hosts live in the URL (?hosts=a&hosts=b)
    const [selectedHosts] = useUrlList(HOSTS_PARAM);
    const updateParams = useUpdateUrlParams();

    // Host list states
    const [availableHosts, setAvailableHosts] = useState<string[]>([]);
    const [loadingHosts, setLoadingHosts] = useState(true);

    // Host analysis data states
    const [hostDataMap, setHostDataMap] = useState<Record<string, HostAnalysisData>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failedHosts, setFailedHosts] = useState<string[]>([]);
    const requestId = useRef(0);
    const abortRef = useRef<AbortController | null>(null);

    const loadHostList = useCallback(async () => {
        try {
            setLoadingHosts(true);
            setError(null);
            setAvailableHosts(await getHostList());
        } catch {
            setError('Failed to load available hosts');
        } finally {
            setLoadingHosts(false);
        }
    }, []);

    // Load analysis data for all hosts in parallel; keep partial results
    const loadHostsData = useCallback(async (hosts: string[]) => {
        if (hosts.length === 0) {
            abortRef.current?.abort();
            requestId.current += 1;
            setLoading(false);
            setHostDataMap({});
            setFailedHosts([]);
            return;
        }
        requestId.current += 1;
        const currentRequest = requestId.current;
        abortRef.current?.abort(); // stop multi-page downloads for a previous selection
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        const results = await Promise.allSettled(hosts.map((host) => fetchHostAnalysis(host, controller.signal)));
        if (currentRequest !== requestId.current) return; // a newer selection superseded this one
        const loaded = hosts.flatMap((host, index) => {
            const result = results[index];
            return result.status === 'fulfilled' ? [[host, result.value] as const] : [];
        });
        const failed = hosts.filter((_, index) => results[index].status === 'rejected');
        setHostDataMap(Object.fromEntries(loaded));
        setFailedHosts(failed);
        if (loaded.length === 0) {
            setError(`Failed to load data for ${failed.join(', ')}`);
        }
        setLoading(false);
    }, []);

    // Changing hosts clears drill-down filters in the same URL update
    const handleHostsChange = useCallback((newHosts: string[]) => {
        updateParams((params) => {
            writeList(params, HOSTS_PARAM, newHosts);
            clearHostFilters(params);
        });
    }, [updateParams]);

    const refreshData = useCallback(() => {
        loadHostList();
        loadHostsData(selectedHosts);
    }, [selectedHosts, loadHostsData, loadHostList]);

    useEffect(() => {
        loadHostList();
    }, [loadHostList]);

    useEffect(() => {
        loadHostsData(selectedHosts);
    }, [selectedHosts, loadHostsData]);

    // Cancel in-flight downloads when leaving the page
    useEffect(() => () => abortRef.current?.abort(), []);

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
        const allSyncs = [...new Set(allHosts.flatMap(h => h.testCoverage.syncs))].sort(compareSyncModes);
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
        failedHosts,

        // Actions
        handleHostsChange,
        refreshData
    };
};
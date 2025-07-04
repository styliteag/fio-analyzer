import { useState, useEffect, useCallback } from "react";
import { fetchTimeSeriesServers, fetchTimeSeriesHistory } from "../services/api/timeSeries";
import { 
    groupServers, 
    getTimeRangeParams, 
    validateServerSelection,
    type ServerGroup,
    type TimeRange,
} from "../utils/timeSeriesHelpers";

interface UseTimeSeriesDataResult {
    // Server data
    serverGroups: ServerGroup[];
    
    // Chart data
    chartData: { [serverId: string]: any[] };
    
    // Loading states
    loading: boolean;
    serversLoading: boolean;
    
    // Error states
    error: string | null;
    
    // Actions
    loadTimeSeriesData: (serverIds: string[], timeRange: TimeRange) => Promise<void>;
    refreshServers: () => Promise<void>;
    clearError: () => void;
}

export const useTimeSeriesData = (): UseTimeSeriesDataResult => {
    const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
    const [chartData, setChartData] = useState<{ [serverId: string]: any[] }>({});
    const [loading, setLoading] = useState(false);
    const [serversLoading, setServersLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Loads and groups servers from the API
     */
    const loadServers = useCallback(async () => {
        setServersLoading(true);
        setError(null);
        
        try {
            const response = await fetchTimeSeriesServers();
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const serversData = response.data || [];
            const groupedServers = groupServers(serversData);
            setServerGroups(groupedServers);
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to fetch servers";
            setError(errorMessage);
            console.error("Failed to fetch servers:", err);
        } finally {
            setServersLoading(false);
        }
    }, []);

    /**
     * Loads time series data for selected servers and time range
     */
    const loadTimeSeriesData = useCallback(async (selectedServerIds: string[], timeRange: TimeRange) => {
        if (!validateServerSelection(selectedServerIds)) {
            setChartData({});
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { days, hours } = getTimeRangeParams(timeRange);
            const newChartData: { [serverId: string]: any[] } = {};

            // Fetch data for each selected server
            const dataPromises = selectedServerIds.map(async (serverId) => {
                const group = serverGroups.find(g => g.id === serverId);
                if (!group) return;

                const response = await fetchTimeSeriesHistory({
                    hostname: group.hostname,
                    protocol: group.protocol,
                    days,
                    hours,
                });

                if (response.error) {
                    throw new Error(`Failed to fetch data for ${group.hostname}: ${response.error}`);
                }

                // The API response should already be in the correct format with metric_type
                // If not, we need to derive it from the unit field or another field
                newChartData[serverId] = response.data || [];
            });

            await Promise.all(dataPromises);
            setChartData(newChartData);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to fetch time-series data";
            setError(errorMessage);
            console.error("Failed to fetch time-series data:", err);
        } finally {
            setLoading(false);
        }
    }, [serverGroups]);

    /**
     * Refreshes server data
     */
    const refreshServers = useCallback(async () => {
        await loadServers();
    }, [loadServers]);

    /**
     * Clears error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Load servers on component mount
    useEffect(() => {
        loadServers();
    }, [loadServers]);

    return {
        serverGroups,
        chartData,
        loading,
        serversLoading,
        error,
        loadTimeSeriesData,
        refreshServers,
        clearError,
    };
};
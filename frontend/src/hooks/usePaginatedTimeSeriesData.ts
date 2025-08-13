import { useState, useCallback, useRef } from "react";
import { fetchTimeSeriesHistory, type TimeSeriesHistoryOptions } from "../services/api/timeSeries";
import { isAbortError, isCancelledError } from '../types/api';

interface PaginatedResponse {
    data: any[];
    pagination: {
        total_count: number;
        limit: number;
        offset: number;
        returned_count: number;
        has_more: boolean;
    };
}

interface PaginationProgress {
    currentBatch: number;
    totalBatches: number;
    loadedRecords: number;
    totalRecords: number;
}

interface UsePaginatedTimeSeriesDataResult {
    data: any[];
    loading: boolean;
    error: string | null;
    progress: PaginationProgress | null;
    fetchAllData: (options: TimeSeriesHistoryOptions) => Promise<void>;
    cancel: () => void;
    isCancelled: boolean;
}

export const usePaginatedTimeSeriesData = (): UsePaginatedTimeSeriesDataResult => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<PaginationProgress | null>(null);
    const [isCancelled, setIsCancelled] = useState(false);

    // AbortController management
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Fetches all available data using automatic pagination
     */
    const fetchAllData = useCallback(async (options: TimeSeriesHistoryOptions) => {
        try {
            // Cancel any existing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new AbortController
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setLoading(true);
            setError(null);
            setIsCancelled(false);
            setData([]);
            setProgress(null);

            const batchSize = 5000; // Use smaller batches for better UX
            let offset = 0;
            let allData: any[] = [];
            let totalRecords = 0;
            let currentBatch = 1;

            while (true) {
                // Check if cancelled
                if (abortController.signal.aborted) {
                    return;
                }

                // Make API call with current offset
                const response = await fetchTimeSeriesHistory({
                    ...options,
                    limit: batchSize,
                    offset: offset
                }, abortController.signal);

                // Check if request was cancelled
                if (abortController.signal.aborted) {
                    return;
                }

                if (response.data) {
                    // Handle new response format from backend
                    let batchData: any[];
                    let pagination: PaginatedResponse['pagination'];
                    
                    if (response.data.data && response.data.pagination) {
                        // New paginated format
                        batchData = response.data.data;
                        pagination = response.data.pagination;
                    } else {
                        // Fallback for old format (array response)
                        batchData = Array.isArray(response.data) ? response.data : [];
                        pagination = {
                            total_count: batchData.length,
                            limit: batchSize,
                            offset: offset,
                            returned_count: batchData.length,
                            has_more: batchData.length === batchSize
                        };
                    }

                    // Add batch data to accumulated results
                    allData = [...allData, ...batchData];

                    // Update progress on first batch when we know total
                    if (currentBatch === 1) {
                        totalRecords = pagination.total_count;
                    }

                    const totalBatches = Math.ceil(totalRecords / batchSize);
                    
                    setProgress({
                        currentBatch,
                        totalBatches,
                        loadedRecords: allData.length,
                        totalRecords
                    });

                    // Update data state with accumulated results
                    setData([...allData]);

                    console.log(`🔄 [usePaginatedTimeSeriesData] Batch ${currentBatch}/${totalBatches} loaded: ${batchData.length} records (total: ${allData.length}/${totalRecords})`);

                    // Check if we have more data
                    if (!pagination.has_more || batchData.length === 0) {
                        console.log(`✅ [usePaginatedTimeSeriesData] All data loaded: ${allData.length} total records`);
                        break;
                    }

                    // Prepare for next batch
                    offset += batchSize;
                    currentBatch++;
                } else {
                    // Handle API error
                    throw new Error("Invalid response format from API");
                }
            }

        } catch (err) {
            // Handle AbortError specifically
            if (isAbortError(err) || isCancelledError(err)) {
                setIsCancelled(true);
                console.log('🚫 [usePaginatedTimeSeriesData] Fetch cancelled by user');
                return;
            }

            const errorMessage = err instanceof Error ? err.message : "Failed to fetch paginated time-series data";
            setError(errorMessage);
            console.error("Failed to fetch paginated time-series data:", err);
        } finally {
            setLoading(false);
            setProgress(null);
            abortControllerRef.current = null;
        }
    }, []);

    /**
     * Cancels the current fetch operation
     */
    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        
        setIsCancelled(true);
        setLoading(false);
        setProgress(null);
        
        console.log('🚫 [usePaginatedTimeSeriesData] Fetch cancelled by user');
    }, []);

    return {
        data,
        loading,
        error,
        progress,
        fetchAllData,
        cancel,
        isCancelled,
    };
};
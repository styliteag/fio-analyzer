import { useState, useCallback } from 'react';
import type { ApiResponse } from '../services/api/base';

export interface UseApiCallOptions<T> {
    onSuccess?: (data: T) => void | Promise<void>;
    onError?: (error: string) => void;
    onFinally?: () => void;
    resetDataOnError?: boolean;
    initialData?: T | null;
    showProgress?: boolean;
    enableLogging?: boolean;
}

export interface UseApiCallResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    progress: { current: number; total: number } | null;
    execute: (apiCall: () => Promise<ApiResponse<T>>) => Promise<boolean>;
    executeBatch: (
        apiCalls: (() => Promise<ApiResponse<any>>)[],
        options?: { stopOnError?: boolean }
    ) => Promise<{ successful: number; failed: number; total: number }>;
    reset: () => void;
    setProgress: (current: number, total: number) => void;
}

export const useApiCall = <T = any>(
    options: UseApiCallOptions<T> = {}
): UseApiCallResult<T> => {
    const {
        onSuccess,
        onError,
        onFinally,
        resetDataOnError = false,
        initialData = null,
        showProgress = false,
        enableLogging = true,
    } = options;

    const [data, setData] = useState<T | null>(initialData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgressState] = useState<{ current: number; total: number } | null>(
        showProgress ? { current: 0, total: 0 } : null
    );

    const reset = useCallback(() => {
        setData(initialData);
        setLoading(false);
        setError(null);
        if (showProgress) {
            setProgressState({ current: 0, total: 0 });
        }
    }, [initialData, showProgress]);

    const setProgress = useCallback((current: number, total: number) => {
        if (showProgress) {
            setProgressState({ current, total });
        }
    }, [showProgress]);

    const execute = useCallback(async (
        apiCall: () => Promise<ApiResponse<T>>
    ): Promise<boolean> => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiCall();

            if (response.error) {
                const errorMessage = response.error;
                setError(errorMessage);
                
                if (resetDataOnError) {
                    setData(initialData);
                }
                
                if (enableLogging) {
                    console.error('API call failed:', errorMessage);
                }
                
                onError?.(errorMessage);
                return false;
            }

            if (response.data !== undefined) {
                setData(response.data);
                await onSuccess?.(response.data);
            }

            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
            setError(errorMessage);
            
            if (resetDataOnError) {
                setData(initialData);
            }
            
            if (enableLogging) {
                console.error('API call exception:', err);
            }
            
            onError?.(errorMessage);
            return false;
        } finally {
            setLoading(false);
            onFinally?.();
        }
    }, [onSuccess, onError, onFinally, resetDataOnError, initialData, enableLogging]);

    const executeBatch = useCallback(async (
        apiCalls: (() => Promise<ApiResponse<any>>)[],
        options: { stopOnError?: boolean } = {}
    ): Promise<{ successful: number; failed: number; total: number }> => {
        const { stopOnError = false } = options;
        
        try {
            setLoading(true);
            setError(null);
            
            if (showProgress) {
                setProgressState({ current: 0, total: apiCalls.length });
            }

            let successful = 0;
            let failed = 0;

            for (let i = 0; i < apiCalls.length; i++) {
                if (showProgress) {
                    setProgressState({ current: i + 1, total: apiCalls.length });
                }

                try {
                    const response = await apiCalls[i]();
                    
                    if (response.error) {
                        failed++;
                        if (enableLogging) {
                            console.error(`Batch operation ${i + 1} failed:`, response.error);
                        }
                        
                        if (stopOnError) {
                            setError(`Batch operation failed at step ${i + 1}: ${response.error}`);
                            break;
                        }
                    } else {
                        successful++;
                    }
                } catch (err) {
                    failed++;
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    
                    if (enableLogging) {
                        console.error(`Batch operation ${i + 1} exception:`, err);
                    }
                    
                    if (stopOnError) {
                        setError(`Batch operation failed at step ${i + 1}: ${errorMessage}`);
                        break;
                    }
                }
            }

            const result = { successful, failed, total: apiCalls.length };

            if (failed > 0 && !stopOnError) {
                const errorMessage = `Batch completed with ${failed} failures out of ${apiCalls.length} operations`;
                setError(errorMessage);
                onError?.(errorMessage);
            }

            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Batch operation failed';
            setError(errorMessage);
            
            if (enableLogging) {
                console.error('Batch operation exception:', err);
            }
            
            onError?.(errorMessage);
            return { successful: 0, failed: apiCalls.length, total: apiCalls.length };
        } finally {
            setLoading(false);
            
            if (showProgress) {
                setProgressState({ current: 0, total: 0 });
            }
            
            onFinally?.();
        }
    }, [showProgress, enableLogging, onError, onFinally]);

    return {
        data,
        loading,
        error,
        progress,
        execute,
        executeBatch,
        reset,
        setProgress,
    };
};
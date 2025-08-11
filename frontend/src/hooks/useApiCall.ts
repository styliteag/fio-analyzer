import { useState, useCallback, useRef, useEffect } from 'react';
import type { ApiResponse, BatchOperationResult } from '../types/api';
import { getErrorMessage, isAbortError, isCancelledError } from '../types/api';

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
    execute: (
        apiCall: (abortSignal?: AbortSignal) => Promise<ApiResponse<T>>
    ) => Promise<boolean>;
    executeBatch: <U = unknown>(
        apiCalls: ((abortSignal?: AbortSignal) => Promise<ApiResponse<U>>)[],
        options?: { stopOnError?: boolean }
    ) => Promise<BatchOperationResult>;
    reset: () => void;
    setProgress: (current: number, total: number) => void;
    cancel: () => void;
    isCancelled: boolean;
}

export const useApiCall = <T = unknown>(
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

    // AbortController management
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isCancelled, setIsCancelled] = useState(false);

    const reset = useCallback(() => {
        // Cancel any ongoing requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        
        setData(initialData);
        setLoading(false);
        setError(null);
        setIsCancelled(false);
        if (showProgress) {
            setProgressState({ current: 0, total: 0 });
        }
    }, [initialData, showProgress]);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsCancelled(true);
            setLoading(false);
            
            if (enableLogging) {
                console.log('API call cancelled by user');
            }
        }
    }, [enableLogging]);

    const setProgress = useCallback((current: number, total: number) => {
        if (showProgress) {
            setProgressState({ current, total });
        }
    }, [showProgress]);

    const execute = useCallback(async (
        apiCall: (abortSignal?: AbortSignal) => Promise<ApiResponse<T>>
    ): Promise<boolean> => {
        try {
            // Cancel any existing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new AbortController for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setLoading(true);
            setError(null);
            setIsCancelled(false);

            const response = await apiCall(abortController.signal);

            // Check if request was cancelled
            if (abortController.signal.aborted) {
                return false;
            }

            if (response.error) {
                const errorMessage = response.error;
                
                // Don't treat cancellation as an error
                if (errorMessage === 'Request cancelled') {
                    setIsCancelled(true);
                    return false;
                }
                
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
            // Handle AbortError specifically
            if (isAbortError(err) || isCancelledError(err)) {
                setIsCancelled(true);
                return false;
            }

            const errorMessage = getErrorMessage(err);
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
            abortControllerRef.current = null;
            onFinally?.();
        }
    }, [onSuccess, onError, onFinally, resetDataOnError, initialData, enableLogging]);

    const executeBatch = useCallback(async <U = unknown>(
        apiCalls: ((abortSignal?: AbortSignal) => Promise<ApiResponse<U>>)[],
        options: { stopOnError?: boolean } = {}
    ): Promise<BatchOperationResult> => {
        const { stopOnError = false } = options;
        
        try {
            // Cancel any existing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new AbortController for this batch
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setLoading(true);
            setError(null);
            setIsCancelled(false);
            
            if (showProgress) {
                setProgressState({ current: 0, total: apiCalls.length });
            }

            let successful = 0;
            let failed = 0;

            for (let i = 0; i < apiCalls.length; i++) {
                // Check if batch was cancelled
                if (abortController.signal.aborted) {
                    break;
                }

                if (showProgress) {
                    setProgressState({ current: i + 1, total: apiCalls.length });
                }

                try {
                    const response = await apiCalls[i](abortController.signal);
                    
                    if (response.error) {
                        // Handle cancellation
                        if (response.error === 'Request cancelled') {
                            break;
                        }
                        
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
                    // Handle AbortError specifically
                    if (isAbortError(err) || isCancelledError(err)) {
                        break;
                    }

                    failed++;
                    const errorMessage = getErrorMessage(err);
                    
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

            if (failed > 0 && !stopOnError && !abortController.signal.aborted) {
                const errorMessage = `Batch completed with ${failed} failures out of ${apiCalls.length} operations`;
                setError(errorMessage);
                onError?.(errorMessage);
            }

            return result;
        } catch (err) {
            // Handle AbortError specifically
            if (isAbortError(err) || isCancelledError(err)) {
                setIsCancelled(true);
                return { successful: 0, failed: 0, total: apiCalls.length };
            }

            const errorMessage = getErrorMessage(err);
            setError(errorMessage);
            
            if (enableLogging) {
                console.error('Batch operation exception:', err);
            }
            
            onError?.(errorMessage);
            return { successful: 0, failed: apiCalls.length, total: apiCalls.length };
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
            
            if (showProgress) {
                setProgressState({ current: 0, total: 0 });
            }
            
            onFinally?.();
        }
    }, [showProgress, enableLogging, onError, onFinally]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        data,
        loading,
        error,
        progress,
        execute,
        executeBatch,
        reset,
        setProgress,
        cancel,
        isCancelled,
    };
};
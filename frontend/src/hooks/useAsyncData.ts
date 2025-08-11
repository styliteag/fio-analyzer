/**
 * Consolidated async data management hook
 * 
 * This hook consolidates common patterns found across multiple API hooks:
 * - State management (loading, error, data)
 * - Error handling and logging
 * - Auto-fetch on mount
 * - Optimistic updates
 * - Data validation
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export interface UseAsyncDataOptions<T> {
  autoFetch?: boolean;
  validateData?: boolean;
  validator?: (data: T) => { valid: boolean; errors?: string[] };
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  enableLogging?: boolean;
  resetDataOnError?: boolean;
  initialData?: T | null;
}

export interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
  reset: () => void;
  isEmpty: boolean;
}

/**
 * Generic async data management hook
 */
export const useAsyncData = <T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataResult<T> => {
  const {
    autoFetch = true,
    validateData = false,
    validator,
    onSuccess,
    onError,
    enableLogging = true,
    resetDataOnError = false,
    initialData = null,
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetcher();

      // Validate data if enabled
      if (validateData && validator) {
        const validation = validator(result);
        if (!validation.valid) {
          if (enableLogging) {
            console.warn('Data validation warnings:', validation.errors);
          }
        }
      }

      setData(result);
      onSuccess?.(result);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch data';
      setError(errorMessage);
      
      if (resetDataOnError) {
        setData(initialData);
      }
      
      if (enableLogging) {
        console.error('Error fetching data:', err);
      }
      
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, validateData, validator, onSuccess, onError, enableLogging, resetDataOnError, initialData, ...deps]);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  const isEmpty = useMemo(() => {
    if (data === null || data === undefined) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    return false;
  }, [data]);

  // Auto-fetch on mount and dependency changes
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
    reset,
    isEmpty,
  };
};

/**
 * Hook for API calls with CRUD operations
 */
export interface UseCrudDataOptions<T> extends UseAsyncDataOptions<T[]> {
  updateOptimistically?: boolean;
}

export interface UseCrudDataResult<T, TUpdate = Partial<T>> extends Omit<UseAsyncDataResult<T[]>, 'data'> {
  data: T[];
  create: (item: Omit<T, 'id'>) => Promise<boolean>;
  update: (id: number | string, updates: TUpdate) => Promise<boolean>;
  remove: (id: number | string) => Promise<boolean>;
  bulkUpdate: (ids: (number | string)[], updates: TUpdate) => Promise<{ successful: number; failed: number; total: number }>;
  bulkRemove: (ids: (number | string)[]) => Promise<{ successful: number; failed: number; total: number }>;
}

export const useCrudData = <T extends { id: number | string }, TUpdate = Partial<T>>(
  fetcher: () => Promise<T[]>,
  createFn: (item: Omit<T, 'id'>) => Promise<T>,
  updateFn: (id: number | string, updates: TUpdate) => Promise<void>,
  deleteFn: (id: number | string) => Promise<void>,
  bulkUpdateFn?: (ids: (number | string)[], updates: TUpdate) => Promise<void>,
  bulkDeleteFn?: (ids: (number | string)[]) => Promise<{ successful: number; failed: number; total: number }>,
  deps: React.DependencyList = [],
  options: UseCrudDataOptions<T> = {}
): UseCrudDataResult<T, TUpdate> => {
  const { updateOptimistically = true, ...asyncOptions } = options;
  
  const {
    data,
    loading,
    error,
    refetch,
    setData,
    reset,
    isEmpty,
  } = useAsyncData<T[]>(fetcher, deps, { ...asyncOptions, initialData: [] });

  const create = useCallback(async (item: Omit<T, 'id'>): Promise<boolean> => {
    try {
      const newItem = await createFn(item);
      
      if (updateOptimistically) {
        setData(prevData => [...(prevData || []), newItem]);
      } else {
        await refetch();
      }
      
      return true;
    } catch (err: any) {
      console.error('Error creating item:', err);
      return false;
    }
  }, [createFn, updateOptimistically, setData, refetch]);

  const update = useCallback(async (id: number | string, updates: TUpdate): Promise<boolean> => {
    try {
      await updateFn(id, updates);
      
      if (updateOptimistically) {
        setData(prevData => 
          (prevData || []).map(item => 
            item.id === id ? { ...item, ...updates } : item
          )
        );
      } else {
        await refetch();
      }
      
      return true;
    } catch (err: any) {
      console.error('Error updating item:', err);
      throw err;
    }
  }, [updateFn, updateOptimistically, setData, refetch]);

  const remove = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await deleteFn(id);
      
      if (updateOptimistically) {
        setData(prevData => (prevData || []).filter(item => item.id !== id));
      } else {
        await refetch();
      }
      
      return true;
    } catch (err: any) {
      console.error('Error deleting item:', err);
      return false;
    }
  }, [deleteFn, updateOptimistically, setData, refetch]);

  const bulkUpdate = useCallback(async (
    ids: (number | string)[], 
    updates: TUpdate
  ): Promise<{ successful: number; failed: number; total: number }> => {
    if (!bulkUpdateFn) {
      // Fallback to individual updates
      let successful = 0;
      for (const id of ids) {
        try {
          await update(id, updates);
          successful++;
        } catch {
          // Error already logged by update function
        }
      }
      return { successful, failed: ids.length - successful, total: ids.length };
    }

    try {
      await bulkUpdateFn(ids, updates);
      
      if (updateOptimistically) {
        setData(prevData => 
          (prevData || []).map(item => 
            ids.includes(item.id) ? { ...item, ...updates } : item
          )
        );
      } else {
        await refetch();
      }
      
      return { successful: ids.length, failed: 0, total: ids.length };
    } catch (err: any) {
      console.error('Error bulk updating items:', err);
      return { successful: 0, failed: ids.length, total: ids.length };
    }
  }, [bulkUpdateFn, update, updateOptimistically, setData, refetch]);

  const bulkRemove = useCallback(async (
    ids: (number | string)[]
  ): Promise<{ successful: number; failed: number; total: number }> => {
    if (!bulkDeleteFn) {
      // Fallback to individual deletes
      let successful = 0;
      for (const id of ids) {
        if (await remove(id)) {
          successful++;
        }
      }
      return { successful, failed: ids.length - successful, total: ids.length };
    }

    try {
      const result = await bulkDeleteFn(ids);
      
      if (updateOptimistically && result.successful > 0) {
        setData(prevData => (prevData || []).filter(item => !ids.includes(item.id)));
      } else if (!updateOptimistically) {
        await refetch();
      }
      
      return result;
    } catch (err: any) {
      console.error('Error bulk deleting items:', err);
      return { successful: 0, failed: ids.length, total: ids.length };
    }
  }, [bulkDeleteFn, remove, updateOptimistically, setData, refetch]);

  return {
    data: data || [],
    loading,
    error,
    refetch,
    setData,
    reset,
    isEmpty,
    create,
    update,
    remove,
    bulkUpdate,
    bulkRemove,
  };
};

/**
 * Hook for filtered and sorted data
 */
export const useFilteredData = <T>(
  data: T[],
  filters: Record<string, any> = {},
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
) => {
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Apply filters
    if (Object.keys(filters).length > 0) {
      filtered = filtered.filter(item => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value || (Array.isArray(value) && value.length === 0)) {
            return true;
          }

          const itemValue = (item as any)[key];
          
          if (Array.isArray(value)) {
            return value.includes(itemValue);
          }
          
          return itemValue === value;
        });
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        const aValue = (a as any)[sortBy];
        const bValue = (b as any)[sortBy];

        const comparison = typeof aValue === 'string' 
          ? aValue.localeCompare(bValue)
          : aValue - bValue;
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, filters, sortBy, sortOrder]);

  const summary = useMemo(() => {
    const totalItems = data.length;
    const filteredItems = filteredAndSortedData.length;
    
    return {
      totalItems,
      filteredItems,
      filteredPercentage: totalItems > 0 ? (filteredItems / totalItems) * 100 : 0,
    };
  }, [data.length, filteredAndSortedData.length]);

  return {
    data: filteredAndSortedData,
    summary,
  };
};
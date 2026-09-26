// Delete-old / compact operations on the historical test run table
import { useCallback, useState } from 'react';
import { executeTimeSeriesCleanup, previewTimeSeriesCleanup } from '../../../services/api/timeSeries';
import { useToast } from '../../../contexts/ToastContext';
import type { CleanupMode, DataCleanupState } from '../types';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const INITIAL: DataCleanupState = {
    isOpen: false,
    mode: null,
    cutoffDate: new Date(Date.now() - NINETY_DAYS_MS).toISOString().split('T')[0], // 90 days ago
    compactFrequency: 'daily',
    previewCount: null,
    isLoading: false,
    hostname: null,
};

const cleanupArgs = (state: DataCleanupState) =>
    [
        state.cutoffDate,
        state.mode || 'delete-old',
        state.mode === 'compact' ? state.compactFrequency : undefined,
        state.hostname || undefined,
    ] as const;

export const useCleanup = (searchTerm: string, onDone: () => void) => {
    const toast = useToast();
    const [state, setState] = useState<DataCleanupState>(INITIAL);

    const update = useCallback((patch: Partial<DataCleanupState>) => setState((prev) => ({ ...prev, ...patch })), []);

    const open = useCallback(
        (mode: CleanupMode) =>
            // Use current search term as hostname filter
            update({ isOpen: true, mode, previewCount: null, hostname: searchTerm || null }),
        [searchTerm, update],
    );

    const close = useCallback(() => update({ isOpen: false }), [update]);

    const preview = useCallback(async () => {
        update({ isLoading: true });
        try {
            const result = await previewTimeSeriesCleanup(...cleanupArgs(state));
            if (result.error) {
                throw new Error(result.error);
            }
            update({ previewCount: result.data?.affected_count || 0, isLoading: false });
        } catch {
            toast.error('Failed to preview cleanup');
            update({ isLoading: false });
        }
    }, [state, update, toast]);

    const execute = useCallback(async () => {
        update({ isLoading: true });
        try {
            const result = await executeTimeSeriesCleanup(...cleanupArgs(state));
            if (result.error) {
                throw new Error(result.error);
            }
            const hostnameInfo = state.hostname ? ` for host "${state.hostname}"` : '';
            const verb = state.mode === 'delete-old' ? 'deleted' : 'compacted';
            toast.success(`Successfully ${verb} ${result.data?.deleted_count || 0} test runs${hostnameInfo}`);
            update({ isOpen: false, isLoading: false });
            onDone();
        } catch {
            toast.error('Failed to execute cleanup');
            update({ isLoading: false });
        }
    }, [state, update, onDone, toast]);

    return { state, update, open, close, preview, execute };
};

export type Cleanup = ReturnType<typeof useCleanup>;

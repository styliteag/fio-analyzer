// Load historical test runs while the history tab is active
import { useCallback, useEffect, useState } from 'react';
import { fetchTimeSeriesHistory } from '../../../services/api/timeSeries';
import { useToast } from '../../../contexts/ToastContext';
import type { HistoryRow } from '../types';

export interface HistoryDataResult {
    rows: HistoryRow[];
    loading: boolean;
    reload: () => void;
}

export const useHistoryData = (enabled: boolean): HistoryDataResult => {
    const toast = useToast();
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(false);

    const reload = useCallback(() => {
        setLoading(true);
        fetchTimeSeriesHistory()
            .then((result) => {
                if (result.error) {
                    toast.error(`Failed to load history: ${result.error}`);
                    setRows([]);
                    return;
                }
                // Backend returns { data: { data: [...], pagination: {...} } }
                setRows(Array.isArray(result.data?.data) ? (result.data.data as HistoryRow[]) : []);
            })
            .catch(() => {
                toast.error('Failed to load history');
                setRows([]);
            })
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => {
        if (enabled) {
            reload();
        }
    }, [enabled, reload]);

    return { rows, loading, reload };
};

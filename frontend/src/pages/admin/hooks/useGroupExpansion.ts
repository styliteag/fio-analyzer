// Expanded UUID groups plus a per-UUID cache of their fetched test runs
import { useCallback, useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import type { TestRun } from '../../../types';
import { fetchRunsByIds } from '../utils';

export interface GroupExpansion {
    expanded: ReadonlySet<string>;
    runsByUuid: ReadonlyMap<string, TestRun[]>;
    loadingByUuid: ReadonlyMap<string, boolean>;
    toggle: (uuid: string, testRunIds?: number[]) => void;
    cacheRuns: (uuid: string, runs: TestRun[]) => void;
    clearCache: () => void;
}

const withEntry = <V,>(map: ReadonlyMap<string, V>, key: string, value: V): Map<string, V> => new Map(map).set(key, value);

export const useGroupExpansion = (): GroupExpansion => {
    const toast = useToast();
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [runsByUuid, setRunsByUuid] = useState<ReadonlyMap<string, TestRun[]>>(new Map());
    const [loadingByUuid, setLoadingByUuid] = useState<ReadonlyMap<string, boolean>>(new Map());

    const cacheRuns = useCallback((uuid: string, runs: TestRun[]) => {
        setRunsByUuid((prev) => withEntry(prev, uuid, runs));
    }, []);

    const clearCache = useCallback(() => setRunsByUuid(new Map()), []);

    const fetchGroupRuns = useCallback(
        async (uuid: string, testRunIds: number[]) => {
            // Skip if already loading or loaded
            if (loadingByUuid.get(uuid) || runsByUuid.has(uuid)) {
                return;
            }
            setLoadingByUuid((prev) => withEntry(prev, uuid, true));
            try {
                cacheRuns(uuid, await fetchRunsByIds(testRunIds));
            } catch {
                toast.error('Failed to load test runs for this group');
            } finally {
                setLoadingByUuid((prev) => withEntry(prev, uuid, false));
            }
        },
        [loadingByUuid, runsByUuid, cacheRuns, toast],
    );

    const toggle = useCallback(
        (uuid: string, testRunIds?: number[]) => {
            const opening = !expanded.has(uuid);
            setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(uuid)) {
                    next.delete(uuid);
                } else {
                    next.add(uuid);
                }
                return next;
            });
            // Fetch runs when expanding if not already loaded
            if (opening && testRunIds && testRunIds.length > 0) {
                fetchGroupRuns(uuid, testRunIds);
            }
        },
        [expanded, fetchGroupRuns],
    );

    return { expanded, runsByUuid, loadingByUuid, toggle, cacheRuns, clearCache };
};

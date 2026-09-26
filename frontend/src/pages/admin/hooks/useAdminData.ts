// All data sources of the Admin page; each fetches only while its tab is active
import { useUUIDGroupedRuns } from '../../../hooks/api/useUUIDGroupedRuns';
import type { UseUUIDGroupedRunsReturn } from '../../../hooks/api/useUUIDGroupedRuns';
import { useServerSideTestRuns } from '../../../hooks/useServerSideTestRuns';
import type { TestRun } from '../../../types';
import type { AdminTab } from '../types';
import { useHierarchyRuns, type HierarchyRunsResult } from './useHierarchyRuns';
import { useHistoryData, type HistoryDataResult } from './useHistoryData';
import { useSaturationRuns, type SaturationRunsResult } from './useSaturationRuns';

export interface LatestRunsResult {
    runs: TestRun[];
    loading: boolean;
    error: string | null;
}

export interface AdminData {
    configGroups: UseUUIDGroupedRunsReturn;
    runGroups: UseUUIDGroupedRunsReturn;
    latest: LatestRunsResult;
    hierarchy: HierarchyRunsResult;
    history: HistoryDataResult;
    saturation: SaturationRunsResult;
}

export const useAdminData = (activeTab: AdminTab): AdminData => {
    const configGroups = useUUIDGroupedRuns({ groupBy: 'config_uuid', enabled: activeTab === 'by-config' });
    const runGroups = useUUIDGroupedRuns({ groupBy: 'run_uuid', enabled: activeTab === 'by-run' });

    const { testRuns, loading, error } = useServerSideTestRuns({
        autoFetch: activeTab === 'latest' || activeTab === 'hierarchy',
        // For hierarchical view, fetch all test runs (max limit is 10000)
        limit: activeTab === 'hierarchy' ? 10000 : undefined,
    });

    const hierarchy = useHierarchyRuns(activeTab === 'hierarchy');
    const history = useHistoryData(activeTab === 'history');
    const saturation = useSaturationRuns(activeTab === 'saturation');

    return {
        configGroups,
        runGroups,
        latest: { runs: testRuns, loading, error },
        hierarchy,
        history,
        saturation,
    };
};

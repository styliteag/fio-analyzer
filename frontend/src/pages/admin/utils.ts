// Pure helpers for the Admin page (filtering, grouping, fetching)
import { extractTestRuns, fetchTestRun, fetchTestRuns } from '../../services/api/testRuns';
import type { SaturationRun } from '../../services/api/testRuns';
import type { TestRun, UUIDGroup } from '../../types';
import type { EditableFields, HierarchyData, HistoryRow, LatestRunGroup } from './types';

type Searchable = Partial<Record<string, unknown>>;

const includesTerm = (lowerSearch: string, values: readonly unknown[]): boolean =>
    values.some((value) => typeof value === 'string' && value.toLowerCase().includes(lowerSearch));

const blockSizeText = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));

/** Match fields shared by test runs and history rows. */
export const matchesRun = (run: TestRun | HistoryRow, lowerSearch: string): boolean => {
    const r = run as Searchable;
    return includesTerm(lowerSearch, [
        r.hostname,
        r.protocol,
        r.drive_model,
        r.drive_type,
        r.test_name,
        r.description,
        r.read_write_pattern,
        blockSizeText(r.block_size),
        r.config_uuid,
        r.run_uuid,
    ]);
};

export const matchesGroup = (group: UUIDGroup, lowerSearch: string): boolean => {
    const metadata = group.sample_metadata;
    return includesTerm(lowerSearch, [
        metadata.hostname,
        metadata.protocol,
        metadata.drive_model,
        metadata.drive_type,
        group.uuid,
    ]);
};

export const matchesSaturationRun = (run: SaturationRun, lowerSearch: string): boolean =>
    includesTerm(lowerSearch, [
        run.hostname,
        run.protocol,
        run.drive_type,
        run.drive_model,
        run.block_size,
        run.description,
        run.run_uuid,
    ]);

/** Filter a list by search term; returns the input unchanged when the term is empty. */
export const filterBySearch = <T>(items: readonly T[], searchTerm: string, match: (item: T, lower: string) => boolean): readonly T[] => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter((item) => match(item, lower));
};

export const getMostCommonValue = (values: readonly (string | undefined | null)[]): string => {
    const counts = new Map<string, number>();
    values
        .filter((v): v is string => Boolean(v && v.trim()))
        .forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));

    let maxCount = 0;
    let mostCommon = '';
    counts.forEach((count, value) => {
        if (count > maxCount) {
            maxCount = count;
            mostCommon = value;
        }
    });
    return mostCommon;
};

export const commonEditableFields = (runs: readonly TestRun[]): EditableFields => ({
    hostname: getMostCommonValue(runs.map((r) => r.hostname)),
    protocol: getMostCommonValue(runs.map((r) => r.protocol)),
    description: getMostCommonValue(runs.map((r) => r.description)),
    test_name: getMostCommonValue(runs.map((r) => r.test_name)),
    drive_type: getMostCommonValue(runs.map((r) => r.drive_type)),
    drive_model: getMostCommonValue(runs.map((r) => r.drive_model)),
});

/** Build an update payload from only the enabled fields. */
export const collectEnabledUpdates = <T extends object>(fields: T, enabled: Record<keyof T, boolean>): Partial<T> =>
    (Object.keys(enabled) as (keyof T)[])
        .filter((key) => enabled[key])
        .reduce<Partial<T>>((acc, key) => ({ ...acc, [key]: fields[key] }), {});

export const formatDateRange = (firstTest: string, lastTest: string): string => {
    const first = new Date(firstTest).toLocaleDateString();
    const last = new Date(lastTest).toLocaleDateString();
    return first === last ? first : `${first} - ${last}`;
};

export const plural = (count: number): string => (count !== 1 ? 's' : '');

export const averageIops = (runs: readonly TestRun[]): number =>
    runs.length > 0 ? runs.reduce((sum, r) => sum + (r.iops || 0), 0) / runs.length : 0;

/** Flatten any nesting level of the hierarchy into its test runs. */
export const flattenRuns = (node: TestRun[] | Record<string, unknown>): TestRun[] =>
    Array.isArray(node)
        ? node
        : Object.values(node).flatMap((child) => flattenRuns(child as TestRun[] | Record<string, unknown>));

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> =>
    items.reduce((map, item) => {
        const key = keyOf(item);
        return map.set(key, [...(map.get(key) ?? []), item]);
    }, new Map<string, T[]>());

export const groupLatestRuns = (runs: readonly TestRun[]): LatestRunGroup[] =>
    Array.from(groupBy(runs, (run) => run.run_uuid || 'no-uuid').entries())
        .map(([uuid, groupRuns]) => ({
            uuid,
            runs: groupRuns,
            count: groupRuns.length,
            avgIops: groupRuns.reduce((sum, r) => sum + (r.iops || 0), 0) / groupRuns.length,
            latestTimestamp: Math.max(...groupRuns.map((r) => new Date(r.timestamp).getTime())),
            hostname: groupRuns[0]?.hostname || 'N/A',
        }))
        .sort((a, b) => b.latestTimestamp - a.latestTimestamp);

/** Host → Host-Protocol → Host-Protocol-Type → Host-Protocol-Type-Model */
export const buildHierarchy = (runs: readonly TestRun[]): HierarchyData => {
    const result: HierarchyData = {};
    groupBy(runs, (run) => run.hostname || 'unknown').forEach((hostRuns, hostname) => {
        const protocols: HierarchyData[string] = {};
        groupBy(hostRuns, (run) => `${hostname}-${run.protocol || 'unknown'}`).forEach((protocolRuns, protocolKey) => {
            const protocol = protocolRuns[0]?.protocol || 'unknown';
            const types: HierarchyData[string][string] = {};
            groupBy(protocolRuns, (run) => `${hostname}-${protocol}-${run.drive_type || 'unknown'}`).forEach((typeRuns, typeKey) => {
                const driveType = typeRuns[0]?.drive_type || 'unknown';
                types[typeKey] = Object.fromEntries(
                    groupBy(typeRuns, (run) => `${hostname}-${protocol}-${driveType}-${run.drive_model || 'unknown'}`),
                );
            });
            protocols[protocolKey] = types;
        });
        result[hostname] = protocols;
    });
    return result;
};

/** Fetch runs one by one (same as backend single-run endpoint), dropping empty results. */
export const fetchRunsByIds = async (ids: readonly number[]): Promise<TestRun[]> => {
    const runs = await Promise.all(
        ids.map(async (id) => {
            const result = await fetchTestRun(id);
            if (result.error) {
                throw new Error(result.error);
            }
            return result.data;
        }),
    );
    return runs.filter((run): run is TestRun => run !== null && run !== undefined);
};

const HIERARCHY_CHUNK_SIZE = 1000;

/** Page through /api/test-runs until a short chunk is returned. */
export const fetchAllTestRunsPaginated = async (
    onProgress: (fetched: number, hasMore: boolean) => void,
): Promise<TestRun[]> => {
    let allRuns: TestRun[] = [];
    let hasMore = true;
    while (hasMore) {
        const response = await fetchTestRuns({ limit: HIERARCHY_CHUNK_SIZE, offset: allRuns.length });
        if (response.error) {
            throw new Error(response.error);
        }
        if (!response.data) {
            break;
        }
        const chunk = extractTestRuns(response.data);
        allRuns = [...allRuns, ...chunk];
        hasMore = chunk.length === HIERARCHY_CHUNK_SIZE;
        onProgress(allRuns.length, hasMore);
    }
    return allRuns;
};

export const errorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;

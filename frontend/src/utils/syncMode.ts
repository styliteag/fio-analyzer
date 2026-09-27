// fio sync mode (stored by the backend as text: none, sync, dsync)

export const SYNC_MODE_ORDER: readonly string[] = ['none', 'sync', 'dsync'];

export const SYNC_MODE_LABELS: Readonly<Record<string, string>> = {
    none: 'None',
    sync: 'Sync (O_SYNC)',
    dsync: 'DSync (O_DSYNC)',
};

export const formatSyncMode = (mode: string | null | undefined): string =>
    mode ? SYNC_MODE_LABELS[mode] ?? mode : '–';

/** Sort sync modes none → sync → dsync, unknown values last */
export const compareSyncModes = (a: string, b: string): number => {
    const rank = (mode: string) => {
        const index = SYNC_MODE_ORDER.indexOf(mode);
        return index === -1 ? SYNC_MODE_ORDER.length : index;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
};

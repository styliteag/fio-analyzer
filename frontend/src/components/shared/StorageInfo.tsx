// Storage configuration detected by fio-test.sh (rendered as plain text: values come from the client)
import type { StorageInfo as StorageInfoData } from '../../types';

const ORDER = ['fs_type', 'os', 'kernel', 'ioengine', 'fio_version', 'mem_total', 'arc_max'] as const;
const LABELS: Readonly<Record<string, string>> = {
    fs_type: 'Filesystem',
    os: 'OS',
    kernel: 'Kernel',
    ioengine: 'I/O engine',
    fio_version: 'fio',
    mem_total: 'RAM',
    arc_max: 'ZFS ARC max',
};
// Byte counts shown in GiB (the cache sizes the working set was checked against)
const BYTE_KEYS: ReadonlySet<string> = new Set(['mem_total', 'arc_max']);

const formatBytes = (value: number): string => `${(value / 1024 ** 3).toFixed(1)} GiB`;

const formatValue = (value: unknown, field?: string): string => {
    if (field !== undefined && BYTE_KEYS.has(field) && typeof value === 'number' && Number.isFinite(value)) {
        return formatBytes(value);
    }
    return value !== null && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>)
              .map(([key, inner]) => `${key}=${String(inner)}`)
              .join(' · ')
        : String(value);
};

/** One-line summary, e.g. "zfs · tank/fio sync=disabled recordsize=16K · io_uring · 6.8.12" */
export const storageInfoSummary = (info: StorageInfoData | null | undefined): string | null => {
    if (!info) return null;
    const zfs = info.zfs ? `${info.zfs.dataset ?? ''} ${['sync', 'recordsize', 'volblocksize', 'compression']
        .filter((key) => info.zfs?.[key])
        .map((key) => `${key}=${info.zfs?.[key]}`)
        .join(' ')}`.trim() : null;
    const ceph = info.ceph ? `ceph ${info.ceph.kind ?? ''} ${info.ceph.pool ?? ''}`.trim() : null;
    return [info.fs_type, zfs, ceph, info.ioengine, info.kernel].filter(Boolean).join(' · ') || null;
};

const StorageInfo: React.FC<{ readonly info: StorageInfoData | null | undefined }> = ({ info }) => {
    if (!info) {
        return <p className="text-sm theme-text-secondary">Not recorded (uploaded before storage detection or by another client).</p>;
    }
    const known = ORDER.filter((key) => info[key] !== undefined);
    const nested = Object.keys(info).filter((key) => !ORDER.includes(key as (typeof ORDER)[number]));
    return (
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            {[...known, ...nested].map((key) => (
                <div key={key} className="contents">
                    <dt className="theme-text-secondary">{Object.prototype.hasOwnProperty.call(LABELS, key) ? LABELS[key] : key.toUpperCase()}</dt>
                    <dd className="theme-text-primary font-mono break-all">{formatValue(info[key], key)}</dd>
                </div>
            ))}
        </dl>
    );
};

export default StorageInfo;

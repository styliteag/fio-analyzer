// Sortable list of client ramps (one row per ramp_uuid = one test configuration)
import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { rampConfigLabel, rampHierarchy, type RampListItem } from '../../services/api/ramp';

export const RAMP_SORT_KEYS = ['date', 'storage', 'config', 'clients', 'steps'] as const;
export type RampSortKey = (typeof RAMP_SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

const sortValue = (ramp: RampListItem, key: RampSortKey): string | number => {
    switch (key) {
        case 'date':
            return ramp.last_timestamp ?? '';
        case 'storage':
            return rampHierarchy(ramp).join('-').toLowerCase();
        case 'config':
            return rampConfigLabel(ramp).toLowerCase();
        case 'clients':
            return ramp.max_clients ?? 0;
        case 'steps':
            return ramp.steps;
    }
};

export const sortRamps = (ramps: readonly RampListItem[], key: RampSortKey, direction: SortDirection): RampListItem[] => {
    const factor = direction === 'asc' ? 1 : -1;
    return [...ramps].sort((a, b) => {
        const [left, right] = [sortValue(a, key), sortValue(b, key)];
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
        return order * factor || (b.last_timestamp ?? '').localeCompare(a.last_timestamp ?? '');
    });
};

export const formatRampDate = (timestamp: string | null): string => (timestamp ? new Date(timestamp).toLocaleString() : '–');

/** host › protocol › type › model, the level-4 hierarchy key of the ramp */
export const RampHierarchy: React.FC<{ readonly ramp: RampListItem }> = ({ ramp }) => {
    const parts = rampHierarchy(ramp);
    return (
        <span title={parts.join('-')}>
            {parts.map((part, index) => (
                <React.Fragment key={index}>
                    {index > 0 && <span className="mx-1 theme-text-tertiary" aria-hidden="true">›</span>}
                    <span className={index === 0 ? 'font-medium theme-text-primary' : 'theme-text-secondary'}>{part}</span>
                </React.Fragment>
            ))}
        </span>
    );
};

const COLUMNS: readonly { readonly key: RampSortKey; readonly label: string; readonly align?: 'right' }[] = [
    { key: 'storage', label: 'Host › protocol › type › model' },
    { key: 'config', label: 'Configuration' },
    { key: 'clients', label: 'Clients', align: 'right' },
    { key: 'steps', label: 'Steps', align: 'right' },
    { key: 'date', label: 'Last upload' },
];

interface RampListProps {
    readonly ramps: readonly RampListItem[];
    readonly selected: string | null;
    readonly sortKey: RampSortKey;
    readonly sortDirection: SortDirection;
    readonly onSort: (key: RampSortKey) => void;
    readonly onSelect: (ramp: RampListItem) => void;
}

export const RampList: React.FC<RampListProps> = ({ ramps, selected, sortKey, sortDirection, onSort, onSelect }) => (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
            <thead className="sticky top-0 theme-bg-tertiary">
                <tr className="text-left theme-text-secondary">
                    {COLUMNS.map(({ key, label, align }) => {
                        const active = sortKey === key;
                        const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
                        return (
                            <th
                                key={key}
                                scope="col"
                                aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                className={`px-3 py-2 font-medium border-b theme-border-primary ${align === 'right' ? 'text-right' : ''}`}
                            >
                                <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 hover:theme-text-primary">
                                    {label}
                                    <Icon className={`h-3.5 w-3.5 ${active ? '' : 'opacity-40'}`} aria-hidden="true" />
                                </button>
                            </th>
                        );
                    })}
                    <th scope="col" className="px-3 py-2 font-medium border-b theme-border-primary">Run</th>
                </tr>
            </thead>
            <tbody>
                {ramps.map((ramp) => {
                    const isSelected = ramp.ramp_uuid === selected;
                    return (
                        <tr
                            key={ramp.ramp_uuid}
                            onClick={() => onSelect(ramp)}
                            aria-selected={isSelected}
                            className={`cursor-pointer border-b theme-border-primary ${
                                isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                        >
                            <td className="px-3 py-2 whitespace-nowrap">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onSelect(ramp);
                                    }}
                                    className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                                    aria-label={`Show ramp ${rampHierarchy(ramp).join('-')} ${rampConfigLabel(ramp)}`}
                                >
                                    <RampHierarchy ramp={ramp} />
                                </button>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap theme-text-primary">{rampConfigLabel(ramp) || '–'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap theme-text-primary tabular-nums" title={ramp.client_counts.join(', ')}>
                                {ramp.client_counts.join(' → ') || '–'}
                            </td>
                            <td className="px-3 py-2 text-right theme-text-secondary tabular-nums">{ramp.steps}</td>
                            <td className="px-3 py-2 whitespace-nowrap theme-text-secondary">{formatRampDate(ramp.last_timestamp)}</td>
                            <td className="px-3 py-2 font-mono text-xs theme-text-tertiary" title={ramp.run_uuid ?? undefined}>
                                {ramp.run_uuid ? ramp.run_uuid.slice(0, 8) : '–'}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

export default RampList;

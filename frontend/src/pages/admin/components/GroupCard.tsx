// Collapsible card: host + UUID header, three stats, optional actions, expandable body
import type { ReactNode } from 'react';
import { CopyUUIDButton } from './CopyUUIDButton';
import { ExpandToggle } from './ExpandToggle';

export interface GroupStat {
    readonly label: string;
    readonly value: ReactNode;
}

interface GroupCardProps {
    readonly hostname: string;
    readonly uuidLabel?: string;
    readonly uuid?: string;
    readonly stats: readonly GroupStat[];
    readonly meta?: ReactNode;
    readonly actions?: ReactNode;
    readonly expanded: boolean;
    readonly onToggle: () => void;
    readonly children?: ReactNode;
}

const Stat: React.FC<GroupStat> = ({ label, value }) => (
    <div>
        <span className="theme-text-secondary">{label}:</span>
        <span className="ml-2 font-semibold theme-text-primary">{value}</span>
    </div>
);

export const GroupCard: React.FC<GroupCardProps> = ({ hostname, uuidLabel, uuid, stats, meta, actions, expanded, onToggle, children }) => (
    <div className="border theme-card rounded-lg mb-4">
        <div className="p-4 theme-bg-secondary border-b theme-border-primary rounded-t-lg">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="theme-text-secondary text-sm">Host:</span>
                            <h3 className="text-lg font-semibold theme-text-primary">{hostname}</h3>
                        </div>
                        {uuid && (
                            <div className="flex items-center gap-2">
                                <span className="theme-text-secondary text-sm">{uuidLabel}</span>
                                <span className="font-mono text-sm theme-text-secondary">{uuid}</span>
                                <CopyUUIDButton uuid={uuid} />
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        {stats.map((stat) => (
                            <Stat key={stat.label} label={stat.label} value={stat.value} />
                        ))}
                    </div>
                    {meta}
                </div>
                <div className="flex items-center gap-2 ml-4">
                    {actions}
                    <ExpandToggle expanded={expanded} onToggle={onToggle} label={`group ${hostname}`} />
                </div>
            </div>
        </div>
        {expanded && <div className="overflow-x-auto">{children}</div>}
    </div>
);

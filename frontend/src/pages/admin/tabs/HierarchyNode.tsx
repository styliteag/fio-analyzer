// One level of the Host → Protocol → Drive Type → Drive Model tree (recursive)
import { Edit2, Server } from 'lucide-react';
import Button from '../../../components/ui/Button';
import type { TestRun } from '../../../types';
import { ExpandToggle } from '../components/ExpandToggle';
import { TestRunsTable } from '../components/TestRunsTable';
import type { KeyedExpansion } from '../hooks/useKeyedExpansion';
import { averageIops, flattenRuns, plural } from '../utils';

export type HierarchyTree = TestRun[] | { [key: string]: HierarchyTree };

interface LevelStyle {
    readonly name: string;
    readonly rowClass: string;
    readonly titleClass: string;
    readonly statsClass: string;
    readonly label: (key: string, runs: readonly TestRun[]) => string;
}

const LEVELS: readonly LevelStyle[] = [
    {
        name: 'Host',
        rowClass: 'p-4 theme-bg-secondary border-b theme-border-primary rounded-t-lg',
        titleClass: 'text-lg font-semibold theme-text-primary',
        statsClass: 'text-sm theme-text-secondary',
        label: (key) => key,
    },
    {
        name: 'Host-Protocol',
        rowClass: 'p-3 theme-bg-secondary pl-12',
        titleClass: 'text-md font-medium theme-text-primary',
        statsClass: 'text-xs theme-text-secondary',
        label: (_key, runs) => `Protocol: ${runs[0]?.protocol || 'unknown'}`,
    },
    {
        name: 'Host-Protocol-Type',
        rowClass: 'p-3 theme-bg-secondary pl-20',
        titleClass: 'text-sm font-medium theme-text-primary',
        statsClass: 'text-xs theme-text-secondary',
        label: (_key, runs) => `Drive Type: ${runs[0]?.drive_type || 'unknown'}`,
    },
    {
        name: 'Host-Protocol-Type-Model',
        rowClass: 'p-3 theme-bg-secondary pl-28',
        titleClass: 'text-sm font-medium theme-text-primary',
        statsClass: 'text-xs theme-text-secondary',
        label: (_key, runs) => `Drive Model: ${runs[0]?.drive_model || 'unknown'}`,
    },
];

interface HierarchyNodeProps {
    readonly level: number;
    readonly nodeKey: string;
    readonly node: HierarchyTree;
    readonly expansion: KeyedExpansion;
    readonly onEdit: (testRunIds: number[], level: string) => void;
    readonly onSelectRun: (id: number) => void;
}

const NodeChildren: React.FC<HierarchyNodeProps> = ({ level, node, expansion, onEdit, onSelectRun }) =>
    Array.isArray(node) ? (
        <div className="overflow-x-auto bg-white dark:bg-gray-800">
            <TestRunsTable runs={node} onSelect={onSelectRun} />
        </div>
    ) : (
        <div>
            {Object.entries(node).map(([childKey, child]) => (
                <div key={childKey} className="border-t theme-border-primary">
                    <HierarchyNode
                        level={level + 1}
                        nodeKey={childKey}
                        node={child}
                        expansion={expansion}
                        onEdit={onEdit}
                        onSelectRun={onSelectRun}
                    />
                </div>
            ))}
        </div>
    );

export const HierarchyNode: React.FC<HierarchyNodeProps> = (props) => {
    const { level, nodeKey, node, expansion, onEdit } = props;
    const style = LEVELS[level];
    const runs = flattenRuns(node);
    const label = style.label(nodeKey, runs);
    const expandKey = `${level}:${nodeKey}`;
    const expanded = expansion.isExpanded(expandKey);
    const TitleTag = (['h3', 'h4', 'h5', 'h6'] as const)[level];

    return (
        <>
            <div className={style.rowClass}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <ExpandToggle expanded={expanded} onToggle={() => expansion.toggle(expandKey)} label={label} small={level > 0} className="p-1" />
                        {level === 0 && <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
                        <div>
                            <TitleTag className={style.titleClass}>{label}</TitleTag>
                            <div className={style.statsClass}>
                                {runs.length} test run{plural(runs.length)} • Avg IOPS: {Math.round(averageIops(runs)).toLocaleString()}
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onEdit(runs.map((run) => run.id), `${style.name}: ${nodeKey}`)}>
                        <Edit2 className="w-4 h-4" />
                        Edit All
                    </Button>
                </div>
            </div>
            {expanded && <NodeChildren {...props} />}
        </>
    );
};

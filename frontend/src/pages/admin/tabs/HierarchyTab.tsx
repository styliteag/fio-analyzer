// "By Hierarchy" tab: all test runs as Host → Protocol → Drive Type → Drive Model tree
import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import Loading from '../../../components/ui/Loading';
import ErrorDisplay from '../../../components/ui/ErrorDisplay';
import { EmptyMessage, SectionHeader } from '../components/SectionHeader';
import type { HierarchyRunsResult } from '../hooks/useHierarchyRuns';
import type { KeyedExpansion } from '../hooks/useKeyedExpansion';
import type { LatestRunsResult } from '../hooks/useAdminData';
import { buildHierarchy, filterBySearch, matchesRun, plural } from '../utils';
import { HierarchyNode } from './HierarchyNode';

interface HierarchyTabProps {
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
    readonly hierarchy: HierarchyRunsResult;
    readonly latest: LatestRunsResult;
    readonly searchTerm: string;
    readonly expansion: KeyedExpansion;
    readonly onEdit: (testRunIds: number[], level: string) => void;
    readonly onSelectRun: (id: number) => void;
}

const HierarchyCount: React.FC<{ readonly hosts: number; readonly fetched: number }> = ({ hosts, fetched }) => (
    <span>
        {hosts} host{plural(hosts)}
        {fetched > 0 && (
            <span className="ml-2">
                • {fetched.toLocaleString()} test run{plural(fetched)} loaded
            </span>
        )}
    </span>
);

export const HierarchyTab: React.FC<HierarchyTabProps> = (props) => {
    const { title, description, icon, hierarchy, latest, searchTerm } = props;
    const tree = useMemo(() => buildHierarchy(filterBySearch(hierarchy.runs, searchTerm, matchesRun)), [hierarchy.runs, searchTerm]);
    const hostnames = Object.keys(tree);

    const body = () => {
        if (hierarchy.loading || latest.loading) {
            const message = hierarchy.loading
                ? `Loading all test runs... (${hierarchy.totalFetched.toLocaleString()} fetched)`
                : 'Loading hierarchical data...';
            return (
                <div>
                    <Loading message={message} />
                    {hierarchy.hasMore && (
                        <div className="mt-2 text-sm theme-text-secondary text-center">
                            Fetching more data... This may take a moment for large datasets.
                        </div>
                    )}
                </div>
            );
        }
        if (hierarchy.error || latest.error) {
            return <ErrorDisplay error={hierarchy.error || latest.error || 'Unknown error'} />;
        }
        if (hostnames.length === 0) {
            return <EmptyMessage>{searchTerm ? `No test runs found matching "${searchTerm}"` : 'No test runs found'}</EmptyMessage>;
        }
        return (
            <div className="space-y-4">
                {hostnames.map((hostname) => (
                    <div key={hostname} className="border theme-card rounded-lg">
                        <HierarchyNode
                            level={0}
                            nodeKey={hostname}
                            node={tree[hostname]}
                            expansion={props.expansion}
                            onEdit={props.onEdit}
                            onSelectRun={props.onSelectRun}
                        />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div>
            <SectionHeader
                icon={icon}
                title={title}
                description={description}
                aside={<HierarchyCount hosts={hostnames.length} fetched={hierarchy.totalFetched} />}
            />
            {body()}
        </div>
    );
};

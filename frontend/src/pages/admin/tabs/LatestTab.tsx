// "Latest Runs" tab: newest result per configuration, grouped by run_uuid
import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import Loading from '../../../components/ui/Loading';
import ErrorDisplay from '../../../components/ui/ErrorDisplay';
import { GroupCard } from '../components/GroupCard';
import { EmptyMessage, SectionHeader } from '../components/SectionHeader';
import { TestRunsTable } from '../components/TestRunsTable';
import type { LatestRunsResult } from '../hooks/useAdminData';
import type { GroupExpansion } from '../hooks/useGroupExpansion';
import { filterBySearch, groupLatestRuns, matchesRun, plural } from '../utils';

interface LatestTabProps {
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
    readonly latest: LatestRunsResult;
    readonly searchTerm: string;
    readonly expansion: GroupExpansion;
    readonly onSelectRun: (id: number) => void;
}

export const LatestTab: React.FC<LatestTabProps> = ({ title, description, icon, latest, searchTerm, expansion, onSelectRun }) => {
    const groups = useMemo(() => groupLatestRuns(filterBySearch(latest.runs, searchTerm, matchesRun)), [latest.runs, searchTerm]);
    const totalRuns = useMemo(() => new Set(latest.runs.map((r) => r.run_uuid)).size, [latest.runs]);

    const count = `${groups.length} ${searchTerm ? `/ ${totalRuns} ` : ''}run${plural(groups.length)}`;

    const body = () => {
        if (latest.loading) return <Loading message="Loading latest runs..." />;
        if (latest.error) return <ErrorDisplay error={latest.error} />;
        if (groups.length === 0) {
            return <EmptyMessage>{searchTerm ? `No test runs found matching "${searchTerm}"` : 'No test runs found'}</EmptyMessage>;
        }
        return groups.map((group) => (
            <GroupCard
                key={group.uuid}
                hostname={group.hostname}
                uuidLabel="Run UUID:"
                uuid={group.uuid !== 'no-uuid' ? group.uuid : undefined}
                stats={[
                    { label: 'Tests', value: group.count },
                    { label: 'Avg IOPS', value: Math.round(group.avgIops).toLocaleString() },
                    { label: 'Latest', value: new Date(group.latestTimestamp).toLocaleDateString() },
                ]}
                expanded={expansion.expanded.has(group.uuid)}
                onToggle={() => expansion.toggle(group.uuid)}
            >
                <TestRunsTable runs={group.runs} onSelect={onSelectRun} />
            </GroupCard>
        ));
    };

    return (
        <div>
            <SectionHeader icon={icon} title={title} description={description} aside={count} />
            {body()}
        </div>
    );
};

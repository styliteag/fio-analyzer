// "By Host Config" and "By Script Run" tabs: test runs grouped by config_uuid / run_uuid
import { useMemo } from 'react';
import { Edit2, Trash2, type LucideIcon } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Loading from '../../../components/ui/Loading';
import ErrorDisplay from '../../../components/ui/ErrorDisplay';
import type { UseUUIDGroupedRunsReturn } from '../../../hooks/api/useUUIDGroupedRuns';
import type { UUIDGroup } from '../../../types';
import { GroupCard } from '../components/GroupCard';
import { EmptyMessage, SectionHeader } from '../components/SectionHeader';
import { TestRunsTable } from '../components/TestRunsTable';
import type { GroupExpansion } from '../hooks/useGroupExpansion';
import type { UUIDEdits } from '../hooks/useUUIDEdits';
import type { UUIDType } from '../types';
import { filterBySearch, formatDateRange, matchesGroup, plural } from '../utils';

interface UUIDGroupsTabProps {
    readonly uuidType: UUIDType;
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
    readonly groupsResult: UseUUIDGroupedRunsReturn;
    readonly searchTerm: string;
    readonly expansion: GroupExpansion;
    readonly edits: UUIDEdits;
    readonly onSelectRun: (id: number) => void;
}

interface UUIDGroupCardProps extends Pick<UUIDGroupsTabProps, 'uuidType' | 'expansion' | 'edits' | 'onSelectRun'> {
    readonly group: UUIDGroup;
}

const GroupMeta: React.FC<{ readonly group: UUIDGroup }> = ({ group }) => {
    const { protocol, drive_type: driveType, drive_model: driveModel } = group.sample_metadata;
    return (
        <div className="mt-2 text-sm theme-text-secondary">
            {protocol && <span className="mr-3">Protocol: {protocol}</span>}
            {driveType && <span className="mr-3">Type: {driveType}</span>}
            {driveModel && <span>Model: {driveModel}</span>}
        </div>
    );
};

const GroupRuns: React.FC<{ readonly uuid: string; readonly expansion: GroupExpansion; readonly onSelectRun: (id: number) => void }> = ({
    uuid,
    expansion,
    onSelectRun,
}) => {
    if (expansion.loadingByUuid.get(uuid)) {
        return (
            <div className="p-8 text-center">
                <Loading message="Loading test runs..." />
            </div>
        );
    }
    const runs = expansion.runsByUuid.get(uuid);
    if (!runs) {
        return <div className="p-4 text-center theme-text-secondary">No test runs available</div>;
    }
    return <TestRunsTable runs={runs} onSelect={onSelectRun} />;
};

const UUIDGroupCard: React.FC<UUIDGroupCardProps> = ({ group, uuidType, expansion, edits, onSelectRun }) => (
    <GroupCard
        hostname={group.sample_metadata.hostname || 'N/A'}
        uuidLabel={uuidType === 'config_uuid' ? 'Config UUID:' : 'Run UUID:'}
        uuid={group.uuid}
        stats={[
            { label: 'Tests', value: group.count },
            { label: 'Avg IOPS', value: group.avg_iops ? Math.round(group.avg_iops).toLocaleString() : 'N/A' },
            { label: 'Date Range', value: formatDateRange(group.first_test, group.last_test) },
        ]}
        meta={<GroupMeta group={group} />}
        actions={
            <>
                <Button variant="outline" size="sm" onClick={() => edits.openEdit(group.uuid, uuidType, group.count, group.test_run_ids)}>
                    <Edit2 className="w-4 h-4" />
                    Edit All
                </Button>
                <Button variant="danger" size="sm" onClick={() => edits.openDelete(group.uuid, uuidType, group.count)}>
                    <Trash2 className="w-4 h-4" />
                    Delete
                </Button>
            </>
        }
        expanded={expansion.expanded.has(group.uuid)}
        onToggle={() => expansion.toggle(group.uuid, group.test_run_ids)}
    >
        <GroupRuns uuid={group.uuid} expansion={expansion} onSelectRun={onSelectRun} />
    </GroupCard>
);

export const UUIDGroupsTab: React.FC<UUIDGroupsTabProps> = (props) => {
    const { uuidType, title, description, icon, groupsResult, searchTerm } = props;
    const allGroups = useMemo(() => (Array.isArray(groupsResult.data) ? groupsResult.data : []), [groupsResult.data]);
    const groups = useMemo(() => filterBySearch(allGroups, searchTerm, matchesGroup), [allGroups, searchTerm]);

    if (groupsResult.loading) {
        return <Loading message={`Loading ${title.toLowerCase()}...`} />;
    }
    if (groupsResult.error) {
        return <ErrorDisplay error={groupsResult.error} />;
    }

    const count = `${groups.length} ${searchTerm ? `/ ${allGroups.length} ` : ''}group${plural(groups.length)}`;
    const emptyText = searchTerm
        ? `No test runs found matching "${searchTerm}"`
        : `No test runs found with ${uuidType === 'config_uuid' ? 'configuration' : 'run'} UUIDs`;

    return (
        <div>
            <SectionHeader icon={icon} title={title} description={description} aside={count} />
            {groups.length === 0 ? (
                <EmptyMessage>{emptyText}</EmptyMessage>
            ) : (
                groups.map((group) => (
                    <UUIDGroupCard
                        key={group.uuid}
                        group={group}
                        uuidType={uuidType}
                        expansion={props.expansion}
                        edits={props.edits}
                        onSelectRun={props.onSelectRun}
                    />
                ))
            )}
        </div>
    );
};

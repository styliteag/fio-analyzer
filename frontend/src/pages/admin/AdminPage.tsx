// Admin page: tabs + search; data, edits and modals live in hooks/, tabs/, modals/
import { useCallback } from 'react';
import { PageHeader, PAGE_CONTAINER } from '../../components/layout';
import { useUrlValue } from '../../hooks/useUrlState';
import { AdminModals } from './AdminModals';
import { AdminSearch } from './components/AdminSearch';
import { TabButton } from './components/TabButton';
import { useAdminData, type AdminData } from './hooks/useAdminData';
import { useCleanup } from './hooks/useCleanup';
import { useGroupExpansion } from './hooks/useGroupExpansion';
import { useHierarchyEdit } from './hooks/useHierarchyEdit';
import { useKeyedExpansion } from './hooks/useKeyedExpansion';
import { useSaturationEdits } from './hooks/useSaturationEdits';
import { useTestRunDetails } from './hooks/useTestRunDetails';
import { useUUIDEdits } from './hooks/useUUIDEdits';
import { TAB_META, TABS } from './tabConfig';
import { HierarchyTab } from './tabs/HierarchyTab';
import { HistoryTab } from './tabs/HistoryTab';
import { LatestTab } from './tabs/LatestTab';
import { SaturationTab } from './tabs/SaturationTab';
import { UUIDGroupsTab } from './tabs/UUIDGroupsTab';
import { DEFAULT_TAB, TAB_IDS, type AdminTab } from './types';

const useAdminState = (activeTab: AdminTab, searchTerm: string, data: AdminData) => {
    const { hierarchy, history, saturation } = data;
    const groups = useGroupExpansion();
    const hierarchyExpansion = useKeyedExpansion();
    const details = useTestRunDetails();
    const uuidEdits = useUUIDEdits({ configGroups: data.configGroups, runGroups: data.runGroups, groups });

    const reloadHierarchy = useCallback(() => {
        if (activeTab === 'hierarchy') hierarchy.reload();
    }, [activeTab, hierarchy]);
    const reloadHistory = useCallback(() => {
        if (activeTab === 'history') history.reload();
    }, [activeTab, history]);

    const hierarchyEdit = useHierarchyEdit(reloadHierarchy);
    const saturationEdits = useSaturationEdits(saturation.reload);
    const cleanup = useCleanup(searchTerm, reloadHistory);

    return { groups, hierarchyExpansion, details, uuidEdits, hierarchyEdit, saturationEdits, cleanup };
};

type AdminState = ReturnType<typeof useAdminState>;

const ActiveTab: React.FC<{ tab: AdminTab; searchTerm: string; data: AdminData; state: AdminState }> = ({ tab, searchTerm, data, state }) => {
    const meta = TAB_META[tab];
    const common = { title: meta.title, description: meta.description, icon: meta.icon, searchTerm };
    const selectRun = state.details.open;

    switch (tab) {
        case 'latest':
            return <LatestTab {...common} latest={data.latest} expansion={state.groups} onSelectRun={selectRun} />;
        case 'by-config':
        case 'by-run':
            return (
                <UUIDGroupsTab
                    {...common}
                    uuidType={tab === 'by-config' ? 'config_uuid' : 'run_uuid'}
                    groupsResult={tab === 'by-config' ? data.configGroups : data.runGroups}
                    expansion={state.groups}
                    edits={state.uuidEdits}
                    onSelectRun={selectRun}
                />
            );
        case 'history':
            return <HistoryTab {...common} history={data.history} onCleanup={state.cleanup.open} />;
        case 'hierarchy':
            return (
                <HierarchyTab
                    {...common}
                    hierarchy={data.hierarchy}
                    latest={data.latest}
                    expansion={state.hierarchyExpansion}
                    onEdit={state.hierarchyEdit.openEdit}
                    onSelectRun={selectRun}
                />
            );
        case 'saturation':
            return <SaturationTab {...common} saturation={data.saturation} edits={state.saturationEdits} />;
    }
};

const AdminPage: React.FC = () => {
    const [activeTab, setActiveTab] = useUrlValue<AdminTab>('tab', DEFAULT_TAB, TAB_IDS);
    const [searchTerm, setSearchTerm] = useUrlValue<string>('q', '');
    const data = useAdminData(activeTab);
    const state = useAdminState(activeTab, searchTerm, data);

    return (
        <div className={PAGE_CONTAINER}>
            <PageHeader
                title="Admin Panel"
                description="Edit, regroup and clean up stored test runs. Changes here affect every dashboard."
            />
            <AdminSearch value={searchTerm} onChange={setSearchTerm} />
            <div role="tablist" aria-label="Admin sections" className="flex gap-1 mb-8 border-b theme-border-primary overflow-x-auto">
                {TABS.map((tab) => (
                    <TabButton
                        key={tab.id}
                        id={tab.id}
                        label={tab.label}
                        icon={tab.icon}
                        selected={activeTab === tab.id}
                        onSelect={() => setActiveTab(tab.id)}
                    />
                ))}
            </div>
            <div role="tabpanel" id="admin-tabpanel" aria-labelledby={`admin-tab-${activeTab}`}>
                <ActiveTab tab={activeTab} searchTerm={searchTerm} data={data} state={state} />
            </div>
            <AdminModals
                uuidEdits={state.uuidEdits}
                hierarchyEdit={state.hierarchyEdit}
                saturationEdits={state.saturationEdits}
                cleanup={state.cleanup}
                details={state.details}
            />
        </div>
    );
};

export default AdminPage;

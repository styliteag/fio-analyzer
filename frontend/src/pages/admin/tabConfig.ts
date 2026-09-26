// Tab labels, icons and one-line explanations for the Admin page
import { Activity, Database, History, Network, PlayCircle, Server, type LucideIcon } from 'lucide-react';
import { TAB_IDS, type AdminTab } from './types';

export interface TabMeta {
    readonly id: AdminTab;
    readonly label: string;
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
}

export const TAB_META: Record<AdminTab, TabMeta> = {
    latest: {
        id: 'latest',
        label: 'Latest Runs',
        title: 'Latest Test Runs (Grouped by Run)',
        description:
            'Newest result per host/drive/test configuration (test_runs table), grouped by the script run (run_uuid) that produced it.',
        icon: Database,
    },
    'by-config': {
        id: 'by-config',
        label: 'By Host Config',
        title: 'By Host Configuration',
        description:
            'Latest test runs grouped by config_uuid (one per host configuration from fio-test.sh); runs without a config_uuid are not listed.',
        icon: Server,
    },
    'by-run': {
        id: 'by-run',
        label: 'By Script Run',
        title: 'By Script Run',
        description: 'Latest test runs grouped by run_uuid (one group per fio-test.sh execution); edit or delete a whole run at once.',
        icon: PlayCircle,
    },
    history: {
        id: 'history',
        label: 'History',
        title: 'Historical Test Runs',
        description:
            'Every stored test run including superseded results (test_runs_all). Delete or compact old data; the search term limits cleanup to that host.',
        icon: History,
    },
    hierarchy: {
        id: 'hierarchy',
        label: 'By Hierarchy',
        title: 'Hierarchical View',
        description: 'All latest test runs as a Host → Protocol → Drive Type → Drive Model tree; "Edit All" updates every run below that level.',
        icon: Network,
    },
    saturation: {
        id: 'saturation',
        label: 'Saturation',
        title: 'Saturation Runs',
        description: 'Saturation tests (queue depth escalated step by step per run_uuid); edit metadata or delete all steps of a run.',
        icon: Activity,
    },
};

export const TABS: readonly TabMeta[] = TAB_IDS.map((id) => TAB_META[id]);

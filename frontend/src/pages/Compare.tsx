import { Gauge, ListChecks, type LucideIcon } from 'lucide-react';
import { PageHeader, PAGE_CONTAINER } from '../components/layout';
import { useUrlValue } from '../hooks/useUrlState';
import TestRunsCompare from '../components/compare/TestRunsCompare';
import SaturationCompare from '../components/compare/SaturationCompare';

type CompareTab = 'runs' | 'saturation';

const TABS: readonly { readonly id: CompareTab; readonly label: string; readonly icon: LucideIcon }[] = [
    { id: 'runs', label: 'Test runs', icon: ListChecks },
    { id: 'saturation', label: 'Saturation', icon: Gauge },
];
const TAB_IDS = TABS.map((tab) => tab.id);

const ACTIVE = 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400';
const INACTIVE = 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600';

export default function Compare() {
    const [tab, setTab] = useUrlValue<CompareTab>('tab', 'runs', TAB_IDS);

    return (
        <div className={PAGE_CONTAINER}>
            <PageHeader
                title="Compare Storage"
                description="Put storage combinations side by side, e.g. Ceph vs ZFS: the difference to a baseline per pattern and block size, or saturation points of several runs."
            />
            <div role="tablist" aria-label="Comparison type" className="flex gap-1 mb-6 border-b theme-border-primary overflow-x-auto">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`compare-tab-${id}`}
                        aria-selected={tab === id}
                        aria-controls="compare-tabpanel"
                        onClick={() => setTab(id)}
                        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${tab === id ? ACTIVE : INACTIVE}`}
                    >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        {label}
                    </button>
                ))}
            </div>
            <div role="tabpanel" id="compare-tabpanel" aria-labelledby={`compare-tab-${tab}`}>
                {tab === 'runs' ? <TestRunsCompare /> : <SaturationCompare />}
            </div>
        </div>
    );
}

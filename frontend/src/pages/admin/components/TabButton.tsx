import type { LucideIcon } from 'lucide-react';

interface TabButtonProps {
    readonly id: string;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly selected: boolean;
    readonly onSelect: () => void;
}

const ACTIVE = 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400';
const INACTIVE = 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600';

export const TabButton: React.FC<TabButtonProps> = ({ id, label, icon: Icon, selected, onSelect }) => (
    <button
        type="button"
        role="tab"
        id={`admin-tab-${id}`}
        aria-selected={selected}
        aria-controls="admin-tabpanel"
        onClick={onSelect}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${selected ? ACTIVE : INACTIVE}`}
    >
        <Icon className="w-4 h-4" aria-hidden="true" />
        {label}
    </button>
);

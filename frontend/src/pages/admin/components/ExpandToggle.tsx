import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandToggleProps {
    readonly expanded: boolean;
    readonly onToggle: () => void;
    readonly label: string;
    readonly small?: boolean;
    readonly className?: string;
}

export const ExpandToggle: React.FC<ExpandToggleProps> = ({ expanded, onToggle, label, small = false, className = 'p-2' }) => {
    const Icon = expanded ? ChevronUp : ChevronDown;
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            className={`${className} hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors`}
        >
            <Icon className={`${small ? 'w-4 h-4' : 'w-5 h-5'} theme-text-primary`} />
        </button>
    );
};

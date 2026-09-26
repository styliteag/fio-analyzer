import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
    readonly icon?: LucideIcon;
    readonly title: string;
    readonly description: string;
    readonly aside?: ReactNode;
}

/** Tab heading: icon + title, one-line explanation, and counts/actions on the right. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, title, description, aside }) => (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <div className="flex items-center gap-2">
                {Icon && <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
                <h2 className="text-2xl font-bold theme-text-primary">{title}</h2>
            </div>
            <p className="mt-1 text-sm theme-text-secondary">{description}</p>
        </div>
        {aside && <div className="text-sm theme-text-secondary flex items-center gap-2 flex-shrink-0">{aside}</div>}
    </div>
);

export const EmptyMessage: React.FC<{ readonly children: ReactNode }> = ({ children }) => (
    <div className="text-center py-12 theme-text-secondary">{children}</div>
);

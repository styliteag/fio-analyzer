// Consistent page title block with optional actions on the right
import type { ReactNode } from 'react';

interface PageHeaderProps {
    readonly title: string;
    readonly description?: ReactNode;
    readonly actions?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold theme-text-primary">{title}</h1>
            {description && <p className="mt-1 theme-text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
);

export const PAGE_CONTAINER = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8';

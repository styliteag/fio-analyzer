// Shared page frame: header, routed page content, footer
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { DashboardFooter } from './DashboardFooter';

export const AppShell: React.FC = () => (
    <div className="min-h-screen flex flex-col theme-bg-secondary transition-colors">
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded theme-card"
        >
            Skip to content
        </a>
        <AppHeader />
        <main id="main-content" className="flex-1">
            <Outlet />
        </main>
        <DashboardFooter />
    </div>
);

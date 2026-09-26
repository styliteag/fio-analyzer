// Navigation entries shared by the desktop and mobile menus
import {
    Gauge,
    History,
    LayoutDashboard,
    type LucideIcon,
    Server,
    Settings,
    Upload,
    Users,
} from 'lucide-react';

export type NavRole = 'admin' | 'uploader';

export interface NavItem {
    readonly to: string;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly description: string;
    readonly roles: readonly NavRole[];
}

export const NAV_ITEMS: readonly NavItem[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview of all benchmark data', roles: ['admin'] },
    { to: '/host', label: 'Hosts', icon: Server, description: 'Compare hosts and drives', roles: ['admin'] },
    { to: '/history', label: 'History', icon: History, description: 'Metrics over time', roles: ['admin'] },
    { to: '/saturation', label: 'Saturation', icon: Gauge, description: 'Queue depth saturation tests', roles: ['admin'] },
    { to: '/upload', label: 'Upload', icon: Upload, description: 'Import FIO JSON results', roles: ['admin', 'uploader'] },
    { to: '/admin', label: 'Admin', icon: Settings, description: 'Manage test runs', roles: ['admin'] },
    { to: '/users', label: 'Users', icon: Users, description: 'Manage user accounts', roles: ['admin'] },
];

export const navItemsForRole = (role: NavRole | null): readonly NavItem[] =>
    role ? NAV_ITEMS.filter((item) => item.roles.includes(role)) : [];

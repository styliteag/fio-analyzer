// Application header: primary navigation, theme toggle and user controls
import { useEffect, useState } from 'react';
import { Activity, LogOut, Menu, User, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle';
import { navItemsForRole, type NavItem } from './navItems';

const linkClass = ({ isActive }: { isActive: boolean }): string =>
    [
        'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive ? 'theme-nav-link-active' : 'theme-nav-link',
    ].join(' ');

const NavLinks: React.FC<{ items: readonly NavItem[]; vertical?: boolean }> = ({ items, vertical = false }) => (
    <ul className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
        {items.map(({ to, label, icon: Icon, description }) => (
            <li key={to}>
                <NavLink to={to} end={to === '/'} className={linkClass} title={description}>
                    {/* Icons only from 2xl on (and in the mobile menu), so all entries fit next to the user controls */}
                    <Icon className={vertical ? 'h-4 w-4 shrink-0' : 'hidden 2xl:block h-4 w-4 shrink-0'} aria-hidden="true" />
                    <span>{label}</span>
                </NavLink>
            </li>
        ))}
    </ul>
);

const UserControls: React.FC<{ username: string | null; role: string | null; onLogout: () => void }> = ({
    username,
    role,
    onLogout,
}) => (
    <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm theme-text-secondary" title={role ? `Role: ${role}` : undefined}>
            <User className="h-4 w-4" aria-hidden="true" />
            {username}
        </span>
        <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 px-2 py-2 rounded-md text-sm theme-nav-link"
            aria-label="Log out"
            title="Log out"
        >
            <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
    </div>
);

export const AppHeader: React.FC = () => {
    const { username, userRole, logout } = useAuth();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const items = navItemsForRole(userRole);
    const homePath = items[0]?.to ?? '/';

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    return (
        <header className="theme-header shadow-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-4">
                    <Link to={homePath} className="flex items-center gap-2 shrink-0" aria-label="FIO Analyzer home">
                        <Activity className="h-7 w-7 theme-text-accent" aria-hidden="true" />
                        <span className="text-lg font-bold theme-text-primary whitespace-nowrap">FIO Analyzer</span>
                    </Link>

                    <nav className="hidden xl:block" aria-label="Main">
                        <NavLinks items={items} />
                    </nav>

                    <div className="hidden xl:flex items-center gap-3 shrink-0">
                        <ThemeToggle />
                        <UserControls username={username} role={userRole} onLogout={logout} />
                    </div>

                    <button
                        type="button"
                        className="xl:hidden inline-flex items-center justify-center p-2 rounded-md theme-nav-link"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-expanded={menuOpen}
                        aria-controls="mobile-menu"
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    >
                        {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div id="mobile-menu" className="xl:hidden border-t theme-border-primary px-4 py-3 space-y-3">
                    <nav aria-label="Main">
                        <NavLinks items={items} vertical />
                    </nav>
                    <div className="flex items-center justify-between border-t theme-border-primary pt-3">
                        <ThemeToggle />
                        <UserControls username={username} role={userRole} onLogout={logout} />
                    </div>
                </div>
            )}
        </header>
    );
};

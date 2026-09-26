// Tested host/protocol/drive combinations with deep links into the analysis pages
import { Link } from 'react-router-dom';
import { History, Server } from 'lucide-react';
import type { ServerInfo } from '../../types';

interface HostsTableProps {
    readonly servers: readonly ServerInfo[];
    readonly loading: boolean;
}

const formatDate = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '–' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const hostLink = (hostname: string): string => `/host?${new URLSearchParams({ hosts: hostname })}`;
const historyLink = (server: ServerInfo): string =>
    `/history?${new URLSearchParams({ server: `${server.hostname}|${server.protocol}|${server.drive_model}` })}`;

const HostsTable: React.FC<HostsTableProps> = ({ servers, loading }) => {
    const sorted = [...servers].sort((a, b) => b.last_test_time.localeCompare(a.last_test_time));

    if (loading) {
        return <div className="h-40 animate-pulse rounded theme-bg-tertiary" />;
    }
    if (sorted.length === 0) {
        return <p className="py-6 text-center theme-text-secondary">No hosts tested yet.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="text-left theme-text-secondary border-b theme-border-primary">
                        <th scope="col" className="py-2 pr-4 font-medium">Host</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Protocol</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Drive</th>
                        <th scope="col" className="py-2 pr-4 font-medium text-right">Tests</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Last test</th>
                        <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((server) => (
                        <tr
                            key={`${server.hostname}|${server.protocol}|${server.drive_model}`}
                            className="border-b last:border-0 theme-border-primary"
                        >
                            <td className="py-2 pr-4 font-medium theme-text-primary">{server.hostname}</td>
                            <td className="py-2 pr-4 theme-text-secondary">{server.protocol}</td>
                            <td className="py-2 pr-4 theme-text-secondary">{server.drive_model}</td>
                            <td className="py-2 pr-4 text-right theme-text-secondary">{server.test_count}</td>
                            <td className="py-2 pr-4 theme-text-secondary whitespace-nowrap">{formatDate(server.last_test_time)}</td>
                            <td className="py-2">
                                <div className="flex justify-end gap-1">
                                    <Link to={hostLink(server.hostname)} className="inline-flex items-center gap-1 px-2 py-1 rounded theme-nav-link" title={`Analyze ${server.hostname}`} aria-label={`Analyze ${server.hostname}`}>
                                        <Server className="h-4 w-4" aria-hidden="true" />
                                        <span className="hidden md:inline">Analyze</span>
                                    </Link>
                                    <Link to={historyLink(server)} className="inline-flex items-center gap-1 px-2 py-1 rounded theme-nav-link" title="Show history" aria-label={`History for ${server.hostname} ${server.protocol} ${server.drive_model}`}>
                                        <History className="h-4 w-4" aria-hidden="true" />
                                        <span className="hidden md:inline">History</span>
                                    </Link>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default HostsTable;

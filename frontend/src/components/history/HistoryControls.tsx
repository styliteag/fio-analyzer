// Sidebar controls for the History page
import Select from 'react-select';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui';
import { getSelectStyles } from '../../hooks/useThemeColors';
import type { ServerInfo } from '../../types';
import { formatConfigKey, HISTORY_DAY_OPTIONS, HISTORY_METRICS } from './historyChart';
import MetricHelp from '../shared/MetricHelp';

/** Sentinel URL value for "all hosts"; an absent param means "default to the busiest host" */
export const ALL_SERVERS = 'all';

export const serverId = (server: ServerInfo): string => `${server.hostname}|${server.protocol}|${server.drive_model}`;

interface HistoryControlsProps {
    readonly servers: readonly ServerInfo[];
    readonly serverValue: string;
    readonly onServerChange: (value: string) => void;
    readonly configOptions: readonly string[];
    readonly selectedConfigs: readonly string[];
    readonly onConfigsChange: (values: readonly string[]) => void;
    readonly metrics: readonly string[];
    readonly onMetricsChange: (values: readonly string[]) => void;
    readonly days: number;
    readonly onDaysChange: (days: number) => void;
    readonly loading: boolean;
    readonly onRefresh: () => void;
}

const selectClass = 'w-full px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary';

const HistoryControls: React.FC<HistoryControlsProps> = ({
    servers,
    serverValue,
    onServerChange,
    configOptions,
    selectedConfigs,
    onConfigsChange,
    metrics,
    onMetricsChange,
    days,
    onDaysChange,
    loading,
    onRefresh,
}) => {
    const toggleMetric = (metric: string) =>
        onMetricsChange(metrics.includes(metric) ? metrics.filter((item) => item !== metric) : [...metrics, metric]);

    return (
        <div className="space-y-5">
            <div>
                <label htmlFor="history-server" className="block text-sm font-medium theme-text-primary mb-1">
                    Host · protocol · drive
                </label>
                <select id="history-server" value={serverValue} onChange={(e) => onServerChange(e.target.value)} className={selectClass}>
                    <option value={ALL_SERVERS}>All hosts (many lines)</option>
                    {servers.map((server) => (
                        <option key={serverId(server)} value={serverId(server)}>
                            {server.hostname} · {server.protocol} · {server.drive_model} ({server.test_count})
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="history-days" className="block text-sm font-medium theme-text-primary mb-1">
                    Time range
                </label>
                <select id="history-days" value={days} onChange={(e) => onDaysChange(Number(e.target.value))} className={selectClass}>
                    {HISTORY_DAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <fieldset>
                <legend className="block text-sm font-medium theme-text-primary mb-1">Metrics</legend>
                <div className="space-y-1">
                    {HISTORY_METRICS.map((metric) => (
                        <label key={metric.value} className="flex items-center gap-2 text-sm theme-text-secondary cursor-pointer">
                            <input
                                type="checkbox"
                                checked={metrics.includes(metric.value)}
                                onChange={() => toggleMetric(metric.value)}
                                className="rounded"
                            />
                            {metric.label}
                            <span className="text-xs theme-text-tertiary">({metric.unit})</span>
                            <MetricHelp metric={metric.value} />
                        </label>
                    ))}
                </div>
            </fieldset>

            <div>
                <label htmlFor="history-configs" className="block text-sm font-medium theme-text-primary mb-1">
                    Test configurations
                </label>
                <Select
                    inputId="history-configs"
                    isMulti
                    closeMenuOnSelect={false}
                    options={configOptions.map((key) => ({ value: key, label: formatConfigKey(key) }))}
                    value={selectedConfigs.map((key) => ({ value: key, label: formatConfigKey(key) }))}
                    onChange={(selected) => onConfigsChange(selected.map((item) => item.value))}
                    placeholder={configOptions.length ? 'All configurations' : 'No data loaded'}
                    isDisabled={configOptions.length === 0}
                    className="text-sm"
                    styles={getSelectStyles()}
                />
                <p className="mt-1 text-xs theme-text-tertiary">Pattern · block size · queue depth. Empty = show all.</p>
            </div>

            <Button onClick={onRefresh} disabled={loading} variant="outline" fullWidth>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                {loading ? 'Loading…' : 'Reload data'}
            </Button>
        </div>
    );
};

export default HistoryControls;

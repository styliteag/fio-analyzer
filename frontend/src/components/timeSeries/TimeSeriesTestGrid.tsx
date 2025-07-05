import React from 'react';
import { HardDrive, Activity, Clock, Database } from 'lucide-react';
import type { TimeSeriesDataPoint } from '../../types';

interface TimeSeriesTestGridProps {
    data: { [serverId: string]: TimeSeriesDataPoint[] };
    serverGroups: Array<{
        id: string;
        hostname: string;
        protocol: string;
        driveModels: string[];
    }>;
    loading?: boolean;
}

const TimeSeriesTestGrid: React.FC<TimeSeriesTestGridProps> = ({
    data,
    serverGroups,
    loading = false,
}) => {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="theme-card p-4 animate-pulse">
                        <div className="h-4 theme-bg-secondary rounded mb-3"></div>
                        <div className="space-y-2">
                            <div className="h-3 theme-bg-secondary rounded w-3/4"></div>
                            <div className="h-3 theme-bg-secondary rounded w-1/2"></div>
                            <div className="h-3 theme-bg-secondary rounded w-2/3"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const selectedServers = serverGroups.filter(group => data[group.id]?.length > 0);

    if (selectedServers.length === 0) {
        return (
            <div className="text-center py-8 theme-text-secondary">
                <Database className="h-12 w-12 mx-auto mb-4 theme-text-tertiary" />
                <p>No time-series data available</p>
                <p className="text-sm">Select servers and time range to view data</p>
            </div>
        );
    }

    const getLatestDataForServer = (serverId: string) => {
        const serverData = data[serverId] || [];
        if (serverData.length === 0) return null;

        // Group by metric type and get latest value for each
        const latestByMetric: { [metricType: string]: TimeSeriesDataPoint } = {};
        
        serverData.forEach(point => {
            const existing = latestByMetric[point.metric_type];
            if (!existing || new Date(point.timestamp) > new Date(existing.timestamp)) {
                latestByMetric[point.metric_type] = point;
            }
        });

        return latestByMetric;
    };

    const formatValue = (value: number, unit: string) => {
        if (unit === 'ms') {
            return `${value.toFixed(2)} ms`;
        } else if (unit === 'MB/s') {
            return `${value.toFixed(1)} MB/s`;
        } else if (unit === 'IOPS') {
            return `${Math.round(value).toLocaleString()} IOPS`;
        }
        return `${value} ${unit}`;
    };

    const getMetricIcon = (metricType: string) => {
        switch (metricType) {
            case 'iops':
                return <Activity className="h-4 w-4" />;
            case 'avg_latency':
            case 'p95_latency':
            case 'p99_latency':
                return <Clock className="h-4 w-4" />;
            case 'bandwidth':
                return <Database className="h-4 w-4" />;
            default:
                return <Activity className="h-4 w-4" />;
        }
    };

    const getMetricColor = (metricType: string) => {
        switch (metricType) {
            case 'iops':
                return 'text-blue-600 dark:text-blue-400';
            case 'avg_latency':
            case 'p95_latency':
            case 'p99_latency':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'bandwidth':
                return 'text-green-600 dark:text-green-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <HardDrive className="h-5 w-5 theme-text-secondary" />
                <h3 className="text-lg font-medium theme-text-primary">
                    Active Servers ({selectedServers.length})
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedServers.map((server) => {
                    const latestMetrics = getLatestDataForServer(server.id);
                    const dataPoints = data[server.id] || [];
                    const totalDataPoints = dataPoints.length;
                    const timeRange = dataPoints.length > 0 ? {
                        start: new Date(Math.min(...dataPoints.map(p => new Date(p.timestamp).getTime()))),
                        end: new Date(Math.max(...dataPoints.map(p => new Date(p.timestamp).getTime())))
                    } : null;

                    return (
                        <div key={server.id} className="theme-card p-4 border theme-border-primary">
                            {/* Server Header */}
                            <div className="mb-3">
                                <h4 className="font-medium theme-text-primary text-lg">
                                    {server.hostname}
                                </h4>
                                <div className="text-sm theme-text-secondary">
                                    {server.protocol} • {server.driveModels.join(', ')}
                                </div>
                                <div className="text-xs theme-text-tertiary">
                                    {totalDataPoints} data points
                                    {timeRange && (
                                        <span className="ml-2">
                                            ({timeRange.start.toLocaleDateString()} - {timeRange.end.toLocaleDateString()})
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Latest Metrics */}
                            {latestMetrics && (
                                <div className="space-y-2">
                                    {Object.entries(latestMetrics)
                                        .sort(([a], [b]) => {
                                            const order = ['iops', 'avg_latency', 'bandwidth', 'p95_latency', 'p99_latency'];
                                            return order.indexOf(a) - order.indexOf(b);
                                        })
                                        .map(([metricType, point]) => (
                                            <div key={metricType} className="flex items-center justify-between py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={getMetricColor(metricType)}>
                                                        {getMetricIcon(metricType)}
                                                    </span>
                                                    <span className="text-sm theme-text-secondary capitalize">
                                                        {metricType.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-medium theme-text-primary">
                                                    {formatValue(point.value, point.unit)}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}

                            {/* Test Configuration Summary */}
                            {dataPoints.length > 0 && (
                                <div className="mt-3 pt-3 border-t theme-border-secondary">
                                    <div className="text-xs theme-text-tertiary">
                                        <div className="grid grid-cols-2 gap-1">
                                            <div>
                                                Block sizes: {[...new Set(dataPoints.map(p => p.block_size))].join(', ')}
                                            </div>
                                            <div>
                                                Patterns: {[...new Set(dataPoints.map(p => p.read_write_pattern))].join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TimeSeriesTestGrid;
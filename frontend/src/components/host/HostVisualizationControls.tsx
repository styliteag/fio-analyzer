import React from 'react';
import { HardDrive, BarChart, Radar, TrendingUp, Activity, Box, Zap, Grid3X3, BarChart3, Table2, LineChart, type LucideIcon } from 'lucide-react';

export type VisualizationView = 'overview' | 'heatmap' | 'charts' | 'graphs' | 'radar' | 'scatter' | 'parallel' | 'boxplot' | 'facets' | 'stacked' | 'advancedHeatmap' | 'trends' | 'matrix' | '3d';

interface ViewOption {
    readonly id: VisualizationView;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly description: string;
}

interface ViewGroup {
    readonly label: string;
    readonly views: readonly ViewOption[];
}

export const VIEW_GROUPS: readonly ViewGroup[] = [
    {
        label: 'Summary',
        views: [
            { id: 'overview', label: 'Overview', icon: HardDrive, description: 'Per-drive cards with max IOPS, min latency, max bandwidth and the top test configurations.' },
            { id: 'heatmap', label: 'Fingerprint Heatmap', icon: Grid3X3, description: 'Rows per host/protocol/drive/pattern, columns per block size or queue depth; each cell shows normalized IOPS, bandwidth, responsiveness and latency. Good first look.' },
            { id: 'matrix', label: 'Matrix', icon: Grid3X3, description: 'Color-coded table of one metric; you pick the row and column dimensions (block size, queue depth, pattern, protocol, drive type).' },
            { id: 'advancedHeatmap', label: 'Host Heatmap', icon: Table2, description: 'Heatmap of configurations grouped by host and drive for a chosen metric.' },
        ],
    },
    {
        label: 'Compare',
        views: [
            { id: 'charts', label: 'Bar Charts', icon: BarChart, description: 'Grouped or stacked bars of IOPS, bandwidth, responsiveness and latency per configuration, sortable.' },
            { id: 'graphs', label: 'Graphs', icon: BarChart3, description: 'Tabs for IOPS comparison, latency analysis, bandwidth trends and responsiveness.' },
            { id: 'radar', label: 'Radar', icon: Radar, description: 'Seven normalized axes per drive (peak/avg IOPS, low/avg latency, peak/avg bandwidth, consistency). Larger area = better overall.' },
            { id: 'stacked', label: 'Stacked Bar', icon: BarChart, description: 'Bars of IOPS, bandwidth or latency, individual or stacked by pattern, queue depth, protocol, block size or drive type. Click a drive to drill down.' },
            { id: 'boxplot', label: 'Boxplot', icon: Box, description: 'Distribution (quartiles, whiskers, individual points) of IOPS, latency or bandwidth per block size.' },
        ],
    },
    {
        label: 'Relationships',
        views: [
            { id: 'scatter', label: 'IOPS vs Latency', icon: TrendingUp, description: 'Each point is one test: latency on X, IOPS on Y. Top-left (high IOPS, low latency) is best.' },
            { id: 'facets', label: 'Facet Grid', icon: Zap, description: 'Grid of IOPS-vs-latency scatter plots, split by pattern, host or drive model.' },
            { id: 'parallel', label: 'Parallel Coordinates', icon: Activity, description: 'Each line is one test across block size, queue depth, latency, IOPS and bandwidth. Useful to spot trade-offs.' },
            { id: '3d', label: '3D', icon: Box, description: '3D bars: latency on X, IOPS as height, bandwidth on Z. Drag to rotate.' },
        ],
    },
    {
        label: 'Trends',
        views: [
            { id: 'trends', label: 'Trend Analysis', icon: LineChart, description: 'Line charts showing how a metric scales with block size and queue depth, grouped by host or pattern.' },
        ],
    },
];

export const VIEW_IDS: readonly VisualizationView[] = VIEW_GROUPS.flatMap((group) => group.views.map((view) => view.id));

export interface HostVisualizationControlsProps {
    activeView: VisualizationView;
    onViewChange: (view: VisualizationView) => void;
}

const HostVisualizationControls: React.FC<HostVisualizationControlsProps> = ({ activeView, onViewChange }) => {
    const active = VIEW_GROUPS.flatMap((group) => group.views).find((view) => view.id === activeView);

    return (
        <div className="mb-6 theme-card rounded-lg border p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-3" role="tablist" aria-label="Visualization">
                {VIEW_GROUPS.map((group) => (
                    <div key={group.label} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide theme-text-tertiary">{group.label}</span>
                        <div className="flex flex-wrap gap-1">
                            {group.views.map(({ id, label, icon: Icon, description }) => {
                                const selected = id === activeView;
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        title={description}
                                        onClick={() => onViewChange(id)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                                            selected ? 'theme-btn-primary border-transparent' : 'theme-nav-link theme-border-primary'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" aria-hidden="true" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {active && <p className="mt-3 text-sm theme-text-secondary">{active.description}</p>}
        </div>
    );
};

export default HostVisualizationControls;

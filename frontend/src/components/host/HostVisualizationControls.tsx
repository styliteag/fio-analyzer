import React from 'react';
import { HardDrive, BarChart, Radar, TrendingUp, Activity, Box, Zap, Grid3X3, BarChart3, Table2, LineChart } from 'lucide-react';
import { Button } from '../ui';

export type VisualizationView = 'overview' | 'heatmap' | 'graphs' | 'radar' | 'scatter' | 'parallel' | 'boxplot' | 'facets' | 'stacked' | 'advancedHeatmap' | 'trends' | 'matrix' | '3d';

export interface HostVisualizationControlsProps {
    activeView: VisualizationView;
    onViewChange: (view: VisualizationView) => void;
}

const HostVisualizationControls: React.FC<HostVisualizationControlsProps> = ({
    activeView,
    onViewChange
}) => {
    return (
        <div className="mb-8">
            {/* View Selection */}
            <div className="flex flex-wrap gap-2 mb-4">
                <Button
                    variant={activeView === 'overview' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('overview')}
                    className="flex items-center gap-2"
                >
                    <HardDrive className="w-4 h-4" />
                    Overview
                </Button>
                <Button
                    variant={activeView === 'heatmap' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('heatmap')}
                    className="flex items-center gap-2"
                >
                    <Grid3X3 className="w-4 h-4" />
                    Performance Heatmap
                </Button>
                <Button
                    variant={activeView === 'graphs' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('graphs')}
                    className="flex items-center gap-2"
                >
                    <BarChart3 className="w-4 h-4" />
                    Performance Graphs
                </Button>
                <Button
                    variant={activeView === 'radar' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('radar')}
                    className="flex items-center gap-2"
                >
                    <Radar className="w-4 h-4" />
                    Radar Comparison
                </Button>
                <Button
                    variant={activeView === 'scatter' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('scatter')}
                    className="flex items-center gap-2"
                >
                    <TrendingUp className="w-4 h-4" />
                    IOPS vs Latency
                </Button>
                <Button
                    variant={activeView === 'parallel' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('parallel')}
                    className="flex items-center gap-2"
                >
                    <Activity className="w-4 h-4" />
                    Parallel Coordinates
                </Button>
                <Button
                    variant={activeView === 'boxplot' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('boxplot')}
                    className="flex items-center gap-2"
                >
                    <Box className="w-4 h-4" />
                    Boxplot by Block Size
                </Button>
                <Button
                    variant={activeView === 'facets' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('facets')}
                    className="flex items-center gap-2"
                >
                    <Zap className="w-4 h-4" />
                    Facet Scatter Grids
                </Button>
                <Button
                    variant={activeView === 'stacked' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('stacked')}
                    className="flex items-center gap-2"
                >
                    <BarChart className="w-4 h-4" />
                    Stacked Bar
                </Button>
                <Button
                    variant={activeView === 'advancedHeatmap' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('advancedHeatmap')}
                    className="flex items-center gap-2"
                >
                    <Table2 className="w-4 h-4" />
                    Host Heatmap
                </Button>
                <Button
                    variant={activeView === 'trends' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('trends')}
                    className="flex items-center gap-2"
                >
                    <LineChart className="w-4 h-4" />
                    Trend Analysis
                </Button>
                <Button
                    variant={activeView === 'matrix' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('matrix')}
                    className="flex items-center gap-2"
                >
                    <Grid3X3 className="w-4 h-4" />
                    Performance Matrix
                </Button>
                <Button
                    variant={activeView === '3d' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('3d')}
                    className="flex items-center gap-2"
                >
                    <Box className="w-4 h-4" />
                    3D Performance
                </Button>
            </div>

        </div>
    );
};

export default HostVisualizationControls;
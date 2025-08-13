import React from 'react';
import { HardDrive, BarChart3, BarChart, Radar, TrendingUp, Activity, Box, Zap } from 'lucide-react';
import { Button } from '../ui';

export type VisualizationView = 'overview' | 'matrix' | 'radar' | 'scatter' | 'parallel' | 'boxplot' | 'facets' | 'stacked' | '3d';
export type MatrixMetric = 'iops' | 'avg_latency' | 'bandwidth';

export interface HostVisualizationControlsProps {
    activeView: VisualizationView;
    matrixMetric: MatrixMetric;
    onViewChange: (view: VisualizationView) => void;
    onMatrixMetricChange: (metric: MatrixMetric) => void;
}

const HostVisualizationControls: React.FC<HostVisualizationControlsProps> = ({
    activeView,
    matrixMetric,
    onViewChange,
    onMatrixMetricChange
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
                    variant={activeView === 'matrix' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('matrix')}
                    className="flex items-center gap-2"
                >
                    <BarChart3 className="w-4 h-4" />
                    Performance Matrix
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
                    variant={activeView === '3d' ? 'primary' : 'outline'}
                    onClick={() => onViewChange('3d')}
                    className="flex items-center gap-2"
                >
                    <Box className="w-4 h-4" />
                    3D Performance
                </Button>
            </div>

            {/* Matrix Metric Selection */}
            {activeView === 'matrix' && (
                <div className="flex gap-2 mb-4">
                    <span className="text-sm theme-text-secondary self-center">Metric:</span>
                    <Button
                        variant={matrixMetric === 'iops' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => onMatrixMetricChange('iops')}
                    >
                        IOPS
                    </Button>
                    <Button
                        variant={matrixMetric === 'avg_latency' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => onMatrixMetricChange('avg_latency')}
                    >
                        Latency
                    </Button>
                    <Button
                        variant={matrixMetric === 'bandwidth' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => onMatrixMetricChange('bandwidth')}
                    >
                        Bandwidth
                    </Button>
                </div>
            )}
        </div>
    );
};

export default HostVisualizationControls;
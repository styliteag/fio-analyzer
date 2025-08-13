import React, { memo, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useThemeColors } from '../../hooks/useThemeColors';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface StackedBarChartProps {
    filteredDrives: DriveAnalysis[];
}

type MetricType = 'iops' | 'bandwidth' | 'latency_score';
type StackingOption = 'pattern' | 'queueDepth' | 'protocol' | 'blockSize' | 'driveType';

interface StackedDataPoint {
    driveModel: string;
    driveType: string;
    protocol: string;
    hostname: string;
    iops: number;
    latency: number;
    bandwidth: number;
    blockSize: string;
    readWritePattern: string;
    queueDepth: number;
    timestamp: string;
    testLabel: string; // Combined label for display
    groupKey?: string;
    groupedTests?: number;
    details?: string[];
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({ filteredDrives }) => {
    const themeColors = useThemeColors();
    
    // State for stacking option
    const [stackingOption, setStackingOption] = React.useState<StackingOption | 'individual'>('individual');
    
    // State for selected metric (only one metric at a time for true stacking)
    const [selectedMetric, setSelectedMetric] = React.useState<MetricType>('iops');
    
    // Color palette for stack segments
    const stackColors = useMemo(() => [
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(168, 85, 247, 0.8)',   // Purple
        'rgba(34, 197, 94, 0.8)',    // Green
        'rgba(249, 115, 22, 0.8)',   // Orange
        'rgba(239, 68, 68, 0.8)',    // Red
        'rgba(14, 165, 233, 0.8)',   // Sky
        'rgba(139, 69, 19, 0.8)',    // Brown
        'rgba(75, 85, 99, 0.8)',     // Gray
        'rgba(236, 72, 153, 0.8)',   // Pink
        'rgba(16, 185, 129, 0.8)',   // Emerald
    ], []);
    
    const stackBorderColors = useMemo(() => stackColors.map(color => color.replace('0.8', '1')), [stackColors]);

    const handleMetricChange = (metricId: MetricType) => {
        setSelectedMetric(metricId);
    };

    // Process data for stacked bar visualization
    const chartData = useMemo(() => {
        // Collect all individual data points
        const allDataPoints: StackedDataPoint[] = [];
        
        filteredDrives.forEach((drive) => {
            const validConfigs = drive.configurations.filter(c => 
                c.iops !== null && c.iops !== undefined &&
                c.avg_latency !== null && c.avg_latency !== undefined &&
                c.bandwidth !== null && c.bandwidth !== undefined
            );

            validConfigs.forEach((config) => {
                const testLabel = `${drive.drive_model} - ${config.block_size}/${config.read_write_pattern}/QD${config.queue_depth}`;
                
                allDataPoints.push({
                    driveModel: drive.drive_model,
                    driveType: drive.drive_type,
                    protocol: drive.protocol,
                    hostname: drive.hostname,
                    iops: config.iops || 0,
                    latency: config.avg_latency || 0,
                    bandwidth: config.bandwidth || 0,
                    blockSize: config.block_size,
                    readWritePattern: config.read_write_pattern,
                    queueDepth: config.queue_depth,
                    timestamp: config.timestamp,
                    testLabel
                });
            });
        });

        if (stackingOption === 'individual') {
            // Individual tests mode - no stacking
            const processedData = allDataPoints.sort((a, b) => {
                if (a.driveModel !== b.driveModel) {
                    return a.driveModel.localeCompare(b.driveModel);
                }
                return a.testLabel.localeCompare(b.testLabel);
            });

            const labels = processedData.map(d => {
                const configShort = `${d.blockSize}/${d.readWritePattern}/QD${d.queueDepth}`;
                return `${d.driveModel}\n${configShort}`;
            });

            let data: number[];
            let label: string;
            let color: string;

            switch (selectedMetric) {
                case 'iops':
                    data = processedData.map(d => d.iops);
                    label = 'IOPS';
                    color = stackColors[0];
                    break;
                case 'bandwidth':
                    data = processedData.map(d => d.bandwidth);
                    label = 'Bandwidth (MB/s)';
                    color = stackColors[1];
                    break;
                case 'latency_score':
                    data = processedData.map(d => 1000 / (d.latency || 1));
                    label = 'Performance Score (1000/latency)';
                    color = stackColors[2];
                    break;
                default:
                    data = [];
                    label = '';
                    color = stackColors[0];
            }

            return {
                labels,
                datasets: [{
                    label,
                    data,
                    backgroundColor: color,
                    borderColor: color.replace('0.8', '1'),
                    borderWidth: 1,
                    stack: 'main'
                }],
                rawData: processedData,
                stackSegments: []
            };
        }

        // True stacking mode - group by drive, stack by selected criteria
        const driveGroups = new Map<string, StackedDataPoint[]>();
        
        // Group data points by drive (key for each bar)
        allDataPoints.forEach(point => {
            const driveKey = `${point.driveModel} (${point.hostname})`;
            if (!driveGroups.has(driveKey)) {
                driveGroups.set(driveKey, []);
            }
            driveGroups.get(driveKey)!.push(point);
        });

        // Get all unique stacking segment values
        const stackSegments = new Set<string>();
        allDataPoints.forEach(point => {
            let segmentValue = '';
            switch (stackingOption) {
                case 'pattern':
                    segmentValue = point.readWritePattern;
                    break;
                case 'queueDepth':
                    segmentValue = `QD${point.queueDepth}`;
                    break;
                case 'protocol':
                    segmentValue = point.protocol;
                    break;
                case 'blockSize':
                    segmentValue = point.blockSize;
                    break;
                case 'driveType':
                    segmentValue = point.driveType;
                    break;
            }
            stackSegments.add(segmentValue);
        });

        const sortedSegments = Array.from(stackSegments).sort();
        const labels = Array.from(driveGroups.keys()).sort();

        // Create datasets - one for each stack segment
        const datasets = sortedSegments.map((segment, segmentIndex) => {
            const data = labels.map(driveKey => {
                const drivePoints = driveGroups.get(driveKey) || [];
                
                // Filter points that match this segment
                const segmentPoints = drivePoints.filter(point => {
                    let segmentValue = '';
                    switch (stackingOption) {
                        case 'pattern':
                            segmentValue = point.readWritePattern;
                            break;
                        case 'queueDepth':
                            segmentValue = `QD${point.queueDepth}`;
                            break;
                        case 'protocol':
                            segmentValue = point.protocol;
                            break;
                        case 'blockSize':
                            segmentValue = point.blockSize;
                            break;
                        case 'driveType':
                            segmentValue = point.driveType;
                            break;
                    }
                    return segmentValue === segment;
                });

                if (segmentPoints.length === 0) return 0;

                // Calculate metric value for this segment
                let value = 0;
                switch (selectedMetric) {
                    case 'iops':
                        value = segmentPoints.reduce((sum, p) => sum + p.iops, 0) / segmentPoints.length;
                        break;
                    case 'bandwidth':
                        value = segmentPoints.reduce((sum, p) => sum + p.bandwidth, 0) / segmentPoints.length;
                        break;
                    case 'latency_score': {
                        const avgLatency = segmentPoints.reduce((sum, p) => sum + p.latency, 0) / segmentPoints.length;
                        value = 1000 / (avgLatency || 1);
                        break;
                    }
                }
                return value;
            });

            const colorIndex = segmentIndex % stackColors.length;
            return {
                label: segment,
                data,
                backgroundColor: stackColors[colorIndex],
                borderColor: stackBorderColors[colorIndex],
                borderWidth: 1,
                stack: 'main' // All segments in the same stack
            };
        });

        // Create raw data for tooltips
        const rawData = labels.map(driveKey => {
            const drivePoints = driveGroups.get(driveKey) || [];
            const firstPoint = drivePoints[0];
            if (!firstPoint) return null;

            return {
                ...firstPoint,
                testLabel: driveKey,
                groupedTests: drivePoints.length,
                details: drivePoints.map(p => `${p.blockSize}/${p.readWritePattern}/QD${p.queueDepth}`)
            };
        }).filter(Boolean) as StackedDataPoint[];

        return {
            labels,
            datasets,
            rawData,
            stackSegments: sortedSegments
        };
    }, [filteredDrives, stackingOption, selectedMetric, stackColors, stackBorderColors]);

    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                stacked: stackingOption !== 'individual', // Enable stacking when not in individual mode
                title: {
                    display: true,
                    text: stackingOption === 'individual' 
                        ? 'Individual Test Configurations' 
                        : `Drives (Stacked by ${stackingOption.charAt(0).toUpperCase() + stackingOption.slice(1).replace(/([A-Z])/g, ' $1')})`,
                    color: themeColors.chart.text,
                    font: {
                        size: 14,
                        weight: 'bold' as const,
                    },
                },
                ticks: {
                    color: themeColors.chart.text,
                    maxRotation: 45,
                    minRotation: 0,
                },
                grid: {
                    color: themeColors.chart.grid,
                },
            },
            y: {
                type: 'linear' as const,
                stacked: stackingOption !== 'individual', // Enable stacking on Y-axis
                display: true,
                position: 'left' as const,
                title: {
                    display: true,
                    text: selectedMetric === 'iops' ? 'IOPS' : 
                          selectedMetric === 'bandwidth' ? 'Bandwidth (MB/s)' : 
                          'Performance Score (1000/latency)',
                    color: themeColors.chart.text,
                },
                ticks: {
                    color: themeColors.chart.text,
                },
                grid: {
                    color: themeColors.chart.grid,
                },
                beginAtZero: true,
            },
        },
        plugins: {
            title: {
                display: true,
                text: stackingOption === 'individual' 
                    ? `${selectedMetric.toUpperCase()} Performance by Individual Tests`
                    : `${selectedMetric.toUpperCase()} Performance by Drive (Stacked by ${stackingOption})`,
                color: themeColors.chart.text,
                font: {
                    size: 16,
                    weight: 'bold' as const,
                },
                padding: 20,
            },
            legend: {
                position: 'top' as const,
                labels: {
                    color: themeColors.chart.text,
                    usePointStyle: true,
                    padding: 20,
                },
            },
            tooltip: {
                mode: stackingOption === 'individual' ? ('index' as const) : ('point' as const),
                intersect: false,
                backgroundColor: themeColors.chart.tooltipBg,
                titleColor: themeColors.text.primary,
                bodyColor: themeColors.text.secondary,
                borderColor: themeColors.chart.tooltipBorder,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    title: (context: any) => {
                        const dataIndex = context[0].dataIndex;
                        const rawData = (chartData as any).rawData[dataIndex] as StackedDataPoint;
                        
                        if (stackingOption === 'individual') {
                            return `${rawData.driveModel} (${rawData.driveType})`;
                        } else {
                            return rawData.testLabel;
                        }
                    },
                    label: (context: any) => {
                        const datasetLabel = context.dataset.label;
                        const value = context.parsed.y;
                        const metricSuffix = selectedMetric === 'iops' ? '' : 
                                           selectedMetric === 'bandwidth' ? ' MB/s' : '';
                        
                        if (stackingOption === 'individual') {
                            return `${datasetLabel}: ${value.toFixed(selectedMetric === 'iops' ? 0 : 1)}${metricSuffix}`;
                        } else {
                            return `${datasetLabel}: ${value.toFixed(selectedMetric === 'iops' ? 0 : 1)}${metricSuffix}`;
                        }
                    },
                    afterLabel: (context: any) => {
                        if (stackingOption !== 'individual') {
                            const dataIndex = context.dataIndex;
                            
                            // Calculate total for this drive to show percentage
                            const totalValue = context.chart.data.datasets.reduce((sum: number, dataset: any) => {
                                return sum + (dataset.data[dataIndex] || 0);
                            }, 0);
                            
                            const percentage = totalValue > 0 ? ((context.parsed.y / totalValue) * 100).toFixed(1) : '0';
                            return `(${percentage}% of total)`;
                        }
                        return '';
                    },
                    footer: (context: any) => {
                        const dataIndex = context[0].dataIndex;
                        const rawData = (chartData as any).rawData[dataIndex] as StackedDataPoint;
                        
                        if (stackingOption === 'individual') {
                            return [
                                '',
                                `Host: ${rawData.hostname}`,
                                `Test Config: ${rawData.blockSize} | ${rawData.readWritePattern} | QD${rawData.queueDepth}`,
                                `Test Date: ${new Date(rawData.timestamp).toLocaleDateString()}`
                            ];
                        } else {
                            const footer = [
                                '',
                                `Drive: ${rawData.driveModel}`,
                                `Host: ${rawData.hostname}`,
                                `Number of test configs: ${rawData.groupedTests || 0}`
                            ];
                            
                            if (rawData.details && rawData.details.length > 0) {
                                footer.push('', 'Test configurations:');
                                rawData.details.slice(0, 3).forEach(detail => {
                                    footer.push(`  • ${detail}`);
                                });
                                if (rawData.details.length > 3) {
                                    footer.push(`  ... and ${rawData.details.length - 3} more`);
                                }
                            }
                            
                            return footer;
                        }
                    }
                },
            },
        },
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        animation: {
            duration: 1000,
            easing: 'easeOutQuart' as const,
        },
    }), [themeColors, chartData, stackingOption, selectedMetric]);

    // Performance summary statistics
    const summaryStats = useMemo(() => {
        const rawData = (chartData as any).rawData as StackedDataPoint[];
        if (rawData.length === 0) return null;

        const totalIOPS = rawData.reduce((sum, d) => sum + d.iops, 0);
        const avgLatency = rawData.reduce((sum, d) => sum + d.latency, 0) / rawData.length;
        const totalBandwidth = rawData.reduce((sum, d) => sum + d.bandwidth, 0);
        const totalTests = rawData.length; // Each data point is now an individual test

        // Get unique drive models
        const uniqueDrives = new Set(rawData.map(d => d.driveModel));

        const bestPerformer = rawData.reduce((best, current) => {
            const currentScore = current.iops / (current.latency || 1);
            const bestScore = best.iops / (best.latency || 1);
            return currentScore > bestScore ? current : best;
        });

        return {
            totalIOPS,
            avgLatency,
            totalBandwidth,
            totalTests,
            bestPerformer,
            driveCount: uniqueDrives.size,
            testCount: rawData.length
        };
    }, [chartData]);

    if (filteredDrives.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <p className="theme-text-secondary text-lg">No data available for stacked bar chart</p>
                <p className="theme-text-secondary text-sm mt-2">Try adjusting your filters to include more data</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6">

                {/* Stacking Controls */}
                <div className="mb-4">
                    <h5 className="text-sm font-medium theme-text-primary mb-2">Stack Data By:</h5>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setStackingOption('individual')}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                stackingOption === 'individual'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600'
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                            } hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                        >
                            Individual Tests
                        </button>
                        <button
                            onClick={() => setStackingOption('pattern')}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                stackingOption === 'pattern'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600'
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                            } hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                        >
                            By Pattern
                        </button>
                        <button
                            onClick={() => setStackingOption('queueDepth')}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                stackingOption === 'queueDepth'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600'
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                            } hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                        >
                            By Queue Depth
                        </button>
                        <button
                            onClick={() => setStackingOption('protocol')}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                stackingOption === 'protocol'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600'
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                            } hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                        >
                            By Protocol
                        </button>
                        <button
                            onClick={() => setStackingOption('blockSize')}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                stackingOption === 'blockSize'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600'
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                            } hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                        >
                            By Block Size
                        </button>
                        <button
                            onClick={() => setStackingOption('driveType')}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                stackingOption === 'driveType'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600'
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                            } hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                        >
                            By Drive Type
                        </button>
                    </div>
                </div>

                {/* Metric Selection Controls */}
                <div className="mb-4">
                    <h5 className="text-sm font-medium theme-text-primary mb-2">Select Metric to Display:</h5>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => handleMetricChange('iops')}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm
                                ${selectedMetric === 'iops'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600' 
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                                }
                                hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-400
                            `}
                        >
                            <div 
                                className="w-4 h-4 rounded border-2" 
                                style={{ 
                                    backgroundColor: selectedMetric === 'iops' ? stackColors[0] : 'transparent',
                                    borderColor: stackBorderColors[0]
                                }}
                            />
                            <span>IOPS</span>
                            {selectedMetric === 'iops' && <span className="text-xs text-blue-600 dark:text-blue-400">✓</span>}
                        </button>
                        <button
                            onClick={() => handleMetricChange('bandwidth')}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm
                                ${selectedMetric === 'bandwidth'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600' 
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                                }
                                hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-400
                            `}
                        >
                            <div 
                                className="w-4 h-4 rounded border-2" 
                                style={{ 
                                    backgroundColor: selectedMetric === 'bandwidth' ? stackColors[1] : 'transparent',
                                    borderColor: stackBorderColors[1]
                                }}
                            />
                            <span>Bandwidth (MB/s)</span>
                            {selectedMetric === 'bandwidth' && <span className="text-xs text-blue-600 dark:text-blue-400">✓</span>}
                        </button>
                        <button
                            onClick={() => handleMetricChange('latency_score')}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm
                                ${selectedMetric === 'latency_score'
                                    ? 'bg-blue-50 border-blue-300 theme-text-primary dark:bg-blue-900/20 dark:border-blue-600' 
                                    : 'bg-gray-50 border-gray-300 theme-text-secondary dark:bg-gray-800 dark:border-gray-600'
                                }
                                hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-400
                            `}
                        >
                            <div 
                                className="w-4 h-4 rounded border-2" 
                                style={{ 
                                    backgroundColor: selectedMetric === 'latency_score' ? stackColors[2] : 'transparent',
                                    borderColor: stackBorderColors[2]
                                }}
                            />
                            <span>Performance Score (1000/latency)</span>
                            {selectedMetric === 'latency_score' && <span className="text-xs text-blue-600 dark:text-blue-400">✓</span>}
                        </button>
                    </div>
                </div>
                
                {/* Summary Statistics */}
                {summaryStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-center">
                            <p className="text-xs theme-text-secondary">Drives</p>
                            <p className="text-sm font-bold theme-text-primary">{summaryStats.driveCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs theme-text-secondary">Total IOPS</p>
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{summaryStats.totalIOPS.toFixed(0)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs theme-text-secondary">Avg Latency</p>
                            <p className="text-sm font-bold text-green-600 dark:text-green-400">{summaryStats.avgLatency.toFixed(2)}ms</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs theme-text-secondary">Total Bandwidth</p>
                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{summaryStats.totalBandwidth.toFixed(1)} MB/s</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs theme-text-secondary">Individual Tests</p>
                            <p className="text-sm font-bold theme-text-primary">{summaryStats.totalTests}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs theme-text-secondary">Best Test Config</p>
                            <p className="text-xs font-bold text-orange-600 dark:text-orange-400 truncate" title={summaryStats.bestPerformer.testLabel}>
                                {summaryStats.bestPerformer.testLabel.split(' - ')[1] || summaryStats.bestPerformer.driveModel}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="h-[600px] relative">
                <Bar data={chartData} options={options} />
            </div>

            {/* Legend and Notes */}
            <div className="mt-4 space-y-2">
                {stackingOption !== 'individual' && (chartData as any).stackSegments?.length > 0 && (
                    <div className="mb-4">
                        <h6 className="text-sm font-medium theme-text-primary mb-2">
                            Stack Segments ({stackingOption}):
                        </h6>
                        <div className="flex flex-wrap gap-3">
                            {(chartData as any).stackSegments.map((segment: string, index: number) => (
                                <div key={segment} className="flex items-center gap-2 text-xs">
                                    <div 
                                        className="w-4 h-4 rounded border"
                                        style={{ 
                                            backgroundColor: stackColors[index % stackColors.length],
                                            borderColor: stackBorderColors[index % stackBorderColors.length]
                                        }}
                                    ></div>
                                    <span className="theme-text-secondary">{segment}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="space-y-1 text-xs theme-text-secondary">
                    <p>
                        <strong>How it works:</strong> 
                        {stackingOption === 'individual' 
                            ? ` Each bar shows individual test configurations with ${selectedMetric === 'iops' ? 'IOPS' : selectedMetric === 'bandwidth' ? 'Bandwidth (MB/s)' : 'Performance Score'} values.`
                            : ` Each bar represents a drive, with segments showing ${selectedMetric === 'iops' ? 'IOPS' : selectedMetric === 'bandwidth' ? 'Bandwidth (MB/s)' : 'Performance Score'} broken down by ${stackingOption}.`
                        }
                    </p>
                    <p>
                        <strong>Metric:</strong> 
                        {selectedMetric === 'iops' && ' IOPS - Input/Output Operations Per Second'}
                        {selectedMetric === 'bandwidth' && ' Bandwidth - Data Transfer Rate (MB/s)'}
                        {selectedMetric === 'latency_score' && ' Performance Score - Responsiveness (1000/latency)'}
                    </p>
                    {stackingOption !== 'individual' && (
                        <p>
                            <strong>Stacking:</strong> Segments within each bar show average values for different {stackingOption} values. Hover over segments for detailed breakdowns and percentages.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Export memoized version for performance
export default memo(StackedBarChart, (prevProps, nextProps) => {
    // Check if filteredDrives array reference is the same
    if (prevProps.filteredDrives === nextProps.filteredDrives) {
        return true;
    }

    // Check if array contents are different
    if (prevProps.filteredDrives.length !== nextProps.filteredDrives.length) {
        return false;
    }

    // Shallow comparison of drive objects
    for (let i = 0; i < prevProps.filteredDrives.length; i++) {
        if (prevProps.filteredDrives[i] !== nextProps.filteredDrives[i]) {
            return false;
        }
    }

    return true;
});
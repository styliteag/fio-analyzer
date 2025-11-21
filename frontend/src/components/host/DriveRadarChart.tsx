import React from 'react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useThemeColors } from '../../hooks/useThemeColors';
import { createChartJsColors } from '../../utils/colorMapping';
import { formatLatencyMicroseconds } from '../../services/data/formatters';

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

interface DriveRadarChartProps {
    drives: DriveAnalysis[];
}

const DriveRadarChart: React.FC<DriveRadarChartProps> = ({ drives }) => {
    const themeColors = useThemeColors();

    // Calculate performance scores for each drive
    const driveScores = drives.map(drive => {
        const validConfigs = drive.configurations.filter(c => 
            c.iops !== null && c.avg_latency !== null && c.bandwidth !== null
        );

        if (validConfigs.length === 0) {
            return {
                drive_model: drive.drive_model,
                maxIOPS: 0,
                avgIOPS: 0,
                minLatency: 0,
                avgLatency: 0,
                maxBandwidth: 0,
                avgBandwidth: 0,
                consistency: 0
            };
        }

        const iopsValues = validConfigs.map(c => c.iops!);
        const latencyValues = validConfigs.map(c => c.avg_latency!);
        const bandwidthValues = validConfigs.map(c => c.bandwidth!);

        // Calculate consistency (lower coefficient of variation = higher consistency)
        const calculateCV = (values: number[]) => {
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            return mean > 0 ? stdDev / mean : 0;
        };

        const iopsCV = calculateCV(iopsValues);
        const latencyCV = calculateCV(latencyValues);
        const bandwidthCV = calculateCV(bandwidthValues);
        const overallConsistency = 1 - ((iopsCV + latencyCV + bandwidthCV) / 3);

        return {
            drive_model: drive.drive_model,
            maxIOPS: Math.max(...iopsValues),
            avgIOPS: iopsValues.reduce((sum, val) => sum + val, 0) / iopsValues.length,
            minLatency: Math.min(...latencyValues),
            avgLatency: latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length,
            maxBandwidth: Math.max(...bandwidthValues),
            avgBandwidth: bandwidthValues.reduce((sum, val) => sum + val, 0) / bandwidthValues.length,
            consistency: Math.max(0, Math.min(1, overallConsistency))
        };
    });

    // Fixed scales as per requirements
    const FIXED_MAX_IOPS = 100000; // 100k IOPS
    const FIXED_MAX_LATENCY_US = 100000; // 100ms = 100,000us
    
    // For bandwidth, we'll keep using the max from data or a reasonable default if 0
    const allMaxBandwidth = driveScores.map(d => d.maxBandwidth);
    const maxBandwidthOverall = Math.max(...allMaxBandwidth);

    const normalizedData = driveScores.map(drive => ({
        drive_model: drive.drive_model,
        // IOPS: 0 to 100k
        maxIOPS: Math.min(100, (drive.maxIOPS / FIXED_MAX_IOPS) * 100),
        avgIOPS: Math.min(100, (drive.avgIOPS / FIXED_MAX_IOPS) * 100),
        
        // Latency: 0 to 100ms. Lower is better, so we invert the score.
        // If latency > 100ms, score is 0. If latency is 0, score is 100.
        // Formula: 100 - (latency / max_latency * 100)
        latencyScore: Math.max(0, 100 - (drive.minLatency / FIXED_MAX_LATENCY_US) * 100),
        avgLatencyScore: Math.max(0, 100 - (drive.avgLatency / FIXED_MAX_LATENCY_US) * 100),
        
        // Bandwidth: Relative to max in dataset (unchanged logic, or could be fixed if requested)
        maxBandwidth: maxBandwidthOverall > 0 ? (drive.maxBandwidth / maxBandwidthOverall) * 100 : 0,
        avgBandwidth: maxBandwidthOverall > 0 ? (drive.avgBandwidth / maxBandwidthOverall) * 100 : 0,
        
        consistency: drive.consistency * 100
    }));

    const radarLabels = [
        'Peak IOPS',
        'Avg IOPS', 
        'Low Latency',
        'Avg Latency',
        'Peak Bandwidth',
        'Avg Bandwidth',
        'Consistency'
    ];

    // Generate unique colors based on hostname and drive model
    const chartColors = createChartJsColors(
        drives.map(drive => ({
            hostname: drive.hostname,
            driveModel: drive.drive_model,
            label: drive.drive_model
        }))
    );

    const datasets = normalizedData.map((drive, index) => {
        const colors = chartColors[index];
        return {
            label: drive.drive_model,
            data: [
                drive.maxIOPS,
                drive.avgIOPS,
                drive.latencyScore,
                drive.avgLatencyScore,
                drive.maxBandwidth,
                drive.avgBandwidth,
                drive.consistency
            ],
            backgroundColor: colors.backgroundColor,
            borderColor: colors.borderColor,
            borderWidth: 2,
            pointBackgroundColor: colors.pointBackgroundColor,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: colors.borderColor,
        };
    });

    const chartData = {
        labels: radarLabels,
        datasets
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: themeColors.chart.text,
                    usePointStyle: true,
                    padding: 20,
                },
            },
            tooltip: {
                backgroundColor: themeColors.chart.tooltipBg,
                titleColor: themeColors.text.primary,
                bodyColor: themeColors.text.secondary,
                borderColor: themeColors.chart.tooltipBorder,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    title: (context: any) => {
                        const driveLabel = context[0].dataset.label || '';
                        const metricLabel = context[0].label || '';
                        return `${driveLabel} - ${metricLabel}`;
                    },
                    label: (context: any) => {
                        const driveIndex = context.datasetIndex;
                        const drive = driveScores[driveIndex];
                        const metricIndex = context.dataIndex;
                        const normalizedScore = context.parsed.r.toFixed(1);
                        
                        const metricDetails = [
                            `Score: ${normalizedScore}%`,
                            '',
                            `Drive Type: ${drives[driveIndex].drive_type}`,
                            `Protocol: ${drives[driveIndex].protocol}`,
                            '',
                            `Raw Performance Data:`
                        ];
                        
                        switch (metricIndex) {
                            case 0: // Peak IOPS
                                metricDetails.push(`Peak IOPS: ${drive.maxIOPS.toFixed(0)}`);
                                break;
                            case 1: // Avg IOPS
                                metricDetails.push(`Average IOPS: ${drive.avgIOPS.toFixed(0)}`);
                                break;
                            case 2: // Low Latency
                                metricDetails.push(`Lowest Latency: ${formatLatencyMicroseconds(drive.minLatency).text}`);
                                break;
                            case 3: // Avg Latency
                                metricDetails.push(`Average Latency: ${formatLatencyMicroseconds(drive.avgLatency).text}`);
                                break;
                            case 4: // Peak Bandwidth
                                metricDetails.push(`Peak Bandwidth: ${drive.maxBandwidth.toFixed(1)} MB/s`);
                                break;
                            case 5: // Avg Bandwidth
                                metricDetails.push(`Average Bandwidth: ${drive.avgBandwidth.toFixed(1)} MB/s`);
                                break;
                            case 6: // Consistency
                                metricDetails.push(`Consistency Score: ${(drive.consistency * 100).toFixed(1)}%`);
                                metricDetails.push(`(Lower variation = higher consistency)`);
                                break;
                        }
                        
                        const validConfigs = drives[driveIndex].configurations.filter(c => 
                            c.iops !== null && c.avg_latency !== null && c.bandwidth !== null
                        );
                        metricDetails.push('');
                        metricDetails.push(`Test Configurations: ${validConfigs.length}`);
                        
                        return metricDetails;
                    }
                }
            },
        },
        scales: {
            r: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: themeColors.chart.text,
                    stepSize: 20,
                    callback: function(value: any) {
                        return value + '%';
                    }
                },
                grid: {
                    color: themeColors.chart.grid,
                },
                angleLines: {
                    color: themeColors.chart.grid,
                },
                pointLabels: {
                    color: themeColors.chart.text,
                    font: {
                        size: 12,
                    },
                }
            }
        },
        interaction: {
            intersect: false,
        },
        animation: {
            duration: 1000,
            easing: 'easeOutQuart' as const,
        },
    };

    return (
        <div className="w-full h-[500px]">
            <div className="mb-4">
                <h4 className="text-lg font-semibold theme-text-primary mb-2">
                    Drive Performance Comparison
                </h4>
                <p className="text-sm theme-text-secondary">
                    Multi-dimensional performance analysis (normalized to 0-100% scale)
                </p>
            </div>
            <div className="h-[400px]">
                <Radar data={chartData} options={options} />
            </div>
        </div>
    );
};

export default DriveRadarChart;
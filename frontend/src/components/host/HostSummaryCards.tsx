import React from 'react';
import { Server, HardDrive, Zap, Activity } from 'lucide-react';
import { Card } from '../ui';
import type { HostAnalysisData } from '../../services/api/hostAnalysis';

export interface HostSummaryCardsProps {
    hostData: HostAnalysisData;
    selectedHostsCount: number;
}

const HostSummaryCards: React.FC<HostSummaryCardsProps> = ({
    hostData,
    selectedHostsCount
}) => {
    return (
        <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Server className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <h1 className="text-3xl font-bold theme-text-primary">
                    {selectedHostsCount === 1 
                        ? hostData.hostname 
                        : selectedHostsCount > 1 
                        ? `${selectedHostsCount} Hosts` 
                        : 'Host Analysis'
                    }
                </h1>
            </div>
            <p className="theme-text-secondary text-lg mb-8">
                Performance Analysis Dashboard
            </p>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-text-secondary text-sm font-medium">Total Tests</p>
                            <p className="theme-text-primary text-2xl font-bold">
                                {hostData.totalTests.toLocaleString()}
                            </p>
                        </div>
                        <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400 opacity-80" />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-text-secondary text-sm font-medium">Storage Drives</p>
                            <p className="theme-text-primary text-2xl font-bold">
                                {hostData.drives.length}
                            </p>
                        </div>
                        <HardDrive className="w-8 h-8 text-green-600 dark:text-green-400 opacity-80" />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-text-secondary text-sm font-medium">Avg IOPS</p>
                            <p className="theme-text-primary text-2xl font-bold">
                                {hostData.performanceSummary.avgIOPS.toFixed(0)}
                            </p>
                        </div>
                        <Zap className="w-8 h-8 text-yellow-600 dark:text-yellow-400 opacity-80" />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-text-secondary text-sm font-medium">Avg Latency</p>
                            <p className="theme-text-primary text-2xl font-bold">
                                {hostData.performanceSummary.avgLatency.toFixed(2)}ms
                            </p>
                        </div>
                        <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400 opacity-80" />
                    </div>
                </Card>
            </div>
        </>
    );
};

export default HostSummaryCards;
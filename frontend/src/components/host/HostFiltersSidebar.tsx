import React from 'react';
import { Zap, Activity } from 'lucide-react';
import { Card } from '../ui';
import HostFilters from './HostFilters';
import type { HostAnalysisData } from '../../services/api/hostAnalysis';

export interface HostFiltersSidebarProps {
    hostData: HostAnalysisData;
    selectedBlockSizes: string[];
    selectedPatterns: string[];
    selectedQueueDepths: number[];
    selectedNumJobs: number[];
    selectedSyncs: number[];
    selectedDirects: number[];
    selectedIoDepths: number[];
    selectedTestSizes: string[];
    selectedDurations: number[];
    // Hierarchical filters
    selectedHosts: string[];
    selectedHostProtocols: string[];
    selectedHostProtocolTypes: string[];
    selectedHostProtocolTypeModels: string[];
    onBlockSizeChange: (sizes: string[]) => void;
    onPatternChange: (patterns: string[]) => void;
    onQueueDepthChange: (depths: number[]) => void;
    onNumJobsChange: (numJobs: number[]) => void;
    onSyncChange: (syncs: number[]) => void;
    onDirectChange: (directs: number[]) => void;
    onIoDepthChange: (ioDepths: number[]) => void;
    onTestSizeChange: (testSizes: string[]) => void;
    onDurationChange: (durations: number[]) => void;
    // Hierarchical filter handlers
    onHostChange: (hosts: string[]) => void;
    onHostProtocolChange: (combos: string[]) => void;
    onHostProtocolTypeChange: (combos: string[]) => void;
    onHostProtocolTypeModelChange: (combos: string[]) => void;
    onReset: () => void;
}

const HostFiltersSidebar: React.FC<HostFiltersSidebarProps> = ({
    hostData,
    selectedBlockSizes,
    selectedPatterns,
    selectedQueueDepths,
    selectedNumJobs,
    selectedSyncs,
    selectedDirects,
    selectedIoDepths,
    selectedTestSizes,
    selectedDurations,
    selectedHosts,
    selectedHostProtocols,
    selectedHostProtocolTypes,
    selectedHostProtocolTypeModels,
    onBlockSizeChange,
    onPatternChange,
    onQueueDepthChange,
    onNumJobsChange,
    onSyncChange,
    onDirectChange,
    onIoDepthChange,
    onTestSizeChange,
    onDurationChange,
    onHostChange,
    onHostProtocolChange,
    onHostProtocolTypeChange,
    onHostProtocolTypeModelChange,
    onReset
}) => {
    return (
        <div className="xl:col-span-1">
            {/* Filters */}
            <HostFilters
                testCoverage={hostData.testCoverage}
                combinedHostData={hostData}
                selectedBlockSizes={selectedBlockSizes}
                selectedPatterns={selectedPatterns}
                selectedQueueDepths={selectedQueueDepths}
                selectedNumJobs={selectedNumJobs}
                selectedSyncs={selectedSyncs}
                selectedDirects={selectedDirects}
                selectedIoDepths={selectedIoDepths}
                selectedTestSizes={selectedTestSizes}
                selectedDurations={selectedDurations}
                selectedHosts={selectedHosts}
                selectedHostProtocols={selectedHostProtocols}
                selectedHostProtocolTypes={selectedHostProtocolTypes}
                selectedHostProtocolTypeModels={selectedHostProtocolTypeModels}
                onBlockSizeChange={onBlockSizeChange}
                onPatternChange={onPatternChange}
                onQueueDepthChange={onQueueDepthChange}
                onNumJobsChange={onNumJobsChange}
                onSyncChange={onSyncChange}
                onDirectChange={onDirectChange}
                onIoDepthChange={onIoDepthChange}
                onTestSizeChange={onTestSizeChange}
                onDurationChange={onDurationChange}
                onHostChange={onHostChange}
                onHostProtocolChange={onHostProtocolChange}
                onHostProtocolTypeChange={onHostProtocolTypeChange}
                onHostProtocolTypeModelChange={onHostProtocolTypeModelChange}
                onReset={onReset}
            />

            {/* Best/Worst Drives Summary */}
            <div className="mt-6 space-y-4">
                <Card className="p-4">
                    <h4 className="text-sm font-semibold theme-text-primary mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-green-600" />
                        Best Drive
                    </h4>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                        <p className="font-bold text-green-700 dark:text-green-400 text-sm">
                            {hostData.performanceSummary.bestDrive}
                        </p>
                    </div>
                </Card>

                <Card className="p-4">
                    <h4 className="text-sm font-semibold theme-text-primary mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-orange-600" />
                        Needs Improvement
                    </h4>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                        <p className="font-bold text-orange-700 dark:text-orange-400 text-sm">
                            {hostData.performanceSummary.worstDrive}
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default HostFiltersSidebar;
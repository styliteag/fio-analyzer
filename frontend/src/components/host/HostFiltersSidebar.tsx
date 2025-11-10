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
    selectedProtocols: string[];
    selectedHostDiskCombinations: string[];
    selectedSyncs: number[];
    selectedDirects: number[];
    selectedIoDepths: number[];
    selectedTestSizes: string[];
    selectedDurations: number[];
    onBlockSizeChange: (sizes: string[]) => void;
    onPatternChange: (patterns: string[]) => void;
    onQueueDepthChange: (depths: number[]) => void;
    onNumJobsChange: (numJobs: number[]) => void;
    onProtocolChange: (protocols: string[]) => void;
    onHostDiskCombinationChange: (combinations: string[]) => void;
    onSyncChange: (syncs: number[]) => void;
    onDirectChange: (directs: number[]) => void;
    onIoDepthChange: (ioDepths: number[]) => void;
    onTestSizeChange: (testSizes: string[]) => void;
    onDurationChange: (durations: number[]) => void;
    onReset: () => void;
}

const HostFiltersSidebar: React.FC<HostFiltersSidebarProps> = ({
    hostData,
    selectedBlockSizes,
    selectedPatterns,
    selectedQueueDepths,
    selectedNumJobs,
    selectedProtocols,
    selectedHostDiskCombinations,
    selectedSyncs,
    selectedDirects,
    selectedIoDepths,
    selectedTestSizes,
    selectedDurations,
    onBlockSizeChange,
    onPatternChange,
    onQueueDepthChange,
    onNumJobsChange,
    onProtocolChange,
    onHostDiskCombinationChange,
    onSyncChange,
    onDirectChange,
    onIoDepthChange,
    onTestSizeChange,
    onDurationChange,
    onReset
}) => {
    return (
        <div className="xl:col-span-1">
            {/* Filters */}
            <HostFilters
                testCoverage={hostData.testCoverage}
                selectedBlockSizes={selectedBlockSizes}
                selectedPatterns={selectedPatterns}
                selectedQueueDepths={selectedQueueDepths}
                selectedNumJobs={selectedNumJobs}
                selectedProtocols={selectedProtocols}
                selectedHostDiskCombinations={selectedHostDiskCombinations}
                selectedSyncs={selectedSyncs}
                selectedDirects={selectedDirects}
                selectedIoDepths={selectedIoDepths}
                selectedTestSizes={selectedTestSizes}
                selectedDurations={selectedDurations}
                onBlockSizeChange={onBlockSizeChange}
                onPatternChange={onPatternChange}
                onQueueDepthChange={onQueueDepthChange}
                onNumJobsChange={onNumJobsChange}
                onProtocolChange={onProtocolChange}
                onHostDiskCombinationChange={onHostDiskCombinationChange}
                onSyncChange={onSyncChange}
                onDirectChange={onDirectChange}
                onIoDepthChange={onIoDepthChange}
                onTestSizeChange={onTestSizeChange}
                onDurationChange={onDurationChange}
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
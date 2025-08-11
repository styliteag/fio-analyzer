import React, { memo, useMemo } from 'react';
import { HardDrive } from 'lucide-react';

interface DriveConfiguration {
    block_size: string;
    read_write_pattern: string;
    queue_depth: number;
    iops?: number;
    avg_latency?: number;
    bandwidth?: number;
}

interface DriveData {
    drive_model: string;
    drive_type: string;
    protocol: string;
    configurations: DriveConfiguration[];
    topPerformance: {
        maxIOPS: number;
        minLatency: number;
        maxBandwidth: number;
    };
}

export interface HostOverviewProps {
    filteredDrives: DriveData[];
}

// Individual DriveCard component for better memoization
const DriveCard = memo<{
    drive: DriveData;
}>(({ drive }) => {
    // Memoized sorted configurations to prevent re-sorting on every render
    const sortedConfigurations = useMemo(() => {
        return drive.configurations
            .filter((config: DriveConfiguration) => config.iops !== null)
            .sort((a: DriveConfiguration, b: DriveConfiguration) => (b.iops || 0) - (a.iops || 0))
            .slice(0, 6);
    }, [drive.configurations]);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <div>
                    <h4 className="text-lg font-semibold theme-text-primary">
                        {drive.drive_model}
                    </h4>
                    <p className="theme-text-secondary text-sm">
                        {drive.drive_type} • {drive.protocol} • {drive.configurations.length} tests
                    </p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="text-center">
                        <p className="theme-text-secondary">Max IOPS</p>
                        <p className="font-bold text-blue-600 dark:text-blue-400">
                            {drive.topPerformance.maxIOPS.toFixed(0)}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="theme-text-secondary">Min Latency</p>
                        <p className="font-bold text-green-600 dark:text-green-400">
                            {drive.topPerformance.minLatency.toFixed(2)}ms
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="theme-text-secondary">Max Bandwidth</p>
                        <p className="font-bold text-purple-600 dark:text-purple-400">
                            {drive.topPerformance.maxBandwidth.toFixed(1)} MB/s
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Test Configuration Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedConfigurations.map((config: DriveConfiguration, configIndex: number) => (
                    <ConfigurationCard key={configIndex} config={config} />
                ))}
            </div>
        </div>
    );
});

DriveCard.displayName = 'DriveCard';

// Individual ConfigurationCard component for better memoization
const ConfigurationCard = memo<{
    config: DriveConfiguration;
}>(({ config }) => {
    return (
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <div className="text-xs theme-text-secondary mb-1">
                {config.block_size} • {config.read_write_pattern} • QD{config.queue_depth}
            </div>
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-xs theme-text-secondary">IOPS:</span>
                    <span className="text-xs font-medium theme-text-primary">
                        {config.iops?.toFixed(0) || 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-xs theme-text-secondary">Latency:</span>
                    <span className="text-xs font-medium theme-text-primary">
                        {config.avg_latency?.toFixed(2)}ms
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-xs theme-text-secondary">Bandwidth:</span>
                    <span className="text-xs font-medium theme-text-primary">
                        {config.bandwidth?.toFixed(1)} MB/s
                    </span>
                </div>
            </div>
        </div>
    );
});

ConfigurationCard.displayName = 'ConfigurationCard';

const HostOverview: React.FC<HostOverviewProps> = ({ filteredDrives }) => {
    return (
        <div>
            <h3 className="text-xl font-semibold theme-text-primary mb-6 flex items-center gap-2">
                <HardDrive className="w-6 h-6" />
                Drive Performance Overview
            </h3>
            
            <div className="grid gap-6">
                {filteredDrives.map((drive) => (
                    <DriveCard key={drive.drive_model} drive={drive} />
                ))}
            </div>
        </div>
    );
};

// Export memoized version
export default memo(HostOverview, (prevProps, nextProps) => {
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
import React from "react";
import { 
    calculateServerStats, 
    formatTimeAgo,
    type ServerGroup,
} from "../../utils/timeSeriesHelpers";

interface TimeSeriesStatsProps {
    selectedServerIds: string[];
    serverGroups: ServerGroup[];
    chartData: { [serverId: string]: any[] };
}

const TimeSeriesStats: React.FC<TimeSeriesStatsProps> = ({
    selectedServerIds,
    serverGroups,
    chartData,
}) => {
    if (selectedServerIds.length === 0) {
        return null;
    }

    return (
        <div className="p-4 border-t theme-border-primary">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedServerIds.map((serverId) => {
                    const group = serverGroups.find(g => g.id === serverId);
                    const stats = calculateServerStats(chartData[serverId] || []);
                    
                    if (!group) return null;

                    return (
                        <div key={serverId} className="theme-bg-secondary p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium theme-text-primary">
                                    {group.hostname}
                                </h5>
                                <span className="text-xs theme-text-secondary">
                                    {group.protocol}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="theme-text-secondary">Tests:</span>
                                    <span className="theme-text-primary ml-1">
                                        {group.totalTests}
                                    </span>
                                </div>
                                <div>
                                    <span className="theme-text-secondary">Last:</span>
                                    <span className="theme-text-primary ml-1">
                                        {formatTimeAgo(group.lastTestTime)}
                                    </span>
                                </div>
                                
                                {stats && (
                                    <>
                                        <div>
                                            <span className="theme-text-secondary">Avg IOPS:</span>
                                            <span className="theme-text-primary ml-1">
                                                {stats.avgIops.toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="theme-text-secondary">Avg Latency:</span>
                                            <span className="theme-text-primary ml-1">
                                                {stats.avgLatency}ms
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TimeSeriesStats;
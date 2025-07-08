// Dashboard statistics API service
import type { TestRun, ServerInfo } from '../../types';
import { apiCall } from './base';
import { fetchTestRuns } from './testRuns';
import { fetchTimeSeriesServers, fetchTimeSeriesLatest } from './timeSeries';
import { fetchPerformanceData } from './performance';

export interface DashboardStats {
    totalTestRuns: number;
    activeServers: number;
    avgIOPS: number;
    avgLatency: number;
    lastUpload: string;
    totalHostnames: number;
    hostnamesWithHistory: number;
    recentActivity: ActivityItem[];
    systemStatus: SystemStatus;
}

export interface ActivityItem {
    type: 'upload' | 'analysis' | 'user' | 'system';
    description: string;
    timestamp: string;
    relativeTime: string;
}

export interface SystemStatus {
    api: 'online' | 'offline' | 'degraded';
    database: 'connected' | 'disconnected' | 'error';
    storage: 'available' | 'full' | 'error';
    auth: 'active' | 'inactive' | 'error';
}

// Calculate relative time string
const getRelativeTime = (timestamp: string): string => {
    if (!timestamp) {
        return 'Unknown';
    }
    
    const now = new Date();
    const past = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(past.getTime())) {
        console.warn('Invalid timestamp format:', timestamp);
        return 'Unknown';
    }
    
    const diffMs = now.getTime() - past.getTime();
    
    // Check for negative differences (future dates)
    if (diffMs < 0) {
        return 'just now';
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) {
        return 'just now';
    } else if (diffHours < 1) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
};

// Generate recent activity from test runs
const generateRecentActivity = (testRuns: TestRun[], servers: ServerInfo[]): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    
    // Add recent uploads (last 10 test runs)
    const recentRuns = testRuns
        .filter(run => run.timestamp) // Only include runs with valid timestamps
        .sort((a, b) => {
            const dateA = new Date(a.timestamp);
            const dateB = new Date(b.timestamp);
            
            // Handle invalid dates
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1; // Move invalid dates to end
            if (isNaN(dateB.getTime())) return -1; // Move invalid dates to end
            
            return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10);
    
    recentRuns.forEach(run => {
        activities.push({
            type: 'upload',
            description: `New test run uploaded: ${run.hostname || 'Unknown'} - ${run.protocol || 'Unknown'}`,
            timestamp: run.timestamp,
            relativeTime: getRelativeTime(run.timestamp)
        });
    });
    
    // Add server analysis activities
    servers.forEach(server => {
        if (server.last_test_time) {
            activities.push({
                type: 'analysis',
                description: `Server performance analyzed: ${server.hostname}`,
                timestamp: server.last_test_time,
                relativeTime: getRelativeTime(server.last_test_time)
            });
        }
    });
    
    // Sort by timestamp and take the most recent 5
    return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
};

// Fallback method to get metrics from recent test run performance data
const getFallbackMetrics = async (recentTestRuns: TestRun[]): Promise<{avgIOPS: number, avgLatency: number}> => {
    if (recentTestRuns.length === 0) {
        return { avgIOPS: 0, avgLatency: 0 };
    }
    
    try {
        // Get performance data for the most recent test runs (up to 10)
        const testRunIds = recentTestRuns.slice(0, 10).map(run => run.id);
        console.log('Fetching performance data for fallback metrics, test run IDs:', testRunIds);
        
        const perfResult = await fetchPerformanceData({
            testRunIds: testRunIds,
            metricTypes: ['iops', 'avg_latency']
        });
        
        if (!perfResult.data || perfResult.data.length === 0) {
            console.log('No performance data found for fallback');
            return { avgIOPS: 0, avgLatency: 0 };
        }
        
        let totalIOPS = 0;
        let totalLatency = 0;
        let iopsCount = 0;
        let latencyCount = 0;
        
        // Extract IOPS and latency from performance data
        perfResult.data.forEach(perfData => {
            const metrics = (perfData as any).metrics;
            
            // Try different metric structure possibilities
            if (metrics) {
                // Check for IOPS
                const iopsValue = metrics.iops?.value || 
                                 metrics.combined?.iops?.value || 
                                 metrics.read?.iops?.value || 
                                 metrics.write?.iops?.value;
                
                if (iopsValue && iopsValue > 0) {
                    totalIOPS += iopsValue;
                    iopsCount++;
                }
                
                // Check for average latency
                const latencyValue = metrics.avg_latency?.value || 
                                    metrics.combined?.avg_latency?.value ||
                                    metrics.read?.avg_latency?.value ||
                                    metrics.write?.avg_latency?.value;
                
                if (latencyValue && latencyValue > 0) {
                    totalLatency += latencyValue;
                    latencyCount++;
                }
            }
        });
        
        const avgIOPS = iopsCount > 0 ? Math.round(totalIOPS / iopsCount) : 0;
        const avgLatency = latencyCount > 0 ? Math.round((totalLatency / latencyCount) * 10) / 10 : 0;
        
        console.log(`Fallback metrics calculated: avgIOPS=${avgIOPS} (from ${iopsCount} samples), avgLatency=${avgLatency} (from ${latencyCount} samples)`);
        
        return { avgIOPS, avgLatency };
        
    } catch (error) {
        console.error('Error in fallback metrics calculation:', error);
        return { avgIOPS: 0, avgLatency: 0 };
    }
};

// Check system status
const checkSystemStatus = async (): Promise<SystemStatus> => {
    const status: SystemStatus = {
        api: 'online',
        database: 'connected',
        storage: 'available',
        auth: 'active'
    };
    
    try {
        // Test API connectivity by making a simple call
        await apiCall('/api/test-runs?limit=1');
        status.api = 'online';
        status.database = 'connected';
        status.storage = 'available';
        status.auth = 'active';
    } catch (error) {
        console.warn('System status check failed:', error);
        status.api = 'degraded';
        status.database = 'error';
    }
    
    return status;
};

// Fetch comprehensive dashboard statistics
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    try {
        // Fetch data in parallel
        const [testRunsResult, serversResult, latestResult] = await Promise.allSettled([
            fetchTestRuns(),
            fetchTimeSeriesServers(),
            fetchTimeSeriesLatest()
        ]);
        
        // Extract data from results
        const testRuns = testRunsResult.status === 'fulfilled' ? testRunsResult.value.data || [] : [];
        const servers = serversResult.status === 'fulfilled' ? serversResult.value.data || [] : [];
        const latestData = latestResult.status === 'fulfilled' ? latestResult.value.data || [] : [];
        
        // Calculate statistics
        const totalTestRuns = testRuns.length;
        const activeServers = servers.filter(s => s.test_count > 0).length;
        
        // Debug logging to understand data structure
        console.log('Latest data sample:', latestData.slice(0, 3));
        console.log('Latest data length:', latestData.length);
        if (latestData.length > 0) {
            console.log('Available metric types:', [...new Set(latestData.map(d => d.metric_type))]);
        }
        
        // Calculate average IOPS and latency from latest data
        const iopsData = latestData.filter(d => d.metric_type === 'iops' && d.value > 0);
        const latencyData = latestData.filter(d => d.metric_type === 'avg_latency' && d.value > 0);
        
        console.log('IOPS data points:', iopsData.length, 'Latency data points:', latencyData.length);
        
        let avgIOPS = 0;
        let avgLatency = 0;
        
        // Try to get IOPS and latency from time series latest
        if (iopsData.length > 0) {
            avgIOPS = Math.round(iopsData.reduce((sum, d) => sum + d.value, 0) / iopsData.length);
        }
        
        if (latencyData.length > 0) {
            avgLatency = Math.round(latencyData.reduce((sum, d) => sum + d.value, 0) / latencyData.length * 10) / 10;
        }
        
        // If either metric is missing, use fallback method for both
        if (avgIOPS === 0 || avgLatency === 0) {
            console.log('Missing metrics from time series, trying fallback method...');
            const fallbackMetrics = await getFallbackMetrics(testRuns.slice(0, 10));
            
            if (avgIOPS === 0) {
                avgIOPS = fallbackMetrics.avgIOPS;
            }
            if (avgLatency === 0) {
                avgLatency = fallbackMetrics.avgLatency;
            }
        }
        
        // Find most recent upload
        const mostRecentRun = testRuns.length > 0 
            ? testRuns
                .filter(run => run.timestamp) // Filter out runs without timestamps
                .reduce((latest, current) => {
                    const latestTime = new Date(latest.timestamp);
                    const currentTime = new Date(current.timestamp);
                    
                    // Only compare if both dates are valid
                    if (isNaN(latestTime.getTime()) && isNaN(currentTime.getTime())) {
                        return latest;
                    }
                    if (isNaN(latestTime.getTime())) {
                        return current;
                    }
                    if (isNaN(currentTime.getTime())) {
                        return latest;
                    }
                    
                    return currentTime > latestTime ? current : latest;
                }, testRuns[0])
            : null;
        
        const lastUpload = (mostRecentRun && mostRecentRun.timestamp) 
            ? getRelativeTime(mostRecentRun.timestamp) 
            : 'No recent uploads';
        
        // Debug logging for timestamp format
        if (mostRecentRun) {
            console.log('Most recent run timestamp:', mostRecentRun.timestamp, 'Parsed:', new Date(mostRecentRun.timestamp));
        }
        
        // Generate recent activity
        const recentActivity = generateRecentActivity(testRuns, servers);
        
        // Check system status
        const systemStatus = await checkSystemStatus();
        
        // Count unique hostnames from test runs
        const uniqueHostnames = new Set(testRuns
            .filter(run => run.hostname)
            .map(run => run.hostname)
        );
        const totalHostnames = uniqueHostnames.size;
        
        // Count unique hostnames with time series history from /api/time-series/servers
        const uniqueTimeSeriesHostnames = new Set(servers
            .filter(server => server.hostname)
            .map(server => server.hostname)
        );
        const hostnamesWithHistory = uniqueTimeSeriesHostnames.size;
        
        console.log('Test run hostnames:', [...uniqueHostnames]);
        console.log('Time series server entries:', servers.length);
        console.log('Time series server details:', servers.map(s => `${s.hostname}|${s.protocol}|${s.drive_model}`));
        console.log('Time series hostnames:', [...uniqueTimeSeriesHostnames]);
        console.log('Unique time series hostnames count:', uniqueTimeSeriesHostnames.size);
        
        return {
            totalTestRuns,
            activeServers,
            avgIOPS,
            avgLatency,
            lastUpload,
            totalHostnames,
            hostnamesWithHistory,
            recentActivity,
            systemStatus
        };
        
    } catch (error) {
        console.error('Failed to fetch dashboard statistics:', error);
        throw error;
    }
};

// Fetch quick stats for the loading state
export const fetchQuickStats = async () => {
    try {
        const result = await fetchTestRuns();
        const testRuns = result.data || [];
        
        return {
            totalTestRuns: testRuns.length,
            hasData: testRuns.length > 0
        };
    } catch (error) {
        console.error('Failed to fetch quick stats:', error);
        return {
            totalTestRuns: 0,
            hasData: false
        };
    }
};
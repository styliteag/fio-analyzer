// Dashboard statistics API service
import type { TestRun, ServerInfo } from '../../types';
import type { ApiInfoResponse } from '../../types/api';
import { apiCall } from './base';
import { fetchTestRuns } from './testRuns';
import { fetchTimeSeriesServers, fetchTimeSeriesLatest } from './timeSeries';

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

// Fallback method to get metrics directly from test runs
const getFallbackMetrics = (recentTestRuns: TestRun[]): {avgIOPS: number, avgLatency: number} => {
    if (recentTestRuns.length === 0) {
        return { avgIOPS: 0, avgLatency: 0 };
    }
    
    // Calculate averages directly from test run data
    const validIOPS = recentTestRuns
        .map(run => typeof run.iops === 'number' ? run.iops : parseFloat(run.iops as any) || 0)
        .filter(iops => !isNaN(iops) && iops > 0);
    
    const validLatency = recentTestRuns
        .map(run => typeof run.avg_latency === 'number' ? run.avg_latency : parseFloat(run.avg_latency as any) || 0)
        .filter(latency => !isNaN(latency) && latency > 0);
    
    const avgIOPS = validIOPS.length > 0 
        ? Math.round(validIOPS.reduce((sum, val) => sum + val, 0) / validIOPS.length)
        : 0;
    
    const latencySum = validLatency.reduce((sum, val) => sum + val, 0);
    const latencyAvg = validLatency.length > 0 ? latencySum / validLatency.length : 0;
    const avgLatency = latencyAvg > 0
        ? Math.round(latencyAvg * 100) / 100  // Round to 2 decimal places
        : 0;
    
    console.log('Fallback metrics calculated:', {
        testRunsUsed: recentTestRuns.length,
        validIOPS: validIOPS.length,
        validLatency: validLatency.length,
        avgIOPS,
        avgLatency,
        latencySample: validLatency.slice(0, 5),
        latencySum: validLatency.reduce((sum, val) => sum + val, 0),
        latencyAvg: validLatency.length > 0 ? validLatency.reduce((sum, val) => sum + val, 0) / validLatency.length : 0
    });
    
    return { avgIOPS, avgLatency };
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
        // Fetch data in parallel - use include_metadata to get total count
        const [testRunsResult, serversResult, latestResult] = await Promise.allSettled([
            fetchTestRuns({ include_metadata: true }),
            fetchTimeSeriesServers(),
            fetchTimeSeriesLatest()
        ]);
        
        // Extract data from results
        // Handle both metadata response and direct array for backward compatibility
        let testRuns: any[] = [];
        let totalTestRuns = 0;
        
        if (testRunsResult.status === 'fulfilled' && testRunsResult.value.data) {
            // Check if response has metadata structure
            if ('data' in testRunsResult.value.data && 'total' in testRunsResult.value.data) {
                // Metadata response
                const metadataResponse = testRunsResult.value.data as { data: any[], total: number };
                testRuns = metadataResponse.data || [];
                totalTestRuns = metadataResponse.total || 0;
            } else {
                // Direct array response (backward compatibility)
                testRuns = Array.isArray(testRunsResult.value.data) ? testRunsResult.value.data : [];
                totalTestRuns = testRuns.length;
            }
        }
        
        const servers = serversResult.status === 'fulfilled' ? serversResult.value.data || [] : [];
        const latestData = latestResult.status === 'fulfilled' ? latestResult.value.data || [] : [];
        
        // Debug logging
        console.log('Dashboard stats - servers:', servers.length, servers);
        console.log('Dashboard stats - latestData:', latestData.length, latestData.slice(0, 5));
        
        // Calculate statistics
        const activeServers = servers.filter(s => s.test_count > 0).length;
        console.log('Active servers count:', activeServers, 'from', servers.length, 'total servers');
        
        // Calculate average IOPS and latency from latest data
        const iopsData = latestData.filter(d => d.metric_type === 'iops' && d.value > 0);
        const latencyData = latestData.filter(d => d.metric_type === 'avg_latency' && d.value > 0);
        
        console.log('IOPS data points:', iopsData.length);
        console.log('Latency data points:', latencyData.length);
        if (latencyData.length > 0) {
            const sampleValues = latencyData.slice(0, 5).map(d => d.value);
            const sum = latencyData.reduce((sum, d) => sum + d.value, 0);
            const avg = sum / latencyData.length;
            console.log('Latency calculation details:', {
                sampleValues,
                sum,
                count: latencyData.length,
                average: avg,
                min: Math.min(...latencyData.map(d => d.value)),
                max: Math.max(...latencyData.map(d => d.value))
            });
        }
        
        let avgIOPS = 0;
        let avgLatency = 0;
        
        // Try to get IOPS and latency from time series latest
        if (iopsData.length > 0) {
            avgIOPS = Math.round(iopsData.reduce((sum, d) => sum + d.value, 0) / iopsData.length);
            console.log('Calculated avgIOPS from time series:', avgIOPS);
        }
        
        if (latencyData.length > 0) {
            // Ensure values are numbers
            const numericValues = latencyData.map(d => {
                const val = typeof d.value === 'number' ? d.value : parseFloat(d.value as any) || 0;
                return val;
            }).filter(v => !isNaN(v) && v > 0);
            
            if (numericValues.length > 0) {
                const sum = numericValues.reduce((sum, val) => sum + val, 0);
                const avg = sum / numericValues.length;
                avgLatency = Math.round(avg * 100) / 100; // Round to 2 decimal places
                console.log('Calculated avgLatency from time series:', {
                    sum,
                    count: numericValues.length,
                    avg,
                    rounded: avgLatency,
                    sampleValues: numericValues.slice(0, 5),
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues)
                });
            } else {
                console.warn('No valid numeric latency values found in time series data');
            }
        }
        
        // If either metric is missing, use fallback method from test runs
        if (avgIOPS === 0 || avgLatency === 0) {
            console.log('Missing metrics from time series, trying fallback method from test runs...');
            console.log('Test runs available:', testRuns.length);
            if (testRuns.length > 0) {
                console.log('Sample test run latency:', testRuns[0]?.avg_latency, 'IOPS:', testRuns[0]?.iops);
            }
            
            // Use more test runs for better average (up to 50)
            const fallbackMetrics = getFallbackMetrics(testRuns.slice(0, 50));
            
            if (avgIOPS === 0 && fallbackMetrics.avgIOPS > 0) {
                console.log('Using fallback IOPS:', fallbackMetrics.avgIOPS);
                avgIOPS = fallbackMetrics.avgIOPS;
            }
            if (avgLatency === 0 && fallbackMetrics.avgLatency > 0) {
                console.log('Using fallback latency:', fallbackMetrics.avgLatency);
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
        const result = await fetchTestRuns({ include_metadata: true });
        
        if (!result.data) {
            return {
                totalTestRuns: 0,
                hasData: false
            };
        }
        
        // Handle both metadata response and direct array for backward compatibility
        let totalTestRuns = 0;
        let hasData = false;
        
        if ('data' in result.data && 'total' in result.data) {
            // Metadata response
            const metadataResponse = result.data as { data: any[], total: number };
            totalTestRuns = metadataResponse.total || 0;
            hasData = (metadataResponse.data?.length || 0) > 0;
        } else {
            // Direct array response (backward compatibility)
            const testRuns = Array.isArray(result.data) ? result.data : [];
            totalTestRuns = testRuns.length;
            hasData = testRuns.length > 0;
        }
        
        return {
            totalTestRuns,
            hasData
        };
    } catch (error) {
        console.error('Failed to fetch quick stats:', error);
        return {
            totalTestRuns: 0,
            hasData: false
        };
    }
};

// Fetch API info including version
export const fetchApiInfo = async (): Promise<ApiInfoResponse> => {
    try {
        const response = await apiCall('/api/info');
        return response.data as ApiInfoResponse;
    } catch (error) {
        console.error('Failed to fetch API info:', error);
        throw error;
    }
};
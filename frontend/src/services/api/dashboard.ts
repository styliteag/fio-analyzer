// Dashboard statistics API service (aggregated server-side by /api/dashboard/stats)
import type { ApiInfoResponse } from '../../types/api';
import { apiCall } from './base';

/** Raw payload from GET /api/dashboard/stats */
interface DashboardStatsResponse {
    totalTestRuns: number;
    totalHostnames: number;
    hostnamesWithHistory: number;
    activeServers: number;
    avgIOPS: number;
    avgLatency: number;
    lastUploadAt: string | null;
}

export interface DashboardStats extends DashboardStatsResponse {
    /** Human-readable age of the newest upload, e.g. "3 hours ago" */
    lastUpload: string;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const plural = (value: number, unit: string): string => `${value} ${unit}${value === 1 ? '' : 's'} ago`;

export const getRelativeTime = (timestamp: string | null, now: Date = new Date()): string => {
    if (!timestamp) return 'No uploads yet';
    const past = new Date(timestamp);
    if (Number.isNaN(past.getTime())) return 'Unknown';

    const diffMs = now.getTime() - past.getTime();
    if (diffMs < MINUTE_MS) return 'just now';
    if (diffMs < HOUR_MS) return plural(Math.floor(diffMs / MINUTE_MS), 'minute');
    if (diffMs < DAY_MS) return plural(Math.floor(diffMs / HOUR_MS), 'hour');
    return plural(Math.floor(diffMs / DAY_MS), 'day');
};

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    const response = await apiCall<DashboardStatsResponse>('/api/dashboard/stats');
    if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load dashboard statistics');
    }
    return { ...response.data, lastUpload: getRelativeTime(response.data.lastUploadAt) };
};

export const fetchApiInfo = async (): Promise<ApiInfoResponse> => {
    const response = await apiCall<ApiInfoResponse>('/api/info');
    if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load API info');
    }
    return response.data;
};

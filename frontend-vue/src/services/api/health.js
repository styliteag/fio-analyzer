import { apiClient } from './client';
// Health API service
export class HealthApiService {
    constructor() {
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: '/health'
        });
    }
    /**
     * Get basic health status
     */
    async getHealth() {
        try {
            const response = await apiClient.get(this.baseUrl);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch health status:', error);
            throw error;
        }
    }
    /**
     * Get detailed health information including all services
     */
    async getDetailedHealth() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/detailed`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch detailed health:', error);
            // Fallback to basic health if detailed endpoint doesn't exist
            const basicHealth = await this.getHealth();
            return {
                ...basicHealth,
                services: undefined,
                metrics: undefined,
                version_info: undefined,
            };
        }
    }
    /**
     * Get system information and capabilities
     */
    async getSystemInfo() {
        try {
            const response = await apiClient.get('/api/info');
            return response;
        }
        catch (error) {
            console.error('Failed to fetch system info:', error);
            throw error;
        }
    }
    /**
     * Check database connectivity
     */
    async checkDatabase() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/database`);
            return response;
        }
        catch (error) {
            console.error('Failed to check database health:', error);
            return {
                status: 'offline',
                message: 'Database check failed',
                last_check: new Date().toISOString(),
            };
        }
    }
    /**
     * Check file storage connectivity
     */
    async checkFileStorage() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/storage`);
            return response;
        }
        catch (error) {
            console.error('Failed to check file storage health:', error);
            return {
                status: 'offline',
                message: 'File storage check failed',
                last_check: new Date().toISOString(),
            };
        }
    }
    /**
     * Check authentication service
     */
    async checkAuthentication() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/auth`);
            return response;
        }
        catch (error) {
            console.error('Failed to check authentication health:', error);
            return {
                status: 'offline',
                message: 'Authentication check failed',
                last_check: new Date().toISOString(),
            };
        }
    }
    /**
     * Run comprehensive health check on all services
     */
    async runFullHealthCheck() {
        try {
            const [apiHealth, databaseHealth, fileStorageHealth, authHealth,] = await Promise.allSettled([
                this.getHealth(),
                this.checkDatabase(),
                this.checkFileStorage(),
                this.checkAuthentication(),
            ]);
            const services = {
                api: apiHealth.status === 'fulfilled'
                    ? { status: 'online', last_check: new Date().toISOString() }
                    : { status: 'offline', message: 'API unreachable', last_check: new Date().toISOString() },
                database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : databaseHealth.reason,
                file_storage: fileStorageHealth.status === 'fulfilled' ? fileStorageHealth.value : fileStorageHealth.reason,
                authentication: authHealth.status === 'fulfilled' ? authHealth.value : authHealth.reason,
            };
            const issues = [];
            const recommendations = [];
            // Analyze service statuses
            Object.entries(services).forEach(([service, health]) => {
                if (health.status !== 'online') {
                    issues.push(`${service} service is ${health.status}`);
                    recommendations.push(`Check ${service} service configuration and connectivity`);
                }
            });
            // Determine overall status
            const hasOffline = Object.values(services).some(s => s.status === 'offline');
            const hasDegraded = Object.values(services).some(s => s.status === 'degraded');
            let overall_status;
            if (hasOffline) {
                overall_status = 'unhealthy';
            }
            else if (hasDegraded) {
                overall_status = 'degraded';
            }
            else {
                overall_status = 'healthy';
            }
            return {
                overall_status,
                timestamp: new Date().toISOString(),
                services,
                issues,
                recommendations,
            };
        }
        catch (error) {
            console.error('Failed to run full health check:', error);
            throw error;
        }
    }
    /**
     * Get performance metrics
     */
    async getPerformanceMetrics() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/metrics`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch performance metrics:', error);
            throw error;
        }
    }
    /**
     * Get API endpoint documentation
     */
    async getApiDocumentation() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/docs`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch API documentation:', error);
            throw error;
        }
    }
    /**
     * Ping the service for basic connectivity
     */
    async ping() {
        try {
            const startTime = Date.now();
            const response = await apiClient.get(`${this.baseUrl}/ping`);
            const endTime = Date.now();
            return {
                ...response,
                response_time_ms: endTime - startTime,
            };
        }
        catch (error) {
            console.error('Failed to ping service:', error);
            return {
                pong: false,
                timestamp: new Date().toISOString(),
                response_time_ms: 0,
            };
        }
    }
    /**
     * Get service logs (admin only)
     */
    async getServiceLogs(lines = 100) {
        try {
            const response = await apiClient.get(`${this.baseUrl}/logs?lines=${lines}`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch service logs:', error);
            throw error;
        }
    }
    /**
     * Test external service connectivity
     */
    async testExternalConnectivity() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/connectivity`);
            return response;
        }
        catch (error) {
            console.error('Failed to test external connectivity:', error);
            throw error;
        }
    }
    /**
     * Get configuration status
     */
    async getConfigurationStatus() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/config`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch configuration status:', error);
            throw error;
        }
    }
    /**
     * Get dependency versions
     */
    async getDependencyVersions() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/versions`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch dependency versions:', error);
            throw error;
        }
    }
    /**
     * Trigger garbage collection (development only)
     */
    async triggerGarbageCollection() {
        try {
            const response = await apiClient.post(`${this.baseUrl}/gc`, {});
            return response;
        }
        catch (error) {
            console.error('Failed to trigger garbage collection:', error);
            throw error;
        }
    }
    /**
     * Get cache statistics
     */
    async getCacheStatistics() {
        try {
            const response = await apiClient.get(`${this.baseUrl}/cache`);
            return response;
        }
        catch (error) {
            console.error('Failed to fetch cache statistics:', error);
            // Return default values if cache stats not available
            return {
                enabled: false,
                total_entries: 0,
                total_size_bytes: 0,
                hit_rate_percent: 0,
                miss_rate_percent: 0,
                eviction_count: 0,
            };
        }
    }
}
// Create and export singleton instance
export const healthApi = new HealthApiService();

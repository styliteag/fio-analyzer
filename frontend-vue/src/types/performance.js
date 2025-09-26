/**
 * Performance Data Types
 * Based on data-model.md specifications
 */
// Validation functions
export function validatePerformanceData(data) {
    return (typeof data.iops === 'number' || data.iops === null || data.iops === undefined) && (typeof data.avg_latency === 'number' || data.avg_latency === null || data.avg_latency === undefined) && (typeof data.bandwidth === 'number' || data.bandwidth === null || data.bandwidth === undefined) && typeof data.block_size === 'string' &&
        typeof data.read_write_pattern === 'string' &&
        typeof data.queue_depth === 'number' &&
        typeof data.hostname === 'string' &&
        typeof data.timestamp === 'string';
}
export function normalizePerformanceMetrics(data) {
    let maxIOPS = 0;
    let maxBandwidth = 0;
    let maxResponsiveness = 0;
    data.forEach(item => {
        if (item.iops && item.iops > maxIOPS)
            maxIOPS = item.iops;
        if (item.bandwidth && item.bandwidth > maxBandwidth)
            maxBandwidth = item.bandwidth;
        // Responsiveness = 1000 / latency (ops/ms)
        if (item.avg_latency && item.avg_latency > 0) {
            const responsiveness = 1000 / item.avg_latency;
            if (responsiveness > maxResponsiveness)
                maxResponsiveness = responsiveness;
        }
    });
    return { maxIOPS, maxBandwidth, maxResponsiveness };
}

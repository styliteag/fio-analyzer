// Transform TestRun data to performance metrics format
export function transformTestRunsToMetrics(testRuns) {
    return testRuns.map(run => ({
        iops: { value: run.iops, unit: 'IOPS' },
        avg_latency: { value: run.avg_latency, unit: 'ms' },
        bandwidth: { value: run.bandwidth, unit: 'MB/s' },
        p95_latency: run.p95_latency ? { value: run.p95_latency, unit: 'ms' } : undefined,
        p99_latency: run.p99_latency ? { value: run.p99_latency, unit: 'ms' } : undefined,
    }));
}
// Normalize performance data for comparison (0-1 scale)
export function normalizePerformanceData(data, metrics = ['iops', 'latency', 'bandwidth']) {
    if (!data || data.length === 0)
        return [];
    // Calculate min/max for each metric
    const ranges = {};
    metrics.forEach(metric => {
        const values = data
            .map(item => item[metric])
            .filter(val => val !== undefined && val !== null && !isNaN(val));
        if (values.length > 0) {
            ranges[metric] = {
                min: Math.min(...values.filter(v => v !== undefined)),
                max: Math.max(...values.filter(v => v !== undefined)),
            };
        }
    });
    // Normalize data
    return data.map(item => {
        const normalized = {};
        metrics.forEach(metric => {
            const value = item[metric];
            const range = ranges[metric];
            if (value !== undefined && value !== null && range && range.max !== range.min) {
                normalized[metric] = (value - range.min) / (range.max - range.min);
            }
            else {
                normalized[metric] = 0;
            }
        });
        return normalized;
    });
}
// Filter test runs with OR/AND logic
export function filterTestRuns(testRuns, filters) {
    if (!filters || Object.keys(filters).length === 0)
        return testRuns;
    return testRuns.filter(run => {
        // AND logic between different filter categories
        for (const [category, values] of Object.entries(filters)) {
            if (!values || (Array.isArray(values) && values.length === 0))
                continue;
            const valueArray = Array.isArray(values) ? values : [values];
            const matchesCategory = matchesFilterCategory(run, category, valueArray);
            if (!matchesCategory)
                return false;
        }
        return true;
    });
}
// Check if a test run matches a specific filter category (OR logic within category)
function matchesFilterCategory(run, category, values) {
    switch (category) {
        case 'hostnames':
            return values.includes(run.hostname);
        case 'drive_types':
            return values.includes(run.drive_type);
        case 'drive_models':
            return values.includes(run.drive_model);
        case 'protocols':
            return values.includes(run.protocol);
        case 'block_sizes':
            return values.includes(run.block_size);
        case 'patterns':
            return values.includes(run.read_write_pattern);
        case 'queue_depths':
            return values.includes(run.queue_depth);
        case 'num_jobs':
            return values.includes(run.num_jobs);
        case 'syncs':
            return values.includes(run.sync);
        case 'directs':
            return values.includes(run.direct);
        case 'test_sizes':
            return values.includes(run.test_size);
        case 'durations':
            return values.includes(run.duration);
        default:
            return true;
    }
}
// Sort test runs by multiple criteria
export function sortTestRuns(testRuns, criteria) {
    if (!criteria || criteria.length === 0)
        return [...testRuns];
    return [...testRuns].sort((a, b) => {
        for (const { field, direction } of criteria) {
            const aValue = a[field];
            const bValue = b[field];
            let comparison = 0;
            if (aValue === bValue)
                continue;
            // Handle different field types
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            }
            else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            }
            else if (aValue === null || aValue === undefined) {
                comparison = -1;
            }
            else if (bValue === null || bValue === undefined) {
                comparison = 1;
            }
            else {
                // Convert to string for comparison
                comparison = String(aValue).localeCompare(String(bValue));
            }
            if (direction === 'desc') {
                comparison = -comparison;
            }
            if (comparison !== 0)
                return comparison;
        }
        return 0;
    });
}
// Group test runs by specified fields
export function groupTestRunsBy(testRuns, fields) {
    const grouped = {};
    testRuns.forEach(run => {
        const keys = fields.map(field => {
            const value = (run[field]);
            return value !== undefined && value !== null ? String(value) : 'unknown';
        });
        const groupKey = keys.join(' - ');
        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }
        grouped[groupKey].push(run);
    });
    return grouped;
}
// Calculate performance summary statistics
export function calculatePerformanceSummary(testRuns) {
    if (!testRuns || testRuns.length === 0) {
        return {
            total_tests: 0,
            avg_iops: 0,
            avg_latency: 0,
            avg_bandwidth: 0,
            max_iops: 0,
            min_latency: 0,
            variance_iops: 0,
            variance_latency: 0,
        };
    }
    const iopsValues = testRuns.map(r => r.iops).filter(v => v > 0);
    const latencyValues = testRuns.map(r => r.avg_latency).filter(v => v > 0);
    const bandwidthValues = testRuns.map(r => r.bandwidth).filter(v => v > 0);
    const avgIops = iopsValues.length > 0 ? iopsValues.reduce((a, b) => a + b, 0) / iopsValues.length : 0;
    const avgLatency = latencyValues.length > 0 ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : 0;
    const avgBandwidth = bandwidthValues.length > 0 ? bandwidthValues.reduce((a, b) => a + b, 0) / bandwidthValues.length : 0;
    // Calculate variance
    const iopsVariance = iopsValues.length > 0
        ? iopsValues.reduce((sum, val) => sum + Math.pow(val - avgIops, 2), 0) / iopsValues.length
        : 0;
    const latencyVariance = latencyValues.length > 0
        ? latencyValues.reduce((sum, val) => sum + Math.pow(val - avgLatency, 2), 0) / latencyValues.length
        : 0;
    return {
        total_tests: testRuns.length,
        avg_iops: avgIops,
        avg_latency: avgLatency,
        avg_bandwidth: avgBandwidth,
        max_iops: iopsValues.length > 0 ? Math.max(...iopsValues) : 0,
        min_latency: latencyValues.length > 0 ? Math.min(...latencyValues) : 0,
        variance_iops: iopsVariance,
        variance_latency: latencyVariance,
    };
}
// Extract unique values from test runs
export function extractUniqueValues(testRuns, fields) {
    const result = {};
    // Initialize sets
    fields.forEach(field => {
        result[field] = new Set();
    });
    // Extract values
    testRuns.forEach(run => {
        fields.forEach(field => {
            const value = (run[field]);
            if (value !== undefined && value !== null) {
                result[field].add(value);
            }
        });
    });
    // Convert sets to sorted arrays
    const finalResult = {};
    Object.entries(result).forEach(([field, values]) => {
        finalResult[field] = Array.from(values).sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a - b;
            }
            return String(a).localeCompare(String(b));
        });
    });
    return finalResult;
}
// Validate test run data integrity
export function validateTestRunData(testRun) {
    if (!testRun || typeof testRun !== 'object')
        return false;
    const data = testRun;
    // Required fields
    const requiredFields = [
        'id', 'timestamp', 'hostname', 'drive_model', 'drive_type',
        'test_name', 'block_size', 'read_write_pattern', 'queue_depth',
        'duration', 'iops', 'avg_latency', 'bandwidth'
    ];
    for (const field of requiredFields) {
        if (!(field in data) || data[field] === null || data[field] === undefined)
            return false;
    }
    // Type validation
    if (typeof data.id !== 'number' || data.id <= 0)
        return false;
    if (typeof data.timestamp !== 'string')
        return false;
    if (typeof data.hostname !== 'string' || data.hostname.trim() === '')
        return false;
    if (typeof data.drive_model !== 'string' || data.drive_model.trim() === '')
        return false;
    if (typeof data.drive_type !== 'string' || data.drive_type.trim() === '')
        return false;
    if (typeof data.test_name !== 'string' || data.test_name.trim() === '')
        return false;
    if (typeof data.block_size !== 'string' || data.block_size.trim() === '')
        return false;
    if (typeof data.read_write_pattern !== 'string' || data.read_write_pattern.trim() === '')
        return false;
    if (typeof data.queue_depth !== 'number' || data.queue_depth <= 0)
        return false;
    if (typeof data.duration !== 'number' || data.duration <= 0)
        return false;
    if (typeof data.iops !== 'number' || data.iops < 0)
        return false;
    if (typeof data.avg_latency !== 'number' || data.avg_latency < 0)
        return false;
    if (typeof data.bandwidth !== 'number' || data.bandwidth < 0)
        return false;
    // Additional value validation already done above
    return true;
}
// Additional utility functions for data transformation
// Convert test runs to filter options
export function testRunsToFilterOptions(testRuns) {
    const unique = extractUniqueValues(testRuns, [
        'drive_models', 'block_sizes', 'patterns', 'syncs',
        'queue_depths', 'directs', 'num_jobs', 'test_sizes',
        'durations', 'hostnames', 'protocols', 'drive_types'
    ]);
    return {
        drive_models: unique.drive_models,
        host_disk_combinations: createHostDiskCombinations(testRuns),
        block_sizes: unique.block_sizes,
        patterns: unique.patterns,
        syncs: unique.syncs,
        queue_depths: unique.queue_depths,
        directs: unique.directs,
        num_jobs: unique.num_jobs,
        test_sizes: unique.test_sizes,
        durations: unique.durations,
        hostnames: unique.hostnames,
        protocols: unique.protocols,
        drive_types: unique.drive_types,
    };
}
// Create host-disk combinations
function createHostDiskCombinations(testRuns) {
    const combinations = new Set();
    testRuns.forEach(run => {
        const combo = `${run.hostname} - ${run.protocol} - ${run.drive_model}`;
        combinations.add(combo);
    });
    return Array.from(combinations).sort();
}
// Debounce data updates
export function debounceDataUpdate(callback, delay = 300) {
    let timeoutId;
    return (data) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => callback(data), delay);
    };
}
// Paginate data
export function paginateData(data, page, pageSize) {
    const total = data.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = data.slice(start, end);
    return {
        items,
        total,
        page,
        pageSize,
        totalPages,
    };
}

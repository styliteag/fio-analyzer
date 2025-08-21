// Application constants and configuration values

// Metric types and their configurations
export const METRIC_TYPES = {
    iops: {
        key: 'iops',
        label: 'IOPS',
        unit: 'IOPS',
        description: 'Input/Output Operations Per Second',
        color: '#3B82F6',
        format: 'number',
        precision: 0,
    },
    avg_latency: {
        key: 'avg_latency',
        label: 'Average Latency',
        unit: 'ms',
        description: 'Average response time in milliseconds',
        color: '#EF4444',
        format: 'decimal',
        precision: 2,
    },
    bandwidth: {
        key: 'bandwidth',
        label: 'Bandwidth',
        unit: 'MB/s',
        description: 'Data transfer rate in megabytes per second',
        color: '#10B981',
        format: 'decimal',
        precision: 2,
    },
    p95_latency: {
        key: 'p95_latency',
        label: '95th Percentile Latency',
        unit: 'ms',
        description: '95% of operations complete within this time',
        color: '#F59E0B',
        format: 'decimal',
        precision: 2,
    },
    p99_latency: {
        key: 'p99_latency',
        label: '99th Percentile Latency',
        unit: 'ms',
        description: '99% of operations complete within this time',
        color: '#8B5CF6',
        format: 'decimal',
        precision: 2,
    },
} as const;

// Drive types and their characteristics
export const DRIVE_TYPES = {
    'NVMe SSD': {
        key: 'NVMe SSD',
        label: 'NVMe SSD',
        description: 'Non-Volatile Memory Express Solid State Drive',
        color: '#3B82F6',
        icon: 'Zap',
        expectedIOPS: 100000,
        expectedLatency: 0.1,
    },
    'SATA SSD': {
        key: 'SATA SSD',
        label: 'SATA SSD',
        description: 'Serial ATA Solid State Drive',
        color: '#10B981',
        icon: 'HardDrive',
        expectedIOPS: 50000,
        expectedLatency: 0.5,
    },
    'HDD': {
        key: 'HDD',
        label: 'HDD',
        description: 'Hard Disk Drive',
        color: '#6B7280',
        icon: 'Database',
        expectedIOPS: 200,
        expectedLatency: 5.0,
    },
    'Optane': {
        key: 'Optane',
        label: 'Optane',
        description: 'Intel 3D XPoint Memory',
        color: '#8B5CF6',
        icon: 'Cpu',
        expectedIOPS: 500000,
        expectedLatency: 0.01,
    },
} as const;

// Protocol types
export const PROTOCOL_TYPES = {
    'Local': {
        key: 'Local',
        label: 'Local',
        description: 'Direct attached storage',
        color: '#3B82F6',
    },
    'iSCSI': {
        key: 'iSCSI',
        label: 'iSCSI',
        description: 'Internet Small Computer Systems Interface',
        color: '#10B981',
    },
    'NFS': {
        key: 'NFS',
        label: 'NFS',
        description: 'Network File System',
        color: '#F59E0B',
    },
    'SMB': {
        key: 'SMB',
        label: 'SMB',
        description: 'Server Message Block',
        color: '#EF4444',
    },
    'FC': {
        key: 'FC',
        label: 'Fibre Channel',
        description: 'Fibre Channel Protocol',
        color: '#8B5CF6',
    },
} as const;

// Test patterns and their characteristics
export const TEST_PATTERNS = {
    read: {
        key: 'read',
        label: 'Sequential Read',
        description: 'Sequential read operations',
        color: '#3B82F6',
        icon: 'Download',
    },
    write: {
        key: 'write',
        label: 'Sequential Write',
        description: 'Sequential write operations',
        color: '#EF4444',
        icon: 'Upload',
    },
    randread: {
        key: 'randread',
        label: 'Random Read',
        description: 'Random read operations',
        color: '#10B981',
        icon: 'Shuffle',
    },
    randwrite: {
        key: 'randwrite',
        label: 'Random Write',
        description: 'Random write operations',
        color: '#F59E0B',
        icon: 'Edit3',
    },
    randrw: {
        key: 'randrw',
        label: 'Random Read/Write',
        description: 'Mixed random read and write operations',
        color: '#8B5CF6',
        icon: 'RefreshCw',
    },
} as const;

// Block sizes in bytes for sorting and comparison
export const BLOCK_SIZES = {
    '4K': 4096,
    '8K': 8192,
    '16K': 16384,
    '32K': 32768,
    '64K': 65536,
    '128K': 131072,
    '256K': 262144,
    '512K': 524288,
    '1M': 1048576,
    '2M': 2097152,
    '4M': 4194304,
    '8M': 8388608,
} as const;

// Time range options for time series
export const TIME_RANGES = [
    { value: '1h', label: 'Last Hour', hours: 1 },
    { value: '6h', label: 'Last 6 Hours', hours: 6 },
    { value: '24h', label: 'Last 24 Hours', hours: 24 },
    { value: '3d', label: 'Last 3 Days', days: 3 },
    { value: '7d', label: 'Last 7 Days', days: 7 },
    { value: '30d', label: 'Last 30 Days', days: 30 },
    { value: '90d', label: 'Last 90 Days', days: 90 },
    { value: 'custom', label: 'Custom Range' },
] as const;

// API configuration
export const API_CONFIG = {
    baseURL: import.meta.env.PROD ? '' : 'http://localhost:8000',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    endpoints: {
        testRuns: '/api/test-runs',
        performanceData: '/api/test-runs/performance-data',
        filters: '/api/filters',
        timeSeries: {
            servers: '/api/time-series/servers',
            latest: '/api/time-series/latest',
            history: '/api/time-series/history',
            trends: '/api/time-series/trends',
        },
        upload: '/api/import',
        info: '/api/info',
        auth: {
            login: '/auth/login',
            logout: '/auth/logout',
            status: '/auth/status',
        },
    },
} as const;




// Default export with all constants
export const APP_CONSTANTS = {
    METRIC_TYPES,
    DRIVE_TYPES,
    PROTOCOL_TYPES,
    TEST_PATTERNS,
    BLOCK_SIZES,
    TIME_RANGES,
    API_CONFIG,
} as const;

// Helper functions for constants
export const getMetricConfig = (metricType: string) => {
    return METRIC_TYPES[metricType as keyof typeof METRIC_TYPES];
};

export const getDriveTypeConfig = (driveType: string) => {
    return DRIVE_TYPES[driveType as keyof typeof DRIVE_TYPES];
};

export const getProtocolConfig = (protocol: string) => {
    return PROTOCOL_TYPES[protocol as keyof typeof PROTOCOL_TYPES];
};

export const getTestPatternConfig = (pattern: string) => {
    return TEST_PATTERNS[pattern as keyof typeof TEST_PATTERNS];
};

export const getBlockSizeBytes = (blockSize: string) => {
    return BLOCK_SIZES[blockSize as keyof typeof BLOCK_SIZES] || parseInt(blockSize);
};
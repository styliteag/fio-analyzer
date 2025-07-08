const path = require('path');

// Database configuration
const DB_PATH = path.resolve(__dirname, '../db/storage_performance.db');
const HTPASSWD_PATH = path.resolve(__dirname, '../.htpasswd');
const HTUPLOADERS_PATH = path.resolve(__dirname, '../.htuploaders');

// Server configuration
const PORT = 8000;

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FIO Analyzer API',
            version: '1.0.0',
            description: 'A comprehensive API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring',
            contact: {
                name: 'FIO Analyzer',
                url: 'https://github.com/fio-analyzer'
            }
        },
        components: {
            securitySchemes: {
                basicAuth: {
                    type: 'http',
                    scheme: 'basic'
                }
            },
            schemas: {
                TestRun: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'Test run ID' },
                        timestamp: { type: 'string', format: 'date-time', description: 'Test execution timestamp' },
                        test_date: { type: 'string', format: 'date-time', description: 'Test date from user input' },
                        drive_model: { type: 'string', description: 'Drive model name' },
                        drive_type: { type: 'string', description: 'Drive type (NVMe SSD, SATA SSD, HDD)' },
                        test_name: { type: 'string', description: 'Test name or identifier' },
                        block_size: { type: 'string', description: 'Block size (e.g., 4K, 64K, 1M)' },
                        read_write_pattern: { type: 'string', description: 'I/O pattern (read, write, randread, randwrite)' },
                        queue_depth: { type: 'integer', description: 'I/O queue depth' },
                        duration: { type: 'integer', description: 'Test duration in seconds' },
                        hostname: { type: 'string', description: 'Server hostname' },
                        protocol: { type: 'string', description: 'Storage protocol (Local, iSCSI, NFS, etc.)' },
                        description: { type: 'string', description: 'Test description' },
                        output_file: { type: 'string', description: 'FIO output filename' },
                        num_jobs: { type: 'integer', description: 'Number of parallel jobs' },
                        direct: { type: 'integer', description: 'Direct I/O flag (0 or 1)' },
                        test_size: { type: 'string', description: 'Test file size' },
                        sync: { type: 'integer', description: 'Sync flag (0 or 1)' },
                        iodepth: { type: 'integer', description: 'I/O depth' },
                        is_latest: { type: 'integer', description: 'Latest test flag (0 or 1)' }
                    }
                },
                PerformanceMetric: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'Metric ID' },
                        test_run_id: { type: 'integer', description: 'Associated test run ID' },
                        metric_type: { type: 'string', description: 'Metric type (iops, avg_latency, bandwidth)' },
                        value: { type: 'number', description: 'Metric value' },
                        unit: { type: 'string', description: 'Measurement unit' },
                        operation_type: { type: 'string', description: 'Operation type (read, write, combined)' }
                    }
                },
                ServerInfo: {
                    type: 'object',
                    properties: {
                        hostname: { type: 'string', description: 'Server hostname' },
                        protocol: { type: 'string', description: 'Storage protocol' },
                        drive_model: { type: 'string', description: 'Drive model' },
                        test_count: { type: 'integer', description: 'Total number of tests' },
                        last_test_time: { type: 'string', format: 'date-time', description: 'Most recent test timestamp' },
                        first_test_time: { type: 'string', format: 'date-time', description: 'First test timestamp' }
                    }
                },
                TrendData: {
                    type: 'object',
                    properties: {
                        timestamp: { type: 'string', format: 'date-time', description: 'Test timestamp' },
                        block_size: { type: 'string', description: 'Block size' },
                        read_write_pattern: { type: 'string', description: 'Test pattern' },
                        queue_depth: { type: 'integer', description: 'Queue depth' },
                        value: { type: 'number', description: 'Metric value' },
                        unit: { type: 'string', description: 'Unit of measurement' },
                        moving_avg: { type: 'number', description: '3-point moving average' },
                        percent_change: { type: 'string', description: 'Percentage change from previous value' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', description: 'Error message' }
                    }
                }
            }
        },
        security: [
            {
                basicAuth: []
            }
        ]
    },
    apis: ['./routes/*.js'] // Path to the API docs
};

module.exports = {
    DB_PATH,
    HTPASSWD_PATH,
    HTUPLOADERS_PATH,
    PORT,
    swaggerOptions
};

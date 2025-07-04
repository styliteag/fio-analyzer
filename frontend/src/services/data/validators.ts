// Data validation utilities

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface FieldValidation {
    field: string;
    value: any;
    rules: ValidationRule[];
}

export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
    value?: any;
    message: string;
    validator?: (value: any) => boolean;
}

// Validate performance data structure
export const validatePerformanceData = (data: any[]): ValidationResult => {
    const errors: string[] = [];
    
    if (!Array.isArray(data)) {
        return { valid: false, errors: ['Data must be an array'] };
    }

    data.forEach((item, index) => {
        if (!item.id || typeof item.id !== 'number') {
            errors.push(`Item ${index}: ID is required and must be a number`);
        }

        if (!item.test_name || typeof item.test_name !== 'string') {
            errors.push(`Item ${index}: test_name is required and must be a string`);
        }

        if (!item.metrics || typeof item.metrics !== 'object') {
            errors.push(`Item ${index}: metrics object is required`);
        } else {
            const metricsValidation = validateMetrics(item.metrics);
            if (!metricsValidation.valid) {
                errors.push(`Item ${index}: ${metricsValidation.errors.join(', ')}`);
            }
        }

        if (!item.timestamp) {
            errors.push(`Item ${index}: timestamp is required`);
        } else if (isNaN(new Date(item.timestamp).getTime())) {
            errors.push(`Item ${index}: invalid timestamp format`);
        }
    });

    return { valid: errors.length === 0, errors };
};

// Validate metrics object
export const validateMetrics = (metrics: Record<string, any>): ValidationResult => {
    const errors: string[] = [];
    const validMetricTypes = ['iops', 'avg_latency', 'bandwidth', 'p95_latency', 'p99_latency'];

    Object.entries(metrics).forEach(([key, metric]) => {
        if (!validMetricTypes.includes(key)) {
            errors.push(`Unknown metric type: ${key}`);
        }

        if (!metric || typeof metric !== 'object') {
            errors.push(`Metric ${key}: must be an object`);
            return;
        }

        if (typeof metric.value !== 'number' || metric.value < 0) {
            errors.push(`Metric ${key}: value must be a non-negative number`);
        }

        if (!metric.unit || typeof metric.unit !== 'string') {
            errors.push(`Metric ${key}: unit is required and must be a string`);
        }
    });

    return { valid: errors.length === 0, errors };
};

// Validate test run data
export const validateTestRun = (testRun: any): ValidationResult => {
    const validationFields: FieldValidation[] = [
        {
            field: 'id',
            value: testRun.id,
            rules: [
                { type: 'required', message: 'ID is required' },
                { type: 'custom', message: 'ID must be a positive number', validator: (v) => typeof v === 'number' && v > 0 }
            ]
        },
        {
            field: 'test_name',
            value: testRun.test_name,
            rules: [
                { type: 'required', message: 'Test name is required' },
                { type: 'min', value: 1, message: 'Test name cannot be empty' }
            ]
        },
        {
            field: 'drive_model',
            value: testRun.drive_model,
            rules: [
                { type: 'required', message: 'Drive model is required' }
            ]
        },
        {
            field: 'drive_type',
            value: testRun.drive_type,
            rules: [
                { type: 'required', message: 'Drive type is required' },
                { type: 'custom', message: 'Invalid drive type', validator: (v) => ['HDD', 'NVMe SSD', 'SATA SSD', 'Optane'].includes(v) }
            ]
        },
        {
            field: 'hostname',
            value: testRun.hostname,
            rules: [
                { type: 'required', message: 'Hostname is required' }
            ]
        },
        {
            field: 'protocol',
            value: testRun.protocol,
            rules: [
                { type: 'required', message: 'Protocol is required' }
            ]
        }
    ];

    const errors = validateFields(validationFields);
    return { valid: errors.length === 0, errors };
};

// Generic field validation
export const validateFields = (fields: FieldValidation[]): string[] => {
    const errors: string[] = [];

    fields.forEach(({ field, value, rules }) => {
        rules.forEach(rule => {
            switch (rule.type) {
                case 'required':
                    if (value === null || value === undefined || value === '') {
                        errors.push(`${field}: ${rule.message}`);
                    }
                    break;

                case 'min':
                    if (typeof value === 'string' && value.length < rule.value) {
                        errors.push(`${field}: ${rule.message}`);
                    } else if (typeof value === 'number' && value < rule.value) {
                        errors.push(`${field}: ${rule.message}`);
                    }
                    break;

                case 'max':
                    if (typeof value === 'string' && value.length > rule.value) {
                        errors.push(`${field}: ${rule.message}`);
                    } else if (typeof value === 'number' && value > rule.value) {
                        errors.push(`${field}: ${rule.message}`);
                    }
                    break;

                case 'pattern':
                    if (typeof value === 'string' && rule.value instanceof RegExp && !rule.value.test(value)) {
                        errors.push(`${field}: ${rule.message}`);
                    }
                    break;

                case 'custom':
                    if (rule.validator && !rule.validator(value)) {
                        errors.push(`${field}: ${rule.message}`);
                    }
                    break;
            }
        });
    });

    return errors;
};

// Validate chart configuration
export const validateChartConfig = (config: any): ValidationResult => {
    const errors: string[] = [];

    if (!config.xAxis || typeof config.xAxis !== 'string') {
        errors.push('X-axis configuration is required');
    }

    if (!config.yMetric || typeof config.yMetric !== 'string') {
        errors.push('Y-metric configuration is required');
    }

    if (config.testRunIds && !Array.isArray(config.testRunIds)) {
        errors.push('Test run IDs must be an array');
    }

    if (config.testRunIds && config.testRunIds.some((id: any) => typeof id !== 'number')) {
        errors.push('All test run IDs must be numbers');
    }

    return { valid: errors.length === 0, errors };
};

// Validate date ranges
export const validateDateRange = (startDate?: string, endDate?: string): ValidationResult => {
    const errors: string[] = [];

    if (startDate && isNaN(new Date(startDate).getTime())) {
        errors.push('Invalid start date format');
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
        errors.push('Invalid end date format');
    }

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
            errors.push('Start date must be before end date');
        }

        // Check for reasonable date range (not more than 2 years)
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 730) {
            errors.push('Date range cannot exceed 2 years');
        }
    }

    return { valid: errors.length === 0, errors };
};

// Validate filter values
export const validateFilters = (filters: Record<string, any>): ValidationResult => {
    const errors: string[] = [];
    const allowedFilterKeys = [
        'drive_type', 'drive_model', 'hostname', 'protocol', 
        'block_size', 'pattern', 'test_name'
    ];

    Object.keys(filters).forEach(key => {
        if (!allowedFilterKeys.includes(key)) {
            errors.push(`Unknown filter key: ${key}`);
        }
    });

    return { valid: errors.length === 0, errors };
};

// Validate numeric range
export const validateNumericRange = (
    value: number,
    min?: number,
    max?: number,
    fieldName: string = 'Value'
): ValidationResult => {
    const errors: string[] = [];

    if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`${fieldName} must be a valid number`);
        return { valid: false, errors };
    }

    if (min !== undefined && value < min) {
        errors.push(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && value > max) {
        errors.push(`${fieldName} must be at most ${max}`);
    }

    return { valid: errors.length === 0, errors };
};

// Validate array of unique values
export const validateUniqueArray = (values: any[], fieldName: string = 'Values'): ValidationResult => {
    const errors: string[] = [];

    if (!Array.isArray(values)) {
        errors.push(`${fieldName} must be an array`);
        return { valid: false, errors };
    }

    const uniqueValues = new Set(values);
    if (uniqueValues.size !== values.length) {
        errors.push(`${fieldName} must contain unique values`);
    }

    return { valid: errors.length === 0, errors };
};
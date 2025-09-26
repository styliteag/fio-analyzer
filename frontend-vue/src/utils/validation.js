// TestRun validation
export function validateTestRun(testRun) {
    if (!testRun || typeof testRun !== 'object')
        return false;
    const data = testRun;
    // Required fields validation
    const requiredFields = [
        'id', 'timestamp', 'hostname', 'drive_model', 'drive_type',
        'test_name', 'block_size', 'read_write_pattern', 'queue_depth',
        'duration', 'iops', 'avg_latency', 'bandwidth'
    ];
    for (const field of requiredFields) {
        if (!(field in data) || data[field] === null || data[field] === undefined) {
            return false;
        }
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
    // Value range validation
    const validBlockSizes = ['1K', '2K', '4K', '8K', '16K', '32K', '64K', '128K', '1M', '2M', '4M'];
    if (!validBlockSizes.includes(data.block_size))
        return false;
    const validPatterns = ['randread', 'randwrite', 'read', 'write', 'rw', 'randrw'];
    if (!validPatterns.includes(data.read_write_pattern))
        return false;
    const validDriveTypes = ['NVMe', 'SATA', 'SAS', 'SCSI'];
    if (!validDriveTypes.includes(data.drive_type))
        return false;
    const validProtocols = ['Local', 'iSCSI', 'NFS', 'SMB', 'Fiber Channel'];
    if (data.protocol && typeof data.protocol === 'string' && !validProtocols.includes(data.protocol))
        return false;
    return true;
}
// User account validation
export function validateUserAccount(user) {
    if (!user || typeof user !== 'object')
        return false;
    const data = user;
    // Required fields
    if (typeof data.username !== 'string' || data.username.trim() === '')
        return false;
    if (!['admin', 'uploader'].includes(data.role))
        return false;
    // Optional fields
    if (data.permissions && !Array.isArray(data.permissions))
        return false;
    if (data.created_at && typeof data.created_at !== 'string')
        return false;
    if (data.last_login && typeof data.last_login !== 'string')
        return false;
    // Validate permissions structure
    if (data.permissions) {
        for (const permission of data.permissions) {
            if (!permission || typeof permission !== 'object')
                return false;
            const perm = permission;
            if (typeof perm.resource !== 'string')
                return false;
            if (!Array.isArray(perm.actions))
                return false;
            if (!perm.actions.every((action) => typeof action === 'string'))
                return false;
        }
    }
    return true;
}
// Login credentials validation
export function validateLoginCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object')
        return false;
    const data = credentials;
    if (typeof data.username !== 'string' || data.username.trim() === '')
        return false;
    if (typeof data.password !== 'string' || data.password.trim() === '')
        return false;
    // Basic length validation
    if (data.username.length < 3)
        return false;
    if (data.password.length < 6)
        return false;
    return true;
}
// Filter state validation
export function validateFilterState(filters) {
    if (!filters || typeof filters !== 'object')
        return false;
    const filterKeys = [
        'selectedBlockSizes', 'selectedPatterns', 'selectedQueueDepths',
        'selectedNumJobs', 'selectedProtocols', 'selectedHostDiskCombinations'
    ];
    const filtersObj = filters;
    for (const key of filterKeys) {
        if (filtersObj[key] !== undefined) {
            if (!Array.isArray(filtersObj[key]))
                return false;
            if (!filtersObj[key].every((item) => typeof item === 'string' || typeof item === 'number'))
                return false;
        }
    }
    return true;
}
// API response validation
export function validateApiResponse(data, validator) {
    if (!Array.isArray(data))
        return false;
    return data.every(validator);
}
export function validateRequired(value, fieldName) {
    const isValid = value !== null && value !== undefined && String(value).trim() !== '';
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} is required` }
    };
}
export function validateMinLength(value, minLength, fieldName) {
    const isValid = typeof value === 'string' && value.length >= minLength;
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} must be at least ${minLength} characters` }
    };
}
export function validateMaxLength(value, maxLength, fieldName) {
    const isValid = typeof value === 'string' && value.length <= maxLength;
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} must be no more than ${maxLength} characters` }
    };
}
export function validateEmail(value, fieldName) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = typeof value === 'string' && emailRegex.test(value);
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} must be a valid email address` }
    };
}
export function validateNumeric(value, fieldName) {
    const num = Number(value);
    const isValid = !isNaN(num) && isFinite(num);
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} must be a valid number` }
    };
}
export function validateRange(value, min, max, fieldName) {
    const isValid = typeof value === 'number' && value >= min && value <= max;
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} must be between ${min} and ${max}` }
    };
}
export function validateInList(value, allowedValues, fieldName) {
    const isValid = allowedValues.includes(value);
    return {
        isValid,
        errors: isValid ? {} : { [fieldName]: `${fieldName} must be one of: ${allowedValues.join(', ')}` }
    };
}
// Combine multiple validations
export function combineValidations(...validations) {
    const combined = {
        isValid: true,
        errors: {}
    };
    for (const validation of validations) {
        combined.isValid = combined.isValid && validation.isValid;
        Object.assign(combined.errors, validation.errors);
    }
    return combined;
}
// User creation validation
export function validateUserCreation(data) {
    return combineValidations(validateRequired(data.username, 'Username'), validateMinLength(data.username, 3, 'Username'), validateMaxLength(data.username, 50, 'Username'), validateRequired(data.password, 'Password'), validateMinLength(data.password, 8, 'Password'), validateRequired(data.role, 'Role'), validateInList(data.role, ['admin', 'uploader'], 'Role'));
}
// Test run upload validation
export function validateTestRunUpload(data) {
    const validations = [];
    if (data.file) {
        // File validation
        if (data.file.size > 50 * 1024 * 1024) { // 50MB limit
            validations.push({
                isValid: false,
                errors: { file: 'File size must be less than 50MB' }
            });
        }
        if (!data.file.name.endsWith('.json')) {
            validations.push({
                isValid: false,
                errors: { file: 'File must be a JSON file' }
            });
        }
    }
    else if (data.content) {
        // Content validation
        try {
            JSON.parse(data.content);
        }
        catch {
            validations.push({
                isValid: false,
                errors: { content: 'Content must be valid JSON' }
            });
        }
    }
    else {
        validations.push({
            isValid: false,
            errors: { file: 'Either file or content is required' }
        });
    }
    return combineValidations(...validations);
}
// Filter parameters validation
export function validateFilterParams(params) {
    const validations = [];
    // Validate limit
    if (params.limit !== undefined) {
        validations.push(validateNumeric(params.limit, 'Limit'));
        if (typeof params.limit === 'number') {
            validations.push(validateRange(params.limit, 1, 10000, 'Limit'));
        }
    }
    // Validate offset
    if (params.offset !== undefined) {
        validations.push(validateNumeric(params.offset, 'Offset'));
        if (typeof params.offset === 'number') {
            validations.push(validateRange(params.offset, 0, 1000000, 'Offset'));
        }
    }
    return combineValidations(...validations);
}
// Sanitize input data
export function sanitizeString(input) {
    return input.trim().replace(/[<>]/g, '');
}
export function sanitizeNumeric(input) {
    const num = Number(input);
    return isNaN(num) ? null : num;
}
// Deep validation for complex objects
export function validateTestRuns(testRuns) {
    const valid = [];
    const invalid = [];
    testRuns.forEach(item => {
        if (validateTestRun(item)) {
            valid.push(item);
        }
        else {
            invalid.push(item);
        }
    });
    return { valid, invalid };
}
// Performance validation
export function validatePerformanceMetrics(metrics) {
    const validations = [];
    if (metrics.iops !== undefined) {
        validations.push(validateNumeric(metrics.iops, 'IOPS'));
        if (typeof metrics.iops === 'number') {
            validations.push(validateRange(metrics.iops, 0, 10000000, 'IOPS'));
        }
    }
    if (metrics.avg_latency !== undefined) {
        validations.push(validateNumeric(metrics.avg_latency, 'Average Latency'));
        if (typeof metrics.avg_latency === 'number') {
            validations.push(validateRange(metrics.avg_latency, 0, 1000, 'Average Latency'));
        }
    }
    if (metrics.bandwidth !== undefined) {
        validations.push(validateNumeric(metrics.bandwidth, 'Bandwidth'));
        if (typeof metrics.bandwidth === 'number') {
            validations.push(validateRange(metrics.bandwidth, 0, 100000, 'Bandwidth'));
        }
    }
    if (metrics.p95_latency !== undefined) {
        validations.push(validateNumeric(metrics.p95_latency, 'P95 Latency'));
        if (typeof metrics.p95_latency === 'number') {
            validations.push(validateRange(metrics.p95_latency, 0, 10000, 'P95 Latency'));
        }
    }
    if (metrics.p99_latency !== undefined) {
        validations.push(validateNumeric(metrics.p99_latency, 'P99 Latency'));
        if (typeof metrics.p99_latency === 'number') {
            validations.push(validateRange(metrics.p99_latency, 0, 10000, 'P99 Latency'));
        }
    }
    return combineValidations(...validations);
}

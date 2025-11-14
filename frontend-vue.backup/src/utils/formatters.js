// Date and time formatting utilities
// Date formatting
export function formatDate(date, format = 'medium', options = {}) {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }
    const { locale = 'en-US', timeZone = 'UTC' } = options;
    const formats = {
        short: { dateStyle: 'short', timeStyle: 'short' },
        medium: { dateStyle: 'medium', timeStyle: 'short' },
        long: { dateStyle: 'long', timeStyle: 'medium' },
        full: { dateStyle: 'full', timeStyle: 'medium' },
    };
    try {
        return new Intl.DateTimeFormat(locale, {
            ...formats[format],
            timeZone,
        }).format(dateObj);
    }
    catch {
        // Fallback for unsupported locales/timezones
        return dateObj.toLocaleString();
    }
}
export function formatDateOnly(date, format = 'medium', options = {}) {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }
    const { locale = 'en-US', timeZone = 'UTC' } = options;
    const formats = {
        short: { dateStyle: 'short' },
        medium: { dateStyle: 'medium' },
        long: { dateStyle: 'long' },
    };
    try {
        return new Intl.DateTimeFormat(locale, {
            ...formats[format],
            timeZone,
        }).format(dateObj);
    }
    catch {
        return dateObj.toLocaleDateString();
    }
}
export function formatTimeOnly(date, format = 'medium', options = {}) {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Time';
    }
    const { locale = 'en-US', timeZone = 'UTC' } = options;
    const formats = {
        short: { timeStyle: 'short' },
        medium: { timeStyle: 'medium' },
        long: { timeStyle: 'long' },
    };
    try {
        return new Intl.DateTimeFormat(locale, {
            ...formats[format],
            timeZone,
        }).format(dateObj);
    }
    catch {
        return dateObj.toLocaleTimeString();
    }
}
// Relative time formatting
export function formatRelativeTime(date) {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const isPast = diffMs > 0;
    const suffix = isPast ? 'ago' : 'from now';
    if (diffSeconds < 60) {
        return isPast ? 'just now' : 'in a few seconds';
    }
    if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ${suffix}`;
    }
    if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${suffix}`;
    }
    if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ${suffix}`;
    }
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks !== 1 ? 's' : ''} ${suffix}`;
    }
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months !== 1 ? 's' : ''} ${suffix}`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''} ${suffix}`;
}
// Duration formatting
export function formatDuration(milliseconds, format = 'short') {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (format === 'long') {
        const parts = [];
        if (days > 0)
            parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours % 24 > 0)
            parts.push(`${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`);
        if (minutes % 60 > 0)
            parts.push(`${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`);
        if (seconds % 60 > 0)
            parts.push(`${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`);
        return parts.length > 0 ? parts.join(', ') : '0 seconds';
    }
    else {
        // Short format
        if (days > 0)
            return `${days}d ${hours % 24}h`;
        if (hours > 0)
            return `${hours}h ${minutes % 60}m`;
        if (minutes > 0)
            return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}
// Number formatting
export function formatNumber(value, options = {}) {
    const { locale = 'en-US', minimumFractionDigits = 0, maximumFractionDigits = 2, useGrouping = true, } = options;
    try {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits,
            maximumFractionDigits,
            useGrouping,
        }).format(value);
    }
    catch {
        return value.toLocaleString();
    }
}
// Performance metrics formatting
export function formatIOPS(value) {
    return formatNumber(value, { maximumFractionDigits: 0, useGrouping: true });
}
export function formatLatency(value) {
    if (value >= 1) {
        return formatNumber(value, { maximumFractionDigits: 2 }) + ' ms';
    }
    else if (value >= 0.001) {
        return formatNumber(value * 1000, { maximumFractionDigits: 2 }) + ' μs';
    }
    else {
        return formatNumber(value * 1000000, { maximumFractionDigits: 2 }) + ' ns';
    }
}
export function formatBandwidth(value) {
    if (value >= 1000) {
        return formatNumber(value / 1000, { maximumFractionDigits: 2 }) + ' GB/s';
    }
    else {
        return formatNumber(value, { maximumFractionDigits: 2 }) + ' MB/s';
    }
}
export function formatPercentage(value, decimals = 1) {
    return formatNumber(value, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }) + '%';
}
export function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return formatNumber(size, { maximumFractionDigits: 2 }) + ' ' + units[unitIndex];
}
// Queue depth formatting
export function formatQueueDepth(value) {
    return `QD${value}`;
}
// Job count formatting
export function formatJobCount(value) {
    return `${value} job${value !== 1 ? 's' : ''}`;
}
// Test size formatting
export function formatTestSize(value) {
    // Convert values like "10G" to "10 GB"
    const match = value.match(/^(\d+)([KMGT])$/);
    if (match) {
        const [, num, unit] = match;
        const unitMap = {
            'K': 'KB',
            'M': 'MB',
            'G': 'GB',
            'T': 'TB',
        };
        return `${num} ${unitMap[unit] || unit}`;
    }
    return value;
}
// Hostname formatting
export function formatHostname(hostname) {
    // Capitalize first letter, replace underscores with spaces
    return hostname
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
// Drive model formatting
export function formatDriveModel(model) {
    // Clean up drive model names
    return model
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
// Block size formatting
export function formatBlockSize(size) {
    return size;
}
// Pattern formatting
export function formatPattern(pattern) {
    const patternMap = {
        'randread': 'Random Read',
        'randwrite': 'Random Write',
        'read': 'Sequential Read',
        'write': 'Sequential Write',
        'rw': 'Read/Write Mix',
        'randrw': 'Random Read/Write',
    };
    return patternMap[pattern] || pattern;
}
// Protocol formatting
export function formatProtocol(protocol) {
    const protocolMap = {
        'Local': 'Local',
        'iSCSI': 'iSCSI',
        'NFS': 'NFS',
        'SMB': 'SMB/CIFS',
        'Fiber Channel': 'FC',
    };
    return protocolMap[protocol] || protocol;
}
// Drive type formatting
export function formatDriveType(type) {
    return type.toUpperCase();
}
// Status formatting
export function formatStatus(status) {
    const statusMap = {
        'online': 'Online',
        'offline': 'Offline',
        'degraded': 'Degraded',
        'unknown': 'Unknown',
    };
    return statusMap[status.toLowerCase()] || status;
}
// Boolean formatting
export function formatBoolean(value) {
    if (typeof value === 'number') {
        return value === 1 ? 'Yes' : 'No';
    }
    return value ? 'Yes' : 'No';
}
// List formatting
export function formatList(items, maxItems = 3) {
    if (items.length <= maxItems) {
        return items.join(', ');
    }
    const shown = items.slice(0, maxItems);
    const remaining = items.length - maxItems;
    return `${shown.join(', ')} +${remaining} more`;
}
// ID formatting
export function formatId(id) {
    return String(id).padStart(6, '0');
}
// Summary formatting for complex objects
export function formatTestRunSummary(run) {
    return `${run.hostname} - ${run.drive_model} - ${run.block_size} - ${formatPattern(run.read_write_pattern).toLowerCase()}`;
}
export function formatPerformanceSummary(stats) {
    return `${formatIOPS(stats.avgIops)} IOPS, ${formatLatency(stats.avgLatency)} latency, ${formatBandwidth(stats.avgBandwidth)}`;
}

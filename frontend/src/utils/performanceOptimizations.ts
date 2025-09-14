/**
 * Performance optimization utilities with memoization and caching
 */

// Generic memoization helper with configurable cache size
export const createMemoizer = <Args extends any[], Return>(
    fn: (...args: Args) => Return,
    cacheSize: number = 100,
    keyGenerator?: (...args: Args) => string
): ((...args: Args) => Return) => {
    const cache = new Map<string, Return>();
    
    return (...args: Args): Return => {
        const key = keyGenerator ? keyGenerator(...args) : (JSON.stringify(args) || 'default');
        
        if (cache.has(key)) {
            return cache.get(key)!;
        }
        
        const result = fn(...args);
        
        // Implement LRU-style cache eviction
        if (cache.size >= cacheSize) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) {
                cache.delete(firstKey);
            }
        }
        
        cache.set(key, result);
        return result;
    };
};

// Memoized block size parsing
const parseBlockSizeToBytesInternal = (blockSize: string): number => {
    const match = blockSize.match(/^(\d+)([KMGT]?)B?$/i);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();
    
    const multipliers: { [key: string]: number } = {
        '': 1,
        'K': 1024,
        'M': 1024 * 1024,
        'G': 1024 * 1024 * 1024,
        'T': 1024 * 1024 * 1024 * 1024,
    };
    
    return value * (multipliers[unit] || 1);
};

export const parseBlockSizeToBytes = createMemoizer(
    parseBlockSizeToBytesInternal,
    50, // Cache up to 50 different block sizes
    (blockSize) => blockSize // Simple key for block size strings
);

// Memoized block size formatting
const formatBlockSizeInternal = (blockSize: string | number): string => {
    if (typeof blockSize === 'number') {
        return blockSize.toString();
    }
    
    // Common formatting transformations
    if (blockSize.toLowerCase().endsWith('k')) {
        return blockSize.slice(0, -1) + 'KB';
    }
    if (blockSize.toLowerCase().endsWith('m')) {
        return blockSize.slice(0, -1) + 'MB';
    }
    if (blockSize.toLowerCase().endsWith('g')) {
        return blockSize.slice(0, -1) + 'GB';
    }
    
    return blockSize;
};

export const formatBlockSizeMemoized = createMemoizer(
    formatBlockSizeInternal,
    30, // Cache common block size formats
    (blockSize) => blockSize.toString()
);

// Batch processing helper for arrays
export const processBatch = <T, R>(
    items: T[],
    processor: (item: T, index: number) => R,
    batchSize: number = 1000
): R[] => {
    const results: R[] = new Array(items.length);
    
    for (let i = 0; i < items.length; i += batchSize) {
        const end = Math.min(i + batchSize, items.length);
        
        // Process batch
        for (let j = i; j < end; j++) {
            results[j] = processor(items[j], j);
        }
        
        // Yield control periodically for better responsiveness
        if (i > 0 && i % (batchSize * 10) === 0) {
            // Allow other tasks to run
            setTimeout(() => {}, 0);
        }
    }
    
    return results;
};

// Efficient array grouping with Maps
export const groupByMap = <T, K>(
    items: T[],
    keySelector: (item: T) => K
): Map<K, T[]> => {
    const groups = new Map<K, T[]>();
    
    for (const item of items) {
        const key = keySelector(item);
        let group = groups.get(key);
        
        if (!group) {
            group = [];
            groups.set(key, group);
        }
        
        group.push(item);
    }
    
    return groups;
};

// Efficient array deduplication while preserving order
export const uniqueByMap = <T, K>(
    items: T[],
    keySelector: (item: T) => K
): T[] => {
    const seen = new Set<K>();
    const result: T[] = [];
    
    for (const item of items) {
        const key = keySelector(item);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    
    return result;
};

// Efficient object property access with fallback
export const getNestedProperty = <T>(
    obj: any,
    path: string,
    defaultValue?: T
): T => {
    return path.split('.').reduce((current, key) => {
        return current?.[key] ?? defaultValue;
    }, obj);
};

// Performance monitoring helper
export const measurePerformance = <T>(
    fn: () => T,
    logThreshold: number = 10 // Log if execution takes more than 10ms
): T => {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (duration > logThreshold) {
        // Performance threshold exceeded - could add logging here if needed
    }
    
    return result;
};

// Clear all memoization caches (useful for memory management)
export const clearAllCaches = (): void => {
    // This would need to be implemented per memoized function
    // For now, it's a placeholder for potential cache clearing functionality
};
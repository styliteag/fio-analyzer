// Configuration services barrel export
export * from './chartTemplates';
export * from './constants';
export * from './theme';

// Re-export commonly used configurations
export {
    chartTemplates,
    chartConfig,
    sortOptions,
    groupByOptions,
    getTemplateById,
    getTemplatesByType,
    getAllMetrics,
} from './chartTemplates';

export {
    METRIC_TYPES,
    DRIVE_TYPES,
    PROTOCOL_TYPES,
    TEST_PATTERNS,
    BLOCK_SIZES,
    TIME_RANGES,
    API_CONFIG,
    UPLOAD_CONSTRAINTS,
    VALIDATION_RULES,
    UI_CONFIG,
    APP_CONSTANTS,
    getMetricConfig,
    getDriveTypeConfig,
    getProtocolConfig,
    getTestPatternConfig,
    getBlockSizeBytes,
} from './constants';

export {
    lightTheme,
    darkTheme,
    themes,
    componentThemes,
    getTheme,
    getComponentTheme,
    applyCssVariables,
    getChartTheme,
    type Theme,
    type ThemeName,
} from './theme';

// Application configuration object
export const appConfig = {
    // API settings
    api: API_CONFIG,
    
    // UI settings  
    ui: UI_CONFIG,
    
    // Validation rules
    validation: VALIDATION_RULES,
    
    // Upload constraints
    upload: UPLOAD_CONSTRAINTS,
    
    // Default chart settings
    charts: {
        defaultTemplate: 'performance-overview',
        defaultMetrics: ['iops', 'avg_latency', 'bandwidth'],
        colors: chartConfig.colors.primary,
        options: chartConfig,
    },
    
    // Default theme
    theme: {
        default: 'light' as ThemeName,
        storageKey: 'fio-analyzer-theme',
    },
    
    // Feature flags
    features: {
        enableTimeSeriesMonitoring: true,
        enable3DCharts: true,
        enableBulkEdit: true,
        enableExport: true,
        enableThemeToggle: true,
        enableAdvancedFiltering: true,
    },
    
    // Performance settings
    performance: {
        chartRefreshInterval: 30000, // 30 seconds
        maxDataPoints: 1000,
        virtualScrolling: true,
        lazyLoading: true,
    },
    
    // Development settings
    development: {
        enableDebugLogs: process.env.NODE_ENV === 'development',
        enableDevTools: process.env.NODE_ENV === 'development',
        mockApi: false,
    },
} as const;

// Environment-specific configuration
export const getEnvironmentConfig = () => {
    const env = process.env.NODE_ENV || 'development';
    
    return {
        isDevelopment: env === 'development',
        isProduction: env === 'production',
        isTest: env === 'test',
        apiBaseUrl: API_CONFIG.baseURL,
        enableDebugMode: env === 'development',
        enableHotReload: env === 'development',
    };
};

// Configuration validation
export const validateConfig = () => {
    const errors: string[] = [];
    
    // Validate API configuration
    if (!API_CONFIG.baseURL && process.env.NODE_ENV === 'development') {
        console.warn('API base URL not configured for development');
    }
    
    // Validate chart templates
    if (chartTemplates.length === 0) {
        errors.push('No chart templates configured');
    }
    
    // Validate metric types
    const requiredMetrics = ['iops', 'avg_latency', 'bandwidth'];
    const availableMetrics = Object.keys(METRIC_TYPES);
    const missingMetrics = requiredMetrics.filter(
        metric => !availableMetrics.includes(metric)
    );
    
    if (missingMetrics.length > 0) {
        errors.push(`Missing required metrics: ${missingMetrics.join(', ')}`);
    }
    
    if (errors.length > 0) {
        console.error('Configuration validation errors:', errors);
        return false;
    }
    
    return true;
};

// Initialize configuration
export const initializeConfig = () => {
    // Validate configuration
    const isValid = validateConfig();
    
    if (!isValid) {
        console.error('Configuration validation failed');
    }
    
    // Apply default theme
    const savedTheme = localStorage.getItem(appConfig.theme.storageKey) as ThemeName;
    const initialTheme = savedTheme || appConfig.theme.default;
    applyCssVariables(initialTheme);
    
    // Log configuration in development
    if (appConfig.development.enableDebugLogs) {
        console.log('FIO Analyzer Configuration:', {
            environment: getEnvironmentConfig(),
            features: appConfig.features,
            theme: initialTheme,
            api: appConfig.api,
        });
    }
    
    return isValid;
};
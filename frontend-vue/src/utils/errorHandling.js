// Create structured error objects
export function createError(category, message, details, context) {
    return {
        category,
        message,
        userMessage: createUserFriendlyMessage(category),
        details,
        timestamp: new Date().toISOString(),
        context,
    };
}
// Classify errors by type
export function classifyError(error) {
    // Network errors
    if (!navigator.onLine)
        return 'network';
    const errorObj = error;
    if (errorObj?.code === 'NETWORK_ERROR' || errorObj?.message?.includes('fetch'))
        return 'network';
    // Authentication errors
    if (errorObj?.status === 401 || errorObj?.response?.status === 401)
        return 'authentication';
    if (errorObj?.message?.includes('unauthorized'))
        return 'authentication';
    // Validation errors
    if (errorObj?.status === 400 || errorObj?.response?.status === 400)
        return 'validation';
    if (errorObj?.message?.includes('validation'))
        return 'validation';
    // Not found errors
    if (errorObj?.status === 404 || errorObj?.response?.status === 404)
        return 'not_found';
    // Rate limit errors
    if (errorObj?.status === 429 || errorObj?.response?.status === 429)
        return 'rate_limit';
    // Server errors
    if (errorObj?.status >= 500 || errorObj?.response?.status >= 500)
        return 'server';
    // Default to unknown
    return 'unknown';
}
// Log errors with appropriate levels
export function logError(error) {
    const logData = {
        category: error.category,
        message: error.message,
        timestamp: error.timestamp,
        context: error.context,
        details: error.details,
    };
    switch (error.category) {
        case 'server':
        case 'network':
            console.error('[ERROR]', logData);
            break;
        case 'authentication':
        case 'validation':
            console.warn('[WARN]', logData);
            break;
        default:
            console.log('[INFO]', logData);
    }
}
// Handle API errors with proper context
export function handleApiError(error) {
    const category = classifyError(error);
    const errorObj = error;
    const message = errorObj?.message || errorObj?.response?.data?.error || 'An error occurred';
    const details = {
        statusCode: errorObj?.status || errorObj?.response?.status,
        statusText: errorObj?.statusText || errorObj?.response?.statusText,
        data: errorObj?.response?.data,
    };
    const context = {
        url: errorObj?.config?.url,
        method: errorObj?.config?.method?.toUpperCase(),
        payload: errorObj?.config?.data,
    };
    return createError(category, message, details, context);
}
// Format error messages for user display
export function formatErrorMessage(error) {
    return error.userMessage || error.message;
}
// Determine if errors are retryable
export function isRetryableError(error) {
    switch (error.category) {
        case 'network':
        case 'server':
            return true;
        case 'rate_limit':
            // Rate limit errors can be retried after a delay
            return true;
        case 'authentication':
        case 'validation':
        case 'not_found':
        case 'unknown':
        default:
            return false;
    }
}
// Extract detailed error information
export function getErrorDetails(error) {
    const details = error.details;
    const context = error.context;
    return {
        statusCode: typeof details?.statusCode === 'number' ? details.statusCode : undefined,
        requestId: typeof details?.requestId === 'string' ? details.requestId : context?.url?.match(/req-[a-zA-Z0-9]+/)?.[0],
        field: typeof details?.field === 'string' ? details.field : undefined,
        issue: typeof details?.issue === 'string' ? details.issue : undefined,
        url: context?.url,
        method: context?.method,
    };
}
// Create user-friendly error messages
export function createUserFriendlyMessage(category) {
    const messages = {
        network: 'Unable to connect to the server. Please check your internet connection.',
        authentication: 'Your session has expired. Please log in again.',
        validation: 'Please check your input and try again.',
        not_found: 'The requested item could not be found.',
        rate_limit: 'Too many requests. Please wait a moment before trying again.',
        server: 'The server encountered an error. Please try again later.',
        unknown: 'An unexpected error occurred. Please try again.',
    };
    return messages[category] || messages.unknown;
}
// Error recovery and cleanup utilities
export class ErrorManager {
    constructor() {
        Object.defineProperty(this, "errors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "displayedErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "consoleErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
    }
    addError(error) {
        this.errors.push(error);
        logError(error);
    }
    getErrors() {
        return [...this.errors];
    }
    getErrorsByCategory(category) {
        return this.errors.filter(error => error.category === category);
    }
    markAsDisplayed(errorId) {
        this.displayedErrors.add(errorId);
    }
    markAsLogged(errorId) {
        this.consoleErrors.add(errorId);
    }
    isDisplayed(errorId) {
        return this.displayedErrors.has(errorId);
    }
    isLogged(errorId) {
        return this.consoleErrors.has(errorId);
    }
    clearErrors() {
        this.errors = [];
        this.displayedErrors.clear();
        this.consoleErrors.clear();
    }
    clearErrorsByCategory(category) {
        this.errors = this.errors.filter(error => error.category !== category);
    }
    getErrorSummary() {
        const byCategory = {
            network: 0,
            authentication: 0,
            validation: 0,
            not_found: 0,
            rate_limit: 0,
            server: 0,
            unknown: 0,
        };
        this.errors.forEach(error => {
            byCategory[error.category]++;
        });
        // Get recent errors (last 10)
        const recent = this.errors
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);
        return {
            total: this.errors.length,
            byCategory,
            recent,
        };
    }
}
// Global error manager instance
export const errorManager = new ErrorManager();
// Handle cascading error scenarios
export function createCascadingError(errors, primaryMessage) {
    const primaryError = errors[0];
    const cascadeDetails = {
        cascade: true,
        primaryError: primaryError.message,
        totalErrors: errors.length,
        errorCategories: [...new Set(errors.map(e => e.category))],
        errors: errors.map(e => ({
            category: e.category,
            message: e.message,
            timestamp: e.timestamp,
        })),
    };
    return createError(primaryError.category, primaryMessage || `Multiple errors occurred: ${errors.length} issues found`, cascadeDetails, primaryError.context);
}
// Retry mechanism with exponential backoff
export function createRetryFunction(operation, maxRetries = 3, baseDelay = 1000) {
    return async () => {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const appError = handleApiError(error);
                if (!isRetryableError(appError) || attempt === maxRetries) {
                    throw error;
                }
                // Exponential backoff
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    };
}
// Error boundary helper for components
export function createErrorBoundary() {
    let error = null;
    let hasError = false;
    const setError = (err) => {
        error = err;
        hasError = true;
        errorManager.addError(err);
    };
    const clearError = () => {
        error = null;
        hasError = false;
    };
    const getError = () => error;
    const isError = () => hasError;
    return {
        setError,
        clearError,
        getError,
        isError,
    };
}
// Global error handler for unhandled errors
export function setupGlobalErrorHandler() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const error = createError('unknown', 'Unhandled promise rejection', { reason: event.reason }, { url: window.location.href });
        errorManager.addError(error);
    });
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
        const error = createError('unknown', event.message, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        }, { url: window.location.href });
        errorManager.addError(error);
    });
}
// Initialize global error handler
if (typeof window !== 'undefined') {
    setupGlobalErrorHandler();
}

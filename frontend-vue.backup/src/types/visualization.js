/**
 * Visualization Configuration Types
 * Based on data-model.md specifications
 */
// Default visualization configuration
export const defaultVisualizationConfig = {
    chartType: 'graphs',
    theme: 'system',
    height: 400,
    responsive: true,
    animations: true
};
// Utility functions
export function getChartTypeLabel(type) {
    const labels = {
        graphs: 'Performance Graphs',
        heatmap: 'Performance Heatmap',
        radar: 'Drive Radar Chart',
        scatter: 'Performance Scatter Plot',
        parallel: 'Parallel Coordinates'
    };
    return labels[type];
}
export function getThemeLabel(theme) {
    const labels = {
        light: 'Light',
        dark: 'Dark',
        system: 'System'
    };
    return labels[theme];
}
export function resolveActualTheme(theme) {
    if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
}
// Configuration validation
export function validateVisualizationConfig(config) {
    return (['graphs', 'heatmap', 'radar', 'scatter', 'parallel'].includes(config.chartType) &&
        ['light', 'dark', 'system'].includes(config.theme) &&
        typeof config.height === 'number' && config.height > 0 &&
        typeof config.responsive === 'boolean' &&
        typeof config.animations === 'boolean');
}
// Export configurations for different chart types
export function createDefaultConfigForType(type) {
    const base = { ...defaultVisualizationConfig, chartType: type };
    return base;
}

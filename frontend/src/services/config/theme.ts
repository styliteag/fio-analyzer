// Theme configuration and color schemes

// Color palette definitions
export const colorPalettes = {
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
    },
    secondary: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
    },
    success: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
    },
    warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
    },
    error: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
    },
} as const;

// Light theme configuration
export const lightTheme = {
    name: 'light',
    colors: {
        // Background colors
        background: {
            primary: '#ffffff',
            secondary: '#f8fafc',
            tertiary: '#f1f5f9',
            accent: '#e2e8f0',
        },
        // Text colors
        text: {
            primary: '#1e293b',
            secondary: '#475569',
            tertiary: '#64748b',
            accent: '#3b82f6',
            muted: '#94a3b8',
        },
        // Border colors
        border: {
            primary: '#e2e8f0',
            secondary: '#cbd5e1',
            accent: '#3b82f6',
            focus: '#60a5fa',
        },
        // Status colors
        status: {
            success: colorPalettes.success[500],
            warning: colorPalettes.warning[500],
            error: colorPalettes.error[500],
            info: colorPalettes.primary[500],
        },
        // Chart colors
        chart: {
            primary: [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
                '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
                '#ec4899', '#6b7280'
            ],
            grid: '#e2e8f0',
            axis: '#64748b',
            background: '#ffffff',
        },
    },
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    },
    borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
    },
} as const;

// Dark theme configuration
export const darkTheme = {
    name: 'dark',
    colors: {
        // Background colors
        background: {
            primary: '#0f172a',
            secondary: '#1e293b',
            tertiary: '#334155',
            accent: '#475569',
        },
        // Text colors
        text: {
            primary: '#f1f5f9',
            secondary: '#e2e8f0',
            tertiary: '#cbd5e1',
            accent: '#60a5fa',
            muted: '#94a3b8',
        },
        // Border colors
        border: {
            primary: '#334155',
            secondary: '#475569',
            accent: '#60a5fa',
            focus: '#93c5fd',
        },
        // Status colors
        status: {
            success: colorPalettes.success[400],
            warning: colorPalettes.warning[400],
            error: colorPalettes.error[400],
            info: colorPalettes.primary[400],
        },
        // Chart colors
        chart: {
            primary: [
                '#60a5fa', '#f87171', '#34d399', '#fbbf24',
                '#a78bfa', '#22d3ee', '#fb923c', '#a3e635',
                '#f472b6', '#9ca3af'
            ],
            grid: '#334155',
            axis: '#cbd5e1',
            background: '#1e293b',
        },
    },
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
    },
    borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
    },
} as const;

// Theme type definitions
export type Theme = typeof lightTheme;
export type ThemeName = 'light' | 'dark';

// Available themes
export const themes = {
    light: lightTheme,
    dark: darkTheme,
} as const;

// CSS custom property mappings for themes
export const cssVariables = {
    light: {
        '--color-bg-primary': lightTheme.colors.background.primary,
        '--color-bg-secondary': lightTheme.colors.background.secondary,
        '--color-bg-tertiary': lightTheme.colors.background.tertiary,
        '--color-text-primary': lightTheme.colors.text.primary,
        '--color-text-secondary': lightTheme.colors.text.secondary,
        '--color-border-primary': lightTheme.colors.border.primary,
        '--shadow-md': lightTheme.shadows.md,
    },
    dark: {
        '--color-bg-primary': darkTheme.colors.background.primary,
        '--color-bg-secondary': darkTheme.colors.background.secondary,
        '--color-bg-tertiary': darkTheme.colors.background.tertiary,
        '--color-text-primary': darkTheme.colors.text.primary,
        '--color-text-secondary': darkTheme.colors.text.secondary,
        '--color-border-primary': darkTheme.colors.border.primary,
        '--shadow-md': darkTheme.shadows.md,
    },
} as const;

// Component-specific theme configurations
export const componentThemes = {
    button: {
        variants: {
            primary: {
                light: {
                    background: colorPalettes.primary[500],
                    color: '#ffffff',
                    hover: colorPalettes.primary[600],
                },
                dark: {
                    background: colorPalettes.primary[600],
                    color: '#ffffff',
                    hover: colorPalettes.primary[500],
                },
            },
            secondary: {
                light: {
                    background: 'transparent',
                    color: colorPalettes.primary[500],
                    border: colorPalettes.primary[500],
                    hover: colorPalettes.primary[50],
                },
                dark: {
                    background: 'transparent',
                    color: colorPalettes.primary[400],
                    border: colorPalettes.primary[400],
                    hover: colorPalettes.primary[900],
                },
            },
        },
    },
    card: {
        light: {
            background: '#ffffff',
            border: colorPalettes.secondary[200],
            shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        },
        dark: {
            background: darkTheme.colors.background.secondary,
            border: darkTheme.colors.border.primary,
            shadow: '0 1px 3px 0 rgb(0 0 0 / 0.3)',
        },
    },
    chart: {
        light: {
            backgroundColor: '#ffffff',
            gridColor: colorPalettes.secondary[200],
            textColor: colorPalettes.secondary[700],
            tooltipBackground: colorPalettes.secondary[800],
            tooltipText: '#ffffff',
        },
        dark: {
            backgroundColor: darkTheme.colors.background.secondary,
            gridColor: darkTheme.colors.border.primary,
            textColor: darkTheme.colors.text.secondary,
            tooltipBackground: darkTheme.colors.background.tertiary,
            tooltipText: darkTheme.colors.text.primary,
        },
    },
} as const;

// Utility functions
export const getTheme = (themeName: ThemeName): Theme => {
    return themes[themeName] as Theme;
};

export const getComponentTheme = (component: keyof typeof componentThemes, theme: ThemeName) => {
    const componentConfig = componentThemes[component];
    return componentConfig[theme as keyof typeof componentConfig];
};

export const applyCssVariables = (themeName: ThemeName) => {
    const variables = cssVariables[themeName];
    const root = document.documentElement;
    
    Object.entries(variables).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
};

// Chart.js theme configuration
export const getChartTheme = (themeName: ThemeName) => {
    const theme = getTheme(themeName);
    const chartTheme = componentThemes.chart[themeName];
    
    return {
        backgroundColor: chartTheme.backgroundColor,
        color: chartTheme.textColor,
        plugins: {
            legend: {
                labels: {
                    color: chartTheme.textColor,
                },
            },
            tooltip: {
                backgroundColor: chartTheme.tooltipBackground,
                titleColor: chartTheme.tooltipText,
                bodyColor: chartTheme.tooltipText,
                borderColor: theme.colors.border.primary,
            },
        },
        scales: {
            x: {
                grid: {
                    color: chartTheme.gridColor,
                },
                ticks: {
                    color: chartTheme.textColor,
                },
            },
            y: {
                grid: {
                    color: chartTheme.gridColor,
                },
                ticks: {
                    color: chartTheme.textColor,
                },
            },
        },
    };
};
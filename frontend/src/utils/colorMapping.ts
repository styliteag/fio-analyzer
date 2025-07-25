/**
 * Color mapping utility for extracting colors from hostnames and drive names
 * Ensures unique colors within each chart context while maintaining consistency
 */

// Color name to hex/rgba mapping
const COLOR_PALETTE = {
    red: {
        primary: 'rgba(239, 68, 68, 0.8)',     // red-500
        light: 'rgba(239, 68, 68, 0.2)',      // red-500 with low opacity
        dark: 'rgba(185, 28, 28, 0.8)',       // red-700
    },
    green: {
        primary: 'rgba(16, 185, 129, 0.8)',   // emerald-500
        light: 'rgba(16, 185, 129, 0.2)',     // emerald-500 with low opacity
        dark: 'rgba(5, 150, 105, 0.8)',       // emerald-600
    },
    blue: {
        primary: 'rgba(59, 130, 246, 0.8)',   // blue-500
        light: 'rgba(59, 130, 246, 0.2)',     // blue-500 with low opacity
        dark: 'rgba(37, 99, 235, 0.8)',       // blue-600
    },
    yellow: {
        primary: 'rgba(245, 158, 11, 0.8)',   // amber-500
        light: 'rgba(245, 158, 11, 0.2)',     // amber-500 with low opacity
        dark: 'rgba(217, 119, 6, 0.8)',       // amber-600
    },
    purple: {
        primary: 'rgba(139, 92, 246, 0.8)',   // violet-500
        light: 'rgba(139, 92, 246, 0.2)',     // violet-500 with low opacity
        dark: 'rgba(124, 58, 237, 0.8)',      // violet-600
    },
    pink: {
        primary: 'rgba(236, 72, 153, 0.8)',   // pink-500
        light: 'rgba(236, 72, 153, 0.2)',     // pink-500 with low opacity
        dark: 'rgba(219, 39, 119, 0.8)',      // pink-600
    },
    orange: {
        primary: 'rgba(249, 115, 22, 0.8)',   // orange-500
        light: 'rgba(249, 115, 22, 0.2)',     // orange-500 with low opacity
        dark: 'rgba(234, 88, 12, 0.8)',       // orange-600
    },
    cyan: {
        primary: 'rgba(6, 182, 212, 0.8)',    // cyan-500
        light: 'rgba(6, 182, 212, 0.2)',      // cyan-500 with low opacity
        dark: 'rgba(8, 145, 178, 0.8)',       // cyan-600
    },
    indigo: {
        primary: 'rgba(99, 102, 241, 0.8)',   // indigo-500
        light: 'rgba(99, 102, 241, 0.2)',     // indigo-500 with low opacity
        dark: 'rgba(79, 70, 229, 0.8)',       // indigo-600
    },
    teal: {
        primary: 'rgba(20, 184, 166, 0.8)',   // teal-500
        light: 'rgba(20, 184, 166, 0.2)',     // teal-500 with low opacity
        dark: 'rgba(13, 148, 136, 0.8)',      // teal-600
    },
    white: {
        primary: 'rgba(241, 245, 249, 0.8)',  // slate-100 (light gray instead of pure white)
        light: 'rgba(241, 245, 249, 0.2)',    // slate-100 with low opacity
        dark: 'rgba(203, 213, 225, 0.8)',     // slate-300
    },
    grey: {
        primary: 'rgba(107, 114, 128, 0.8)',  // gray-500
        light: 'rgba(107, 114, 128, 0.2)',    // gray-500 with low opacity
        dark: 'rgba(75, 85, 99, 0.8)',        // gray-600
    },
    gray: {
        primary: 'rgba(107, 114, 128, 0.8)',  // gray-500 (alias for grey)
        light: 'rgba(107, 114, 128, 0.2)',    // gray-500 with low opacity
        dark: 'rgba(75, 85, 99, 0.8)',        // gray-600
    },
    black: {
        primary: 'rgba(51, 65, 85, 0.8)',     // slate-700 (dark charcoal instead of pure black)
        light: 'rgba(51, 65, 85, 0.2)',       // slate-700 with low opacity
        dark: 'rgba(30, 41, 59, 0.8)',        // slate-800
    },
};

// Fallback colors for non-color names
const FALLBACK_COLORS = [
    'rgba(107, 114, 128, 0.8)',   // gray-500
    'rgba(156, 163, 175, 0.8)',   // gray-400
    'rgba(75, 85, 99, 0.8)',      // gray-600
    'rgba(55, 65, 81, 0.8)',      // gray-700
    'rgba(17, 24, 39, 0.8)',      // gray-900
];

/**
 * Extract color name from a string (hostname or drive name)
 */
export function extractColorFromName(name: string): string | null {
    if (!name) return null;
    
    const lowerName = name.toLowerCase();
    
    // Try to find color names in the string
    for (const colorName of Object.keys(COLOR_PALETTE)) {
        if (lowerName.includes(colorName)) {
            return colorName;
        }
    }
    
    return null;
}

/**
 * Generate a color configuration for a given identifier
 */
export interface ColorConfig {
    primary: string;
    light: string;
    dark: string;
    name: string;
}

/**
 * Get color configuration for a hostname and drive combination
 */
export function getColorForIdentifier(hostname: string, driveModel?: string): ColorConfig {
    // Try to extract color from hostname first
    let colorName = extractColorFromName(hostname);
    
    // If no color in hostname, try drive model
    if (!colorName && driveModel) {
        colorName = extractColorFromName(driveModel);
    }
    
    // If we found a color name, use it
    if (colorName && COLOR_PALETTE[colorName as keyof typeof COLOR_PALETTE]) {
        const colors = COLOR_PALETTE[colorName as keyof typeof COLOR_PALETTE];
        return {
            primary: colors.primary,
            light: colors.light,
            dark: colors.dark,
            name: colorName,
        };
    }
    
    // Fallback: generate a consistent color based on the identifier string
    const identifier = `${hostname}_${driveModel || ''}`;
    const hash = simpleStringHash(identifier);
    const colorIndex = Math.abs(hash) % FALLBACK_COLORS.length;
    
    return {
        primary: FALLBACK_COLORS[colorIndex],
        light: FALLBACK_COLORS[colorIndex].replace('0.8', '0.2'),
        dark: FALLBACK_COLORS[colorIndex].replace('0.8', '1.0'),
        name: 'fallback',
    };
}

/**
 * Simple string hash function for consistent fallback colors
 */
function simpleStringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}

/**
 * Generate unique colors for a list of items, ensuring no duplicates in the same chart
 */
export function generateUniqueColorsForChart(
    items: Array<{ hostname: string; driveModel?: string; identifier?: string }>,
    chartType: 'primary' | 'light' | 'dark' = 'primary'
): string[] {
    const usedColors = new Set<string>();
    const colors: string[] = [];
    const colorMapping = new Map<string, ColorConfig>();
    
    // First pass: try to assign colors based on names
    for (const item of items) {
        const key = item.identifier || `${item.hostname}_${item.driveModel || ''}`;
        
        if (!colorMapping.has(key)) {
            const colorConfig = getColorForIdentifier(item.hostname, item.driveModel);
            colorMapping.set(key, colorConfig);
        }
    }
    
    // Second pass: resolve conflicts and assign final colors
    for (const item of items) {
        const key = item.identifier || `${item.hostname}_${item.driveModel || ''}`;
        const colorConfig = colorMapping.get(key)!;
        let finalColor = colorConfig[chartType];
        
        // If color is already used, try variations
        if (usedColors.has(finalColor)) {
            // Try other variants
            const variants = [colorConfig.primary, colorConfig.dark, colorConfig.light];
            let found = false;
            
            for (const variant of variants) {
                if (!usedColors.has(variant)) {
                    finalColor = variant;
                    found = true;
                    break;
                }
            }
            
            // If still conflicts, generate a unique color
            if (!found) {
                const fallbackIndex = colors.length % FALLBACK_COLORS.length;
                finalColor = FALLBACK_COLORS[fallbackIndex];
                
                // Ensure even fallback colors are unique
                let attempt = 0;
                while (usedColors.has(finalColor) && attempt < 10) {
                    const newIndex = (fallbackIndex + attempt + 1) % FALLBACK_COLORS.length;
                    finalColor = FALLBACK_COLORS[newIndex];
                    attempt++;
                }
            }
        }
        
        usedColors.add(finalColor);
        colors.push(finalColor);
    }
    
    return colors;
}

/**
 * Get a consistent color for a specific hostname/drive combination across all charts
 */
export function getConsistentColor(
    hostname: string, 
    driveModel?: string, 
    chartType: 'primary' | 'light' | 'dark' = 'primary'
): string {
    const colorConfig = getColorForIdentifier(hostname, driveModel);
    return colorConfig[chartType];
}

/**
 * Create color mapping for chart.js datasets
 */
export function createChartJsColors(
    items: Array<{ hostname: string; driveModel?: string; label?: string }>
): Array<{ backgroundColor: string; borderColor: string; pointBackgroundColor: string }> {
    const primaryColors = generateUniqueColorsForChart(items, 'primary');
    const lightColors = generateUniqueColorsForChart(items, 'light');
    
    return primaryColors.map((primary, index) => ({
        backgroundColor: lightColors[index],
        borderColor: primary,
        pointBackgroundColor: primary,
    }));
}
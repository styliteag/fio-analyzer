/**
 * Color mapping utility for extracting colors from hostnames and drive names
 * Ensures unique colors within each chart context while maintaining consistency
 */

// Base color definitions (no duplication)
const BASE_COLORS = {
    red: { base: 'rgba(239, 68, 68, VAR)', dark: 'rgba(185, 28, 28, VAR)' },
    green: { base: 'rgba(16, 185, 129, VAR)', dark: 'rgba(5, 150, 105, VAR)' },
    blue: { base: 'rgba(59, 130, 246, VAR)', dark: 'rgba(37, 99, 235, VAR)' },
    yellow: { base: 'rgba(245, 158, 11, VAR)', dark: 'rgba(217, 119, 6, VAR)' },
    purple: { base: 'rgba(139, 92, 246, VAR)', dark: 'rgba(124, 58, 237, VAR)' },
    pink: { base: 'rgba(236, 72, 153, VAR)', dark: 'rgba(219, 39, 119, VAR)' },
    orange: { base: 'rgba(249, 115, 22, VAR)', dark: 'rgba(234, 88, 12, VAR)' },
    cyan: { base: 'rgba(6, 182, 212, VAR)', dark: 'rgba(8, 145, 178, VAR)' },
    indigo: { base: 'rgba(99, 102, 241, VAR)', dark: 'rgba(79, 70, 229, VAR)' },
    teal: { base: 'rgba(20, 184, 166, VAR)', dark: 'rgba(13, 148, 136, VAR)' },
    white: { base: 'rgba(241, 245, 249, VAR)', dark: 'rgba(203, 213, 225, VAR)' },
    gray: { base: 'rgba(107, 114, 128, VAR)', dark: 'rgba(75, 85, 99, VAR)' },
    black: { base: 'rgba(51, 65, 85, VAR)', dark: 'rgba(30, 41, 59, VAR)' },
};

// Generate color palette with opacity variations
const generateColorVariation = (baseColor: string, opacity: number): string =>
    baseColor.replace('VAR', opacity.toString());

const COLOR_PALETTE = Object.fromEntries(
    Object.entries(BASE_COLORS).map(([colorName, colors]) => [
        colorName,
        {
            primary: generateColorVariation(colors.base, 0.8),
            light: generateColorVariation(colors.base, 0.2),
            dark: generateColorVariation(colors.dark, 0.8),
        }
    ])
) as Record<string, { primary: string; light: string; dark: string }>;

// Add grey as alias for gray
COLOR_PALETTE.grey = COLOR_PALETTE.gray;

// Keys for vibrant colors (excluding greys/blacks/whites)
const VIBRANT_KEYS = [
    'blue', 'green', 'purple', 'orange', 'cyan', 'indigo', 'pink', 'teal', 'red', 'yellow'
];

// Fallback colors using vibrant palette
const FALLBACK_COLORS = VIBRANT_KEYS.map(key => COLOR_PALETTE[key].primary);

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

    // Fallback: generate a consistent vibrant color based on the identifier string
    const identifier = `${hostname}_${driveModel || ''}`;
    const hash = simpleStringHash(identifier);
    const colorIndex = Math.abs(hash) % VIBRANT_KEYS.length;
    const selectedColorKey = VIBRANT_KEYS[colorIndex];
    const colors = COLOR_PALETTE[selectedColorKey];

    return {
        primary: colors.primary,
        light: colors.light,
        dark: colors.dark,
        name: selectedColorKey,
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
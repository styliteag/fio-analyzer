// Chart series visibility toggle component
import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface SeriesData {
    label: string;
    backgroundColor?: string;
    borderColor?: string;
}

export interface SeriesToggleProps {
    datasets: SeriesData[];
    visibleSeries: Set<string>;
    onToggleSeries: (label: string) => void;
    className?: string;
}

const SeriesToggle: React.FC<SeriesToggleProps> = ({
    datasets,
    visibleSeries,
    onToggleSeries,
    className = '',
}) => {
    if (datasets.length <= 1) {
        return null;
    }

    return (
        <div className={`mb-4 ${className}`}>
            <h4 className="text-sm font-medium mb-2 theme-text-primary">
                Series Visibility
            </h4>
            <div className="flex flex-wrap gap-2">
                {datasets.map((dataset) => (
                    <SeriesToggleButton
                        key={dataset.label}
                        dataset={dataset}
                        isVisible={visibleSeries.has(dataset.label)}
                        onToggle={() => onToggleSeries(dataset.label)}
                    />
                ))}
            </div>
        </div>
    );
};

interface SeriesToggleButtonProps {
    dataset: SeriesData;
    isVisible: boolean;
    onToggle: () => void;
}

const SeriesToggleButton: React.FC<SeriesToggleButtonProps> = ({
    dataset,
    isVisible,
    onToggle,
}) => {
    const colorIndicator = dataset.backgroundColor || dataset.borderColor;

    return (
        <button
            onClick={onToggle}
            className={`flex items-center px-3 py-1 rounded text-sm transition-all duration-200 border ${
                isVisible
                    ? "theme-bg-accent theme-text-accent theme-border-accent shadow-sm"
                    : "theme-bg-tertiary theme-text-secondary theme-border-primary hover:theme-bg-secondary"
            }`}
            title={`${isVisible ? 'Hide' : 'Show'} ${dataset.label}`}
        >
            {/* Color Indicator */}
            {colorIndicator && (
                <div
                    className="w-3 h-3 rounded-full mr-2 border border-gray-300"
                    style={{ backgroundColor: colorIndicator }}
                />
            )}
            
            {/* Visibility Icon */}
            {isVisible ? (
                <Eye size={14} className="mr-1" />
            ) : (
                <EyeOff size={14} className="mr-1" />
            )}
            
            {/* Series Label */}
            <span className="font-medium">
                {dataset.label}
            </span>
        </button>
    );
};


export default SeriesToggle;
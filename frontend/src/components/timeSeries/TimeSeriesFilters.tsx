import React from 'react';
import Select from 'react-select';
import { HardDrive, Calendar, Filter } from 'lucide-react';
import { getSelectStyles } from '../../hooks/useThemeColors';
import { sortBlockSizes } from '../../utils/sorting';
import type { FilterOptions } from '../../types';

export interface TimeSeriesFilters {
    hostnames: string[];
    protocols: string[];
    drive_models: string[];
    drive_types: string[];
    block_sizes: string[];
    patterns: string[];
    start_date: string;
    end_date: string;
}

interface TimeSeriesFiltersProps {
    filters: FilterOptions;
    activeFilters: TimeSeriesFilters;
    onFilterChange: (filterType: keyof TimeSeriesFilters, values: string[] | string) => void;
    onResetFilters: () => void;
}

const TimeSeriesFilters: React.FC<TimeSeriesFiltersProps> = ({
    filters,
    activeFilters,
    onFilterChange,
    onResetFilters,
}) => {
    const hasActiveFilters = Object.values(activeFilters).some(filter => 
        Array.isArray(filter) ? filter.length > 0 : filter !== ''
    );

    return (
        <div className="space-y-4">
            {/* Filter Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 theme-text-secondary" />
                    <h3 className="text-lg font-medium theme-text-primary">Advanced Filters</h3>
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={onResetFilters}
                        className="text-sm theme-btn-secondary hover:theme-btn-secondary-hover px-3 py-1 rounded"
                    >
                        Reset All
                    </button>
                )}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Hostnames */}
                <div>
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        Hostnames
                    </label>
                    <Select
                        isMulti
                        options={filters.hostnames.map((hostname) => ({
                            value: hostname,
                            label: hostname,
                        }))}
                        value={activeFilters.hostnames.map((hostname) => ({
                            value: hostname,
                            label: hostname,
                        }))}
                        onChange={(selected) =>
                            onFilterChange('hostnames', selected ? selected.map((s) => s.value) : [])
                        }
                        placeholder="All hosts"
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>

                {/* Protocols */}
                <div>
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        Protocols
                    </label>
                    <Select
                        isMulti
                        options={filters.protocols.map((protocol) => ({
                            value: protocol,
                            label: protocol,
                        }))}
                        value={activeFilters.protocols.map((protocol) => ({
                            value: protocol,
                            label: protocol,
                        }))}
                        onChange={(selected) =>
                            onFilterChange('protocols', selected ? selected.map((s) => s.value) : [])
                        }
                        placeholder="All protocols"
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>

                {/* Drive Models */}
                <div>
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        Drive Models
                    </label>
                    <Select
                        isMulti
                        options={filters.drive_models.map((model) => ({
                            value: model,
                            label: model,
                        }))}
                        value={activeFilters.drive_models.map((model) => ({
                            value: model,
                            label: model,
                        }))}
                        onChange={(selected) =>
                            onFilterChange('drive_models', selected ? selected.map((s) => s.value) : [])
                        }
                        placeholder="All models"
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>

                {/* Drive Types */}
                <div>
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        <HardDrive size={16} className="inline mr-1 theme-text-tertiary" />
                        Drive Types
                    </label>
                    <Select
                        isMulti
                        options={filters.drive_types.map((type) => ({
                            value: type,
                            label: type,
                        }))}
                        value={activeFilters.drive_types.map((type) => ({
                            value: type,
                            label: type,
                        }))}
                        onChange={(selected) =>
                            onFilterChange('drive_types', selected ? selected.map((s) => s.value) : [])
                        }
                        placeholder="All drive types"
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>

                {/* Block Sizes */}
                <div>
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        Block Sizes
                    </label>
                    <Select
                        isMulti
                        options={sortBlockSizes(filters.block_sizes).map((size) => ({
                            value: size.toString(),
                            label: size.toString(),
                        }))}
                        value={activeFilters.block_sizes.map((size) => ({
                            value: size,
                            label: size,
                        }))}
                        onChange={(selected) =>
                            onFilterChange('block_sizes', selected ? selected.map((s) => s.value) : [])
                        }
                        placeholder="All sizes"
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>

                {/* Test Patterns */}
                <div>
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        Test Patterns
                    </label>
                    <Select
                        isMulti
                        options={filters.patterns.map((pattern) => ({
                            value: pattern,
                            label: pattern.replace(/_/g, " ").toUpperCase(),
                        }))}
                        value={activeFilters.patterns.map((pattern) => ({
                            value: pattern,
                            label: pattern.replace(/_/g, " ").toUpperCase(),
                        }))}
                        onChange={(selected) =>
                            onFilterChange('patterns', selected ? selected.map((s) => s.value) : [])
                        }
                        placeholder="All patterns"
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>

                {/* Custom Date Range */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                        <Calendar size={16} className="inline mr-1 theme-text-tertiary" />
                        Custom Date Range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs theme-text-tertiary mb-1">From</label>
                            <input
                                type="datetime-local"
                                value={activeFilters.start_date}
                                onChange={(e) => onFilterChange('start_date', e.target.value)}
                                className="w-full px-3 py-2 rounded border theme-border-primary theme-bg-secondary theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                max={activeFilters.end_date || undefined}
                            />
                        </div>
                        <div>
                            <label className="block text-xs theme-text-tertiary mb-1">To</label>
                            <input
                                type="datetime-local"
                                value={activeFilters.end_date}
                                onChange={(e) => onFilterChange('end_date', e.target.value)}
                                className="w-full px-3 py-2 rounded border theme-border-primary theme-bg-secondary theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min={activeFilters.start_date || undefined}
                            />
                        </div>
                    </div>
                    {(activeFilters.start_date || activeFilters.end_date) && (
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={() => {
                                    const now = new Date();
                                    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                                    onFilterChange('start_date', yesterday.toISOString().slice(0, 16));
                                    onFilterChange('end_date', now.toISOString().slice(0, 16));
                                }}
                                className="text-xs theme-btn-secondary hover:theme-btn-secondary-hover px-2 py-1 rounded"
                            >
                                Last 24h
                            </button>
                            <button
                                onClick={() => {
                                    const now = new Date();
                                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    onFilterChange('start_date', weekAgo.toISOString().slice(0, 16));
                                    onFilterChange('end_date', now.toISOString().slice(0, 16));
                                }}
                                className="text-xs theme-btn-secondary hover:theme-btn-secondary-hover px-2 py-1 rounded"
                            >
                                Last 7d
                            </button>
                            <button
                                onClick={() => {
                                    onFilterChange('start_date', '');
                                    onFilterChange('end_date', '');
                                }}
                                className="text-xs theme-btn-secondary hover:theme-btn-secondary-hover px-2 py-1 rounded"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="mt-4 p-3 theme-bg-tertiary rounded-lg">
                    <div className="text-sm theme-text-secondary">
                        <strong>Active Filters:</strong>
                        {activeFilters.hostnames.length > 0 && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                {activeFilters.hostnames.length} host{activeFilters.hostnames.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {activeFilters.protocols.length > 0 && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                {activeFilters.protocols.length} protocol{activeFilters.protocols.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {activeFilters.drive_models.length > 0 && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                {activeFilters.drive_models.length} model{activeFilters.drive_models.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {activeFilters.drive_types.length > 0 && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                {activeFilters.drive_types.length} drive type{activeFilters.drive_types.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {activeFilters.block_sizes.length > 0 && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                {activeFilters.block_sizes.length} block size{activeFilters.block_sizes.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {activeFilters.patterns.length > 0 && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                {activeFilters.patterns.length} pattern{activeFilters.patterns.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {activeFilters.start_date && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                Start: {new Date(activeFilters.start_date).toLocaleDateString()}
                            </span>
                        )}
                        {activeFilters.end_date && (
                            <span className="ml-2 px-2 py-1 theme-bg-secondary rounded text-xs">
                                End: {new Date(activeFilters.end_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeSeriesFilters;
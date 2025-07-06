import React, { useState } from 'react';
import Select from 'react-select';
import { HardDrive, Clock, Layers, Database, Zap, X } from 'lucide-react';
import { getSelectStyles } from '../../hooks/useThemeColors';
import { sortBlockSizes } from '../../utils/sorting';
import type { FilterOptions, TestRun } from '../../types';
import type { ActiveFilters, DynamicFilterOptions } from '../../hooks/useTestRunFilters';

interface TestRunFiltersProps {
    filters: FilterOptions;
    activeFilters: ActiveFilters;
    onFilterChange: (filterType: keyof ActiveFilters, values: (string | number)[]) => void;
    dynamicFilterOptions?: DynamicFilterOptions;
    useDynamicFilters?: boolean;
    onClearAllFilters?: () => void;
    testRuns?: TestRun[];
}

const TestRunFilters: React.FC<TestRunFiltersProps> = ({
    filters,
    activeFilters,
    onFilterChange,
    dynamicFilterOptions,
    useDynamicFilters = false,
    onClearAllFilters,
    testRuns = [],
}) => {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [filtersWhenOpened, setFiltersWhenOpened] = useState<ActiveFilters | null>(null);
    const [cachedCounts, setCachedCounts] = useState<Record<string, Record<string | number, number>>>({});

    // Helper function to calculate accurate counts when a dropdown is open
    const calculateAccurateCount = (field: keyof ActiveFilters, value: string | number) => {
        if (!openDropdown || openDropdown !== field) {
            return 0; // Use dynamic filtering when dropdown is closed
        }

        // Return cached count if available
        if (cachedCounts[field] && cachedCounts[field][value] !== undefined) {
            return cachedCounts[field][value];
        }

        return 0; // Fallback
    };

    // Calculate and cache counts when dropdown opens
    const calculateAndCacheCounts = (field: keyof ActiveFilters) => {
        if (!filtersWhenOpened) return;

        const tempFilters = { ...filtersWhenOpened };
        (tempFilters as any)[field] = [];

        const counts: Record<string | number, number> = {};

        testRuns.forEach((run: TestRun) => {
            // Apply all other filters except the open dropdown
            if (tempFilters.drive_types.length > 0 && !tempFilters.drive_types.includes(run.drive_type)) return;
            if (tempFilters.drive_models.length > 0 && !tempFilters.drive_models.includes(run.drive_model)) return;
            if (tempFilters.block_sizes.length > 0 && !tempFilters.block_sizes.includes(run.block_size)) return;
            if (tempFilters.hostnames.length > 0 && (!run.hostname || !tempFilters.hostnames.includes(run.hostname))) return;
            if (tempFilters.protocols.length > 0 && (!run.protocol || !tempFilters.protocols.includes(run.protocol))) return;
            if (tempFilters.syncs.length > 0 && (run.sync === undefined || !tempFilters.syncs.includes(run.sync))) return;
            if (tempFilters.queue_depths.length > 0 && !tempFilters.queue_depths.includes(run.queue_depth)) return;
            if (tempFilters.directs.length > 0 && (run.direct === undefined || !tempFilters.directs.includes(run.direct))) return;
            if (tempFilters.num_jobs.length > 0 && (!run.num_jobs || !tempFilters.num_jobs.includes(run.num_jobs))) return;
            if (tempFilters.test_sizes.length > 0 && (!run.test_size || !tempFilters.test_sizes.includes(run.test_size))) return;
            if (tempFilters.durations.length > 0 && !tempFilters.durations.includes(run.duration)) return;
            
            // Count occurrences for the field
            let value: string | number | undefined;
            switch (field) {
                case 'drive_types': value = run.drive_type; break;
                case 'drive_models': value = run.drive_model; break;
                case 'patterns': value = run.read_write_pattern; break;
                case 'block_sizes': value = run.block_size; break;
                case 'hostnames': value = run.hostname; break;
                case 'protocols': value = run.protocol; break;
                case 'syncs': value = run.sync; break;
                case 'queue_depths': value = run.queue_depth; break;
                case 'directs': value = run.direct; break;
                case 'num_jobs': value = run.num_jobs; break;
                case 'test_sizes': value = run.test_size; break;
                case 'durations': value = run.duration; break;
                default: return;
            }
            
            if (value !== undefined && value !== null) {
                counts[value] = (counts[value] || 0) + 1;
            }
        });

        setCachedCounts(prev => ({ ...prev, [field]: counts }));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3 mb-4">
            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Hostnames
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('hostnames');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('hostnames');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'hostnames'
                            ? filters.hostnames.map((hostname) => {
                                const count = calculateAccurateCount('hostnames', hostname);
                                return {
                                    value: String(hostname),
                                    label: `${hostname} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.hostnames.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.hostnames.map((hostname) => ({
                                    value: String(hostname),
                                    label: String(hostname),
                                }))
                    }
                    value={activeFilters.hostnames.map((hostname) => ({
                        value: String(hostname),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${hostname} (${dynamicFilterOptions.hostnames.find(opt => opt.value === hostname)?.count || 0})`
                            : String(hostname),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('hostnames', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All hosts"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Protocols
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('protocols');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('protocols');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'protocols'
                            ? filters.protocols.map((protocol) => {
                                const count = calculateAccurateCount('protocols', protocol);
                                return {
                                    value: String(protocol),
                                    label: `${protocol} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.protocols.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.protocols.map((protocol) => ({
                                    value: String(protocol),
                                    label: String(protocol),
                                }))
                    }
                    value={activeFilters.protocols.map((protocol) => ({
                        value: String(protocol),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${protocol} (${dynamicFilterOptions.protocols.find(opt => opt.value === protocol)?.count || 0})`
                            : String(protocol),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('protocols', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All protocols"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <HardDrive size={14} className="inline mr-1 theme-text-tertiary" />
                    Drive Types
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('drive_types');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('drive_types');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'drive_types'
                            ? filters.drive_types.map((type) => {
                                const count = calculateAccurateCount('drive_types', type);
                                return {
                                    value: String(type),
                                    label: `${type} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.drive_types.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.drive_types.map((type) => ({
                                    value: String(type),
                                    label: String(type),
                                }))
                    }
                    value={activeFilters.drive_types.map((type) => ({
                        value: String(type),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${type} (${dynamicFilterOptions.drive_types.find(opt => opt.value === type)?.count || 0})`
                            : String(type),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('drive_types', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All drive types"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Drive Models
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('drive_models');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('drive_models');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'drive_models'
                            ? filters.drive_models.map((model) => {
                                const count = calculateAccurateCount('drive_models', model);
                                return {
                                    value: String(model),
                                    label: `${model} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.drive_models.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.drive_models.map((model) => ({
                                    value: String(model),
                                    label: String(model),
                                }))
                    }
                    value={activeFilters.drive_models.map((model) => ({
                        value: String(model),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${model} (${dynamicFilterOptions.drive_models.find(opt => opt.value === model)?.count || 0})`
                            : String(model),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('drive_models', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All models"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Test Patterns
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('patterns');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('patterns');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        // When dropdown is open, show all options with accurate counts
                        openDropdown === 'patterns' 
                            ? filters.patterns.map((pattern) => {
                                const count = calculateAccurateCount('patterns', pattern);
                                return {
                                    value: String(pattern),
                                    label: `${pattern.replace(/_/g, " ").toUpperCase()} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.patterns.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label.replace(/_/g, " ").toUpperCase()} (${option.count})`,
                                }))
                                : filters.patterns.map((pattern) => ({
                                    value: String(pattern),
                                    label: pattern.replace(/_/g, " ").toUpperCase(),
                                }))
                    }
                    value={activeFilters.patterns.map((pattern) => ({
                        value: String(pattern),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${pattern.replace(/_/g, " ").toUpperCase()} (${dynamicFilterOptions.patterns.find(opt => opt.value === pattern)?.count || 0})`
                            : pattern.replace(/_/g, " ").toUpperCase(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('patterns', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All patterns"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Block Sizes
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('block_sizes');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('block_sizes');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'block_sizes'
                            ? sortBlockSizes(filters.block_sizes).map((size) => {
                                const count = calculateAccurateCount('block_sizes', size);
                                return {
                                    value: String(size),
                                    label: `${size} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.block_sizes.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : sortBlockSizes(filters.block_sizes).map((size) => ({
                                    value: String(size),
                                    label: String(size),
                                }))
                    }
                    value={activeFilters.block_sizes.map((size) => ({
                        value: String(size),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${size} (${dynamicFilterOptions.block_sizes.find(opt => opt.value === size)?.count || 0})`
                            : String(size),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('block_sizes', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All sizes"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Zap size={14} className="inline mr-1 theme-text-tertiary" />
                    Sync
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('syncs');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('syncs');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'syncs'
                            ? filters.syncs.map((sync) => {
                                const count = calculateAccurateCount('syncs', sync);
                                return {
                                    value: String(sync),
                                    label: `${sync} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.syncs.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.syncs.map((sync) => ({
                                    value: String(sync),
                                    label: sync.toString(),
                                }))
                    }
                    value={activeFilters.syncs.map((sync) => ({
                        value: String(sync),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${sync} (${dynamicFilterOptions.syncs.find(opt => opt.value === sync)?.count || 0})`
                            : sync.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('syncs', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All sync values"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Queue Depth
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('queue_depths');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('queue_depths');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'queue_depths'
                            ? filters.queue_depths.map((qd) => {
                                const count = calculateAccurateCount('queue_depths', qd);
                                return {
                                    value: String(qd),
                                    label: `${qd} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.queue_depths.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.queue_depths.map((qd) => ({
                                    value: String(qd),
                                    label: qd.toString(),
                                }))
                    }
                    value={activeFilters.queue_depths.map((qd) => ({
                        value: String(qd),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${qd} (${dynamicFilterOptions.queue_depths.find(opt => opt.value === qd)?.count || 0})`
                            : qd.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('queue_depths', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All queue depths"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Database size={14} className="inline mr-1 theme-text-tertiary" />
                    Direct
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('directs');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('directs');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'directs'
                            ? filters.directs.map((direct) => {
                                const count = calculateAccurateCount('directs', direct);
                                return {
                                    value: String(direct),
                                    label: `${direct} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.directs.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.directs.map((direct) => ({
                                    value: String(direct),
                                    label: direct.toString(),
                                }))
                    }
                    value={activeFilters.directs.map((direct) => ({
                        value: String(direct),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${direct} (${dynamicFilterOptions.directs.find(opt => opt.value === direct)?.count || 0})`
                            : direct.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('directs', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All direct values"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Layers size={14} className="inline mr-1 theme-text-tertiary" />
                    Num Jobs
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('num_jobs');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('num_jobs');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'num_jobs'
                            ? filters.num_jobs.map((jobs) => {
                                const count = calculateAccurateCount('num_jobs', jobs);
                                return {
                                    value: String(jobs),
                                    label: `${jobs} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.num_jobs.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.num_jobs.map((jobs) => ({
                                    value: String(jobs),
                                    label: jobs.toString(),
                                }))
                    }
                    value={activeFilters.num_jobs.map((jobs) => ({
                        value: String(jobs),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${jobs} (${dynamicFilterOptions.num_jobs.find(opt => opt.value === jobs)?.count || 0})`
                            : jobs.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('num_jobs', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All job counts"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Database size={14} className="inline mr-1 theme-text-tertiary" />
                    Test Size
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('test_sizes');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('test_sizes');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'test_sizes'
                            ? filters.test_sizes.map((size) => {
                                const count = calculateAccurateCount('test_sizes', size);
                                return {
                                    value: String(size),
                                    label: `${size} (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.test_sizes.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.test_sizes.map((size) => ({
                                    value: String(size),
                                    label: String(size),
                                }))
                    }
                    value={activeFilters.test_sizes.map((size) => ({
                        value: String(size),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${size} (${dynamicFilterOptions.test_sizes.find(opt => opt.value === size)?.count || 0})`
                            : String(size),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('test_sizes', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All test sizes"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Clock size={14} className="inline mr-1 theme-text-tertiary" />
                    Duration
                </label>
                <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    blurInputOnSelect={false}
                    isClearable={false}
                    onMenuOpen={() => {
                        setOpenDropdown('durations');
                        setFiltersWhenOpened(activeFilters);
                        calculateAndCacheCounts('durations');
                    }}
                    onMenuClose={() => {
                        setOpenDropdown(null);
                        setFiltersWhenOpened(null);
                    }}
                    options={
                        openDropdown === 'durations'
                            ? filters.durations.map((duration) => {
                                const count = calculateAccurateCount('durations', duration);
                                return {
                                    value: String(duration),
                                    label: `${duration}s (${count})`,
                                };
                            })
                            : useDynamicFilters && dynamicFilterOptions
                                ? dynamicFilterOptions.durations.map((option) => ({
                                    value: String(option.value),
                                    label: `${option.label} (${option.count})`,
                                }))
                                : filters.durations.map((duration) => ({
                                    value: String(duration),
                                    label: `${duration}s`,
                                }))
                    }
                    value={activeFilters.durations.map((duration) => ({
                        value: String(duration),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${duration}s (${dynamicFilterOptions.durations.find(opt => opt.value === duration)?.count || 0})`
                            : `${duration}s`,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('durations', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All durations"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>
        </div>
    );
};

export default TestRunFilters;
import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import type { TestCoverage } from '../../services/api/hostAnalysis';

interface HostFiltersProps {
    testCoverage: TestCoverage;
    selectedBlockSizes: string[];
    selectedPatterns: string[];
    selectedQueueDepths: number[];
    selectedProtocols: string[];
    onBlockSizeChange: (blockSizes: string[]) => void;
    onPatternChange: (patterns: string[]) => void;
    onQueueDepthChange: (queueDepths: number[]) => void;
    onProtocolChange: (protocols: string[]) => void;
    onReset: () => void;
}

const HostFilters: React.FC<HostFiltersProps> = ({
    testCoverage,
    selectedBlockSizes,
    selectedPatterns,
    selectedQueueDepths,
    selectedProtocols,
    onBlockSizeChange,
    onPatternChange,
    onQueueDepthChange,
    onProtocolChange,
    onReset
}) => {
    const handleFilterChange = (
        value: string | number,
        selectedValues: (string | number)[],
        onChange: (values: any[]) => void
    ) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 theme-text-primary" />
                    <h3 className="text-lg font-semibold theme-text-primary">Filters</h3>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onReset}
                    className="flex items-center gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                </Button>
            </div>

            <div className="space-y-6">
                {/* Block Sizes */}
                <div>
                    <h4 className="font-medium theme-text-primary mb-3">Block Sizes</h4>
                    <div className="flex flex-wrap gap-2">
                        {testCoverage.blockSizes.map(blockSize => (
                            <button
                                key={blockSize}
                                onClick={() => handleFilterChange(blockSize, selectedBlockSizes, onBlockSizeChange)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedBlockSizes.includes(blockSize)
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {blockSize}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Patterns */}
                <div>
                    <h4 className="font-medium theme-text-primary mb-3">Read/Write Patterns</h4>
                    <div className="flex flex-wrap gap-2">
                        {testCoverage.patterns.map(pattern => (
                            <button
                                key={pattern}
                                onClick={() => handleFilterChange(pattern, selectedPatterns, onPatternChange)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedPatterns.includes(pattern)
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {pattern}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Queue Depths */}
                <div>
                    <h4 className="font-medium theme-text-primary mb-3">Queue Depths</h4>
                    <div className="flex flex-wrap gap-2">
                        {testCoverage.queueDepths.map(queueDepth => (
                            <button
                                key={queueDepth}
                                onClick={() => handleFilterChange(queueDepth, selectedQueueDepths, onQueueDepthChange)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedQueueDepths.includes(queueDepth)
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                QD{queueDepth}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Protocols */}
                <div>
                    <h4 className="font-medium theme-text-primary mb-3">Protocols</h4>
                    <div className="flex flex-wrap gap-2">
                        {testCoverage.protocols.map(protocol => (
                            <button
                                key={protocol}
                                onClick={() => handleFilterChange(protocol, selectedProtocols, onProtocolChange)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedProtocols.includes(protocol)
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {protocol}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Active Filters Summary */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm theme-text-secondary">
                        <div className="mb-2">
                            <span className="font-medium">Active Filters:</span>
                        </div>
                        <div className="space-y-1">
                            {selectedBlockSizes.length > 0 && (
                                <div>Block Sizes: {selectedBlockSizes.join(', ')}</div>
                            )}
                            {selectedPatterns.length > 0 && (
                                <div>Patterns: {selectedPatterns.join(', ')}</div>
                            )}
                            {selectedQueueDepths.length > 0 && (
                                <div>Queue Depths: {selectedQueueDepths.map(qd => `QD${qd}`).join(', ')}</div>
                            )}
                            {selectedProtocols.length > 0 && (
                                <div>Protocols: {selectedProtocols.join(', ')}</div>
                            )}
                            {selectedBlockSizes.length === 0 && 
                             selectedPatterns.length === 0 && 
                             selectedQueueDepths.length === 0 && 
                             selectedProtocols.length === 0 && (
                                <div className="italic">No filters applied</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HostFilters;
// Chart export functionality component
import React, { useRef } from 'react';
import { Download, FileText, Image } from 'lucide-react';
import { Button } from '../ui';
import type { PerformanceData } from '../../types';
import { formatCSVData } from '../../services/data';

export interface ChartExportProps {
    chartRef: React.RefObject<any>;
    data: PerformanceData[];
    chartTitle: string;
    className?: string;
}

const ChartExport: React.FC<ChartExportProps> = ({
    chartRef,
    data,
    chartTitle,
    className = '',
}) => {
    const downloadLinkRef = useRef<HTMLAnchorElement>(null);

    const exportToPNG = () => {
        if (!chartRef.current) return;

        const canvas = chartRef.current.canvas;
        if (!canvas) return;

        // Create download link
        const link = document.createElement('a');
        link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}_chart.png`;
        link.href = canvas.toDataURL('image/png');
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToCSV = () => {
        if (data.length === 0) return;

        try {
            const csvContent = formatCSVData(data);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            // Create download link
            const link = document.createElement('a');
            link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}_data.csv`;
            link.href = URL.createObjectURL(blob);
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error exporting CSV:', error);
        }
    };

    const exportToJSON = () => {
        if (data.length === 0) return;

        try {
            const jsonContent = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
            
            // Create download link
            const link = document.createElement('a');
            link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}_data.json`;
            link.href = URL.createObjectURL(blob);
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error exporting JSON:', error);
        }
    };

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            <span className="text-sm theme-text-secondary">Export:</span>
            
            <Button
                variant="ghost"
                size="sm"
                onClick={exportToPNG}
                icon={Image}
                title="Export chart as PNG image"
            >
                PNG
            </Button>
            
            <Button
                variant="ghost"
                size="sm"
                onClick={exportToCSV}
                icon={FileText}
                title="Export data as CSV file"
                disabled={data.length === 0}
            >
                CSV
            </Button>
            
            <Button
                variant="ghost"
                size="sm"
                onClick={exportToJSON}
                icon={Download}
                title="Export data as JSON file"
                disabled={data.length === 0}
            >
                JSON
            </Button>
            
            {/* Hidden download link for programmatic downloads */}
            <a ref={downloadLinkRef} style={{ display: 'none' }} />
        </div>
    );
};

// Export menu dropdown component
export interface ExportMenuProps {
    chartRef: React.RefObject<any>;
    data: PerformanceData[];
    chartTitle: string;
    className?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
    chartRef,
    data,
    chartTitle,
    className = '',
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const exportActions = [
        {
            label: 'Export as PNG',
            icon: Image,
            action: () => {
                if (!chartRef.current) return;
                const canvas = chartRef.current.canvas;
                if (!canvas) return;
                
                const link = document.createElement('a');
                link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}_chart.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setIsOpen(false);
            },
        },
        {
            label: 'Export as CSV',
            icon: FileText,
            action: () => {
                if (data.length === 0) return;
                const csvContent = formatCSVData(data);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}_data.csv`;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                setIsOpen(false);
            },
            disabled: data.length === 0,
        },
        {
            label: 'Export as JSON',
            icon: Download,
            action: () => {
                if (data.length === 0) return;
                const jsonContent = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
                const link = document.createElement('a');
                link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}_data.json`;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                setIsOpen(false);
            },
            disabled: data.length === 0,
        },
    ];

    return (
        <div className={`relative ${className}`} ref={menuRef}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                icon={Download}
                title="Export"
            >
                {''}
            </Button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10 theme-card theme-border-primary">
                    <div className="py-1">
                        {exportActions.map((action, index) => (
                            <button
                                key={index}
                                onClick={action.action}
                                disabled={action.disabled}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed theme-text-primary hover:theme-bg-tertiary"
                            >
                                <action.icon size={16} className="mr-3" />
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartExport;
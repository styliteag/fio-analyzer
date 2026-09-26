// Small info icon that explains a storage metric on hover or keyboard focus
import { Info } from 'lucide-react';
import { METRIC_HELP } from './metricHelpText';

interface MetricHelpProps {
    readonly metric: string;
    readonly className?: string;
}

const MetricHelp: React.FC<MetricHelpProps> = ({ metric, className = '' }) => {
    const text = METRIC_HELP[metric];
    if (!text) return null;

    return (
        <span className={`relative inline-flex group ${className}`}>
            <span
                tabIndex={0}
                role="img"
                aria-label={text}
                className="inline-flex theme-text-tertiary hover:theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
            >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 rounded-md px-3 py-2 text-xs font-normal normal-case tracking-normal shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
            >
                {text}
            </span>
        </span>
    );
};

export default MetricHelp;

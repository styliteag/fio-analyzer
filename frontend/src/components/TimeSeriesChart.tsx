import React from "react";
import { TimeSeriesContainer } from "./timeSeries";
import type { ActiveFilters } from "../hooks/useTestRunFilters";

interface TimeSeriesChartProps {
	isMaximized: boolean;
	onToggleMaximize: () => void;
	sharedFilters?: ActiveFilters;
}

/**
 * TimeSeriesChart component - A wrapper around the modular TimeSeriesContainer
 * 
 * This component maintains the original interface for compatibility with Dashboard.tsx
 * while using the new modular architecture internally.
 */
const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
	isMaximized,
	onToggleMaximize,
	sharedFilters,
}) => {
	return (
		<TimeSeriesContainer
			isMaximized={isMaximized}
			onToggleMaximize={onToggleMaximize}
			sharedFilters={sharedFilters}
		/>
	);
};

export default TimeSeriesChart;
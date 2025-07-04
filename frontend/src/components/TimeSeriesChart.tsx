import React from "react";
import { TimeSeriesContainer } from "./timeSeries";

interface TimeSeriesChartProps {
	isMaximized: boolean;
	onToggleMaximize: () => void;
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
}) => {
	return (
		<TimeSeriesContainer
			isMaximized={isMaximized}
			onToggleMaximize={onToggleMaximize}
		/>
	);
};

export default TimeSeriesChart;
import { useMemo } from "react";

// Types for react-select style functions
type StyleState = {
	isSelected: boolean;
	isFocused: boolean;
	isDisabled: boolean;
};

type BaseStyleObject = Record<string, unknown>;

export const useThemeColors = () => {
	return useMemo(() => {
		const getCustomProperty = (property: string) => {
			return getComputedStyle(document.documentElement)
				.getPropertyValue(property)
				.trim();
		};

		return {
			// Chart specific colors
			chart: {
				background: getCustomProperty("--chart-bg"),
				text: getCustomProperty("--chart-text"),
				grid: getCustomProperty("--chart-grid"),
				axis: getCustomProperty("--chart-axis"),
				tooltipBg: getCustomProperty("--chart-tooltip-bg"),
				tooltipBorder: getCustomProperty("--chart-tooltip-border"),
			},

			// Text colors
			text: {
				primary: getCustomProperty("--text-primary"),
				secondary: getCustomProperty("--text-secondary"),
				tertiary: getCustomProperty("--text-tertiary"),
				accent: getCustomProperty("--text-accent"),
			},

			// Background colors
			bg: {
				primary: getCustomProperty("--bg-primary"),
				secondary: getCustomProperty("--bg-secondary"),
				tertiary: getCustomProperty("--bg-tertiary"),
				accent: getCustomProperty("--bg-accent"),
				card: getCustomProperty("--card-bg"),
				panel: getCustomProperty("--panel-bg"),
			},

			// Border colors
			border: {
				primary: getCustomProperty("--border-primary"),
				secondary: getCustomProperty("--border-secondary"),
				accent: getCustomProperty("--border-accent"),
			},

			// Button colors
			button: {
				primaryBg: getCustomProperty("--btn-primary-bg"),
				primaryHover: getCustomProperty("--btn-primary-hover"),
				secondaryBg: getCustomProperty("--btn-secondary-bg"),
				secondaryHover: getCustomProperty("--btn-secondary-hover"),
			},

			// Form colors
			form: {
				inputBg: getCustomProperty("--input-bg"),
				inputBorder: getCustomProperty("--input-border"),
				placeholder: getCustomProperty("--input-placeholder"),
			},

			// Interactive states
			hover: getCustomProperty("--hover-bg"),
			focus: getCustomProperty("--focus-ring"),
		};
	}, []);
};

// For react-select styling
export const getSelectStyles = () => {
	const getCustomProperty = (property: string) => {
		return getComputedStyle(document.documentElement)
			.getPropertyValue(property)
			.trim();
	};

	return {
		control: (base: BaseStyleObject) => ({
			...base,
			backgroundColor: getCustomProperty("--input-bg"),
			borderColor: getCustomProperty("--input-border"),
			color: getCustomProperty("--text-primary"),
			"&:hover": {
				borderColor: getCustomProperty("--border-accent"),
			},
		}),
		menu: (base: BaseStyleObject) => ({
			...base,
			backgroundColor: getCustomProperty("--card-bg"),
			borderColor: getCustomProperty("--border-primary"),
		}),
		option: (base: BaseStyleObject, state: StyleState) => ({
			...base,
			backgroundColor: state.isSelected
				? getCustomProperty("--btn-primary-bg")
				: state.isFocused
					? getCustomProperty("--hover-bg")
					: getCustomProperty("--card-bg"),
			color: state.isSelected
				? getCustomProperty("--text-on-accent")
				: getCustomProperty("--text-primary"),
		}),
		multiValue: (base: BaseStyleObject) => ({
			...base,
			backgroundColor: getCustomProperty("--bg-tertiary"),
		}),
		multiValueLabel: (base: BaseStyleObject) => ({
			...base,
			color: getCustomProperty("--text-primary"),
		}),
		multiValueRemove: (base: BaseStyleObject) => ({
			...base,
			":hover": {
				backgroundColor: "rgb(239 68 68)",
				color: "rgb(255 255 255)",
			},
		}),
		placeholder: (base: BaseStyleObject) => ({
			...base,
			color: getCustomProperty("--input-placeholder"),
		}),
		singleValue: (base: BaseStyleObject) => ({
			...base,
			color: getCustomProperty("--text-primary"),
		}),
	};
};

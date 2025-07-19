
export interface DriveTypeSelectorProps {
	value: string;
	customValue: string;
	showCustom: boolean;
	onChange: (driveType: string, customType: string, showCustom: boolean) => void;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
}

export const DRIVE_TYPE_OPTIONS = [
	{ value: "NVMe SSD", label: "NVMe SSD" },
	{ value: "SATA SSD", label: "SATA SSD" },
	{ value: "HDD", label: "HDD" },
	{ value: "Optane", label: "Optane" },
	{ value: "eUFS", label: "eUFS" },
	{ value: "eMMC", label: "eMMC" },
	{ value: "SD Card", label: "SD Card" },
] as const;

export default function DriveTypeSelector({
	value,
	customValue,
	showCustom,
	onChange,
	disabled = false,
	className = "theme-form-select",
	placeholder = "Select type"
}: DriveTypeSelectorProps) {
	const handleSelectChange = (selectedValue: string) => {
		if (selectedValue === "custom") {
			onChange("", customValue, true);
		} else {
			onChange(selectedValue, "", false);
		}
	};

	const handleCustomChange = (customType: string) => {
		onChange(value, customType, showCustom);
	};

	const handleCancelCustom = () => {
		onChange("", "", false);
	};

	if (showCustom) {
		return (
			<div className="flex gap-2">
				<input
					type="text"
					value={customValue}
					onChange={(e) => handleCustomChange(e.target.value)}
					placeholder="Enter custom drive type"
					className="theme-form-input"
					disabled={disabled}
				/>
				<button
					type="button"
					onClick={handleCancelCustom}
					className="px-3 py-2 text-sm theme-btn-secondary rounded-md transition-colors"
					disabled={disabled}
				>
					Cancel
				</button>
			</div>
		);
	}

	return (
		<select
			value={value}
			onChange={(e) => handleSelectChange(e.target.value)}
			className={className}
			disabled={disabled}
		>
			<option value="">{placeholder}</option>
			{DRIVE_TYPE_OPTIONS.map(({ value: optionValue, label }) => (
				<option key={optionValue} value={optionValue}>
					{label}
				</option>
			))}
			<option value="custom">+ Add Custom Type</option>
		</select>
	);
}
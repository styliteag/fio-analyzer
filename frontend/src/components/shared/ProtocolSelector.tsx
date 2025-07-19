export interface ProtocolSelectorProps {
	value: string;
	onChange: (protocol: string) => void;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
}

export const PROTOCOL_OPTIONS = [
	{ value: "NFS", label: "NFS" },
	{ value: "SMB", label: "SMB" },
	{ value: "iSCSI", label: "iSCSI" },
	{ value: "FC", label: "Fibre Channel" },
	{ value: "SAS", label: "SAS" },
	{ value: "SATA", label: "SATA" },
	{ value: "NVMe", label: "NVMe" },
	{ value: "USB", label: "USB" },
	{ value: "Thunderbolt", label: "Thunderbolt" },
	{ value: "Local", label: "Local" },
	{ value: "Unknown", label: "Unknown" },
] as const;

export default function ProtocolSelector({
	value,
	onChange,
	disabled = false,
	className = "theme-form-select",
	placeholder = "Select protocol"
}: ProtocolSelectorProps) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={className}
			disabled={disabled}
		>
			<option value="">{placeholder}</option>
			{PROTOCOL_OPTIONS.map(({ value: optionValue, label }) => (
				<option key={optionValue} value={optionValue}>
					{label}
				</option>
			))}
		</select>
	);
}
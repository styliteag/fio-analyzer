import React, { useState, memo, useCallback } from "react";
import DriveTypeSelector from "./DriveTypeSelector";
import ProtocolSelector from "./ProtocolSelector";

export interface TestRunFormData {
	driveModel: string;
	driveType: string;
	customDriveType: string;
	showCustomType: boolean;
	hostname: string;
	protocol: string;
}

export interface TestRunFormFieldUpdateFlags {
	updateDriveModel: boolean;
	updateDriveType: boolean;
	updateHostname: boolean;
	updateProtocol: boolean;
}

export interface TestRunFormFieldsProps {
	// Form data
	formData: TestRunFormData;
	onFormDataChange: (formData: TestRunFormData) => void;
	
	// Mode configuration
	mode: "individual" | "bulk";
	
	// Update flags (only used in bulk mode)
	updateFlags?: TestRunFormFieldUpdateFlags;
	onUpdateFlagsChange?: (flags: TestRunFormFieldUpdateFlags) => void;
	
	// Validation and state
	disabled?: boolean;
	
	// Field visibility
	showFields?: {
		driveModel?: boolean;
		driveType?: boolean;
		hostname?: boolean;
		protocol?: boolean;
	};
}

function TestRunFormFields({
	formData,
	onFormDataChange,
	mode = "individual",
	updateFlags,
	onUpdateFlagsChange,
	disabled = false,
	showFields = {
		driveModel: true,
		driveType: true,
		hostname: true,
		protocol: true,
	}
}: TestRunFormFieldsProps) {
	const isBulkMode = mode === "bulk";
	const hasUpdateFlags = isBulkMode && updateFlags && onUpdateFlagsChange;

	// Helper function to update form data
	const updateFormData = (updates: Partial<TestRunFormData>) => {
		onFormDataChange({ ...formData, ...updates });
	};

	// Helper function to update flags
	const updateFlagsHelper = (updates: Partial<TestRunFormFieldUpdateFlags>) => {
		if (hasUpdateFlags) {
			onUpdateFlagsChange({ ...updateFlags, ...updates });
		}
	};

	// Handle drive type changes
	const handleDriveTypeChange = (driveType: string, customType: string, showCustom: boolean) => {
		updateFormData({
			driveType,
			customDriveType: customType,
			showCustomType: showCustom,
		});
	};

	// Render field with optional checkbox for bulk mode
	const renderField = (
		fieldKey: keyof TestRunFormFieldUpdateFlags,
		label: string,
		inputElement: React.ReactNode
	) => {
		const fieldDisabled = disabled || (isBulkMode && hasUpdateFlags && !updateFlags[fieldKey]);
		
		return (
			<div className="theme-form-group">
				{isBulkMode && hasUpdateFlags ? (
					<div className="flex items-center mb-2">
						<input
							type="checkbox"
							id={`update-${fieldKey}`}
							checked={updateFlags[fieldKey]}
							onChange={(e) => updateFlagsHelper({ [fieldKey]: e.target.checked } as Partial<TestRunFormFieldUpdateFlags>)}
							className="mr-2"
							disabled={disabled}
						/>
						<label
							htmlFor={`update-${fieldKey}`}
							className="theme-form-label mb-0"
						>
							{label}
						</label>
					</div>
				) : (
					<label htmlFor={fieldKey} className="theme-form-label">
						{label}
					</label>
				)}
				<div className={fieldDisabled ? "opacity-50" : ""}>
					{inputElement}
				</div>
			</div>
		);
	};

	return (
		<>
			{/* Drive Model */}
			{showFields.driveModel && renderField(
				"updateDriveModel",
				isBulkMode ? "Update Drive Model" : "Drive Model",
				<input
					id="driveModel"
					type="text"
					value={formData.driveModel}
					onChange={(e) => updateFormData({ driveModel: e.target.value })}
					placeholder="e.g., Samsung 980 PRO"
					className="theme-form-input"
					disabled={disabled || (isBulkMode && hasUpdateFlags && !updateFlags.updateDriveModel)}
				/>
			)}

			{/* Drive Type */}
			{showFields.driveType && renderField(
				"updateDriveType",
				isBulkMode ? "Update Drive Type" : "Drive Type",
				<DriveTypeSelector
					value={formData.driveType}
					customValue={formData.customDriveType}
					showCustom={formData.showCustomType}
					onChange={handleDriveTypeChange}
					disabled={disabled || (isBulkMode && hasUpdateFlags && !updateFlags.updateDriveType)}
				/>
			)}

			{/* Hostname */}
			{showFields.hostname && renderField(
				"updateHostname",
				isBulkMode ? "Update Hostname" : "📡 Hostname",
				<input
					id="hostname"
					type="text"
					value={formData.hostname}
					onChange={(e) => updateFormData({ hostname: e.target.value })}
					placeholder="e.g., web-server-01"
					className="theme-form-input"
					disabled={disabled || (isBulkMode && hasUpdateFlags && !updateFlags.updateHostname)}
				/>
			)}

			{/* Protocol */}
			{showFields.protocol && renderField(
				"updateProtocol",
				isBulkMode ? "Update Protocol" : "🔗 Protocol",
				<ProtocolSelector
					value={formData.protocol}
					onChange={(protocol) => updateFormData({ protocol })}
					disabled={disabled || (isBulkMode && hasUpdateFlags && !updateFlags.updateProtocol)}
				/>
			)}
		</>
	);
}

// Memoized input components for better performance
const DriveModelInput = memo<{
	value: string;
	onChange: (updates: Partial<TestRunFormData>) => void;
	disabled: boolean;
}>(({ value, onChange, disabled }) => {
	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		onChange({ driveModel: e.target.value });
	}, [onChange]);

	return (
		<input
			id="driveModel"
			type="text"
			value={value}
			onChange={handleChange}
			placeholder="e.g., Samsung 980 PRO"
			className="theme-form-input"
			disabled={disabled}
		/>
	);
});

DriveModelInput.displayName = 'DriveModelInput';

const HostnameInput = memo<{
	value: string;
	onChange: (updates: Partial<TestRunFormData>) => void;
	disabled: boolean;
}>(({ value, onChange, disabled }) => {
	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		onChange({ hostname: e.target.value });
	}, [onChange]);

	return (
		<input
			id="hostname"
			type="text"
			value={value}
			onChange={handleChange}
			placeholder="e.g., web-server-01"
			className="theme-form-input"
			disabled={disabled}
		/>
	);
});

HostnameInput.displayName = 'HostnameInput';

const MemoizedProtocolSelector = memo<{
	value: string;
	onChange: (updates: Partial<TestRunFormData>) => void;
	disabled: boolean;
}>(({ value, onChange, disabled }) => {
	const handleChange = useCallback((protocol: string) => {
		onChange({ protocol });
	}, [onChange]);

	return (
		<ProtocolSelector
			value={value}
			onChange={handleChange}
			disabled={disabled}
		/>
	);
});

MemoizedProtocolSelector.displayName = 'MemoizedProtocolSelector';

// Export memoized version with deep comparison
export default memo(TestRunFormFields, (prevProps: TestRunFormFieldsProps, nextProps: TestRunFormFieldsProps) => {
	// Check if form data changed
	const prevData = prevProps.formData;
	const nextData = nextProps.formData;
	if (prevData.driveModel !== nextData.driveModel ||
		prevData.driveType !== nextData.driveType ||
		prevData.customDriveType !== nextData.customDriveType ||
		prevData.showCustomType !== nextData.showCustomType ||
		prevData.hostname !== nextData.hostname ||
		prevData.protocol !== nextData.protocol) {
		return false;
	}

	// Check other simple props
	if (prevProps.mode !== nextProps.mode ||
		prevProps.disabled !== nextProps.disabled) {
		return false;
	}

	// Compare showFields object
	const prevShow = prevProps.showFields || {};
	const nextShow = nextProps.showFields || {};
	if (prevShow.driveModel !== nextShow.driveModel ||
		prevShow.driveType !== nextShow.driveType ||
		prevShow.hostname !== nextShow.hostname ||
		prevShow.protocol !== nextShow.protocol) {
		return false;
	}

	// Compare updateFlags if they exist
	if (prevProps.updateFlags !== nextProps.updateFlags) {
		if (!prevProps.updateFlags || !nextProps.updateFlags) {
			return false;
		}
		const prevFlags = prevProps.updateFlags;
		const nextFlags = nextProps.updateFlags;
		if (prevFlags.updateDriveModel !== nextFlags.updateDriveModel ||
			prevFlags.updateDriveType !== nextFlags.updateDriveType ||
			prevFlags.updateHostname !== nextFlags.updateHostname ||
			prevFlags.updateProtocol !== nextFlags.updateProtocol) {
			return false;
		}
	}

	// Callback functions should be memoized by parent, so reference equality is fine
	return true;
});

// Utility hooks for managing form state
export const useTestRunFormData = (initialData?: Partial<TestRunFormData>): [TestRunFormData, (data: TestRunFormData) => void] => {
	const [formData, setFormData] = useState<TestRunFormData>({
		driveModel: "",
		driveType: "",
		customDriveType: "",
		showCustomType: false,
		hostname: "",
		protocol: "",
		...initialData
	});

	return [formData, setFormData];
};

export const useTestRunUpdateFlags = (initialFlags?: Partial<TestRunFormFieldUpdateFlags>): [TestRunFormFieldUpdateFlags, (flags: TestRunFormFieldUpdateFlags) => void] => {
	const [updateFlags, setUpdateFlags] = useState<TestRunFormFieldUpdateFlags>({
		updateDriveModel: false,
		updateDriveType: false,
		updateHostname: false,
		updateProtocol: false,
		...initialFlags
	});

	return [updateFlags, setUpdateFlags];
};
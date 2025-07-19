import { AlertCircle, X } from "lucide-react";
import { ReactNode } from "react";

interface BaseTestRunModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	icon?: ReactNode;
	saving: boolean;
	error: string | null;
	onSave: () => void;
	saveButtonText: string;
	saveButtonIcon: ReactNode;
	children: ReactNode;
	maxWidth?: "sm" | "md" | "lg";
	saveDisabled?: boolean;
}

export default function BaseTestRunModal({
	isOpen,
	onClose,
	title,
	icon,
	saving,
	error,
	onSave,
	saveButtonText,
	saveButtonIcon,
	children,
	maxWidth = "md",
	saveDisabled = false,
}: BaseTestRunModalProps) {
	const handleClose = () => {
		if (!saving) {
			onClose();
		}
	};

	if (!isOpen) return null;

	const maxWidthClass = {
		sm: "max-w-sm",
		md: "max-w-md", 
		lg: "max-w-lg",
	}[maxWidth];

	return (
		<div className="fixed inset-0 theme-overlay flex items-center justify-center p-4 z-50">
			<div className={`theme-modal rounded-lg shadow-xl ${maxWidthClass} w-full border`}>
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b theme-border-primary">
					<h3 className="text-lg font-medium theme-text-primary flex items-center">
						{icon && <span className="mr-2">{icon}</span>}
						{title}
					</h3>
					<button
						onClick={handleClose}
						disabled={saving}
						className="theme-text-tertiary hover:theme-text-secondary disabled:opacity-50 transition-colors"
					>
						<X className="h-6 w-6" />
					</button>
				</div>

				{/* Content */}
				<div className="p-6 space-y-4">
					{children}

					{/* Error Message */}
					{error && (
						<div className="flex items-center p-3 text-sm theme-error rounded-md border">
							<AlertCircle className="h-4 w-4 mr-2" />
							{error}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 p-6 border-t theme-border-primary theme-bg-secondary">
					<button
						onClick={handleClose}
						disabled={saving}
						className="px-4 py-2 text-sm font-medium theme-btn-secondary border rounded-md transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={onSave}
						disabled={saving || saveDisabled}
						className="inline-flex items-center px-4 py-2 text-sm font-medium theme-btn-primary border border-transparent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
								{saving ? 'Saving...' : saveButtonText}
							</>
						) : (
							<>
								{saveButtonIcon}
								{saveButtonText}
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
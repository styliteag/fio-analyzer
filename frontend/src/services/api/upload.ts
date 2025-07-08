// Upload API service
import { apiUpload } from './base';

export interface UploadMetadata {
    drive_model: string;
    drive_type: string;
    hostname: string;
    protocol: string;
    description: string;
    date?: string;
}

export interface UploadResponse {
    message: string;
    test_run_ids: number[];
    skipped_jobs: number;
}

export interface UploadValidationError {
    field: string;
    message: string;
}

// Upload FIO data file with metadata
export const uploadFioData = async (
    file: File,
    metadata: UploadMetadata,
) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("drive_model", metadata.drive_model);
    formData.append("drive_type", metadata.drive_type);
    formData.append("hostname", metadata.hostname);
    formData.append("protocol", metadata.protocol);
    formData.append("description", metadata.description);
    
    if (metadata.date) {
        formData.append("date", metadata.date);
    }

    return apiUpload("/api/import", formData);
};

// Validate upload metadata
export const validateUploadMetadata = (metadata: Partial<UploadMetadata>): UploadValidationError[] => {
    const errors: UploadValidationError[] = [];

    if (!metadata.drive_model?.trim()) {
        errors.push({ field: "drive_model", message: "Drive model is required" });
    }

    if (!metadata.drive_type?.trim()) {
        errors.push({ field: "drive_type", message: "Drive type is required" });
    }

    if (!metadata.hostname?.trim()) {
        errors.push({ field: "hostname", message: "Hostname is required" });
    }

    if (!metadata.protocol?.trim()) {
        errors.push({ field: "protocol", message: "Protocol is required" });
    }

    if (!metadata.description?.trim()) {
        errors.push({ field: "description", message: "Description is required" });
    }

    // Validate date format if provided
    if (metadata.date && metadata.date.trim()) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(metadata.date)) {
            errors.push({ field: "date", message: "Date must be in YYYY-MM-DD format" });
        } else {
            const date = new Date(metadata.date);
            if (isNaN(date.getTime())) {
                errors.push({ field: "date", message: "Invalid date" });
            }
        }
    }

    return errors;
};

// Validate file for upload
export const validateUploadFile = (file: File | null): UploadValidationError[] => {
    const errors: UploadValidationError[] = [];

    if (!file) {
        errors.push({ field: "file", message: "File is required" });
        return errors;
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        errors.push({ field: "file", message: "File size must be less than 50MB" });
    }

    // Check file type (should be JSON)
    const allowedTypes = ["application/json", "text/json"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.json')) {
        errors.push({ field: "file", message: "File must be a JSON file" });
    }

    return errors;
};

// Get supported drive types
export const getSupportedDriveTypes = () => [
    "NVMe SSD",
    "SATA SSD", 
    "HDD",
    "Optane",
];

// Get supported protocols
export const getSupportedProtocols = () => [
    "Local",
    "iSCSI",
    "NFS",
    "SMB",
    "FC",
];

export interface BulkImportOptions {
    overwrite?: boolean;
    dryRun?: boolean;
}

export interface BulkImportResponse {
    message: string;
    statistics: {
        totalFiles: number;
        processedFiles: number;
        totalTestRuns: number;
        skippedFiles: number;
        errorFiles: number;
    };
    dryRunResults?: Array<{
        path: string;
        metadata: any;
    }>;
}

// Bulk import all uploaded FIO files
export const bulkImportFioData = async (options: BulkImportOptions = {}): Promise<BulkImportResponse> => {
    const response = await fetch('/api/import/bulk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            overwrite: options.overwrite || false,
            dryRun: options.dryRun || false,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Bulk import failed');
    }

    return response.json();
};
// Custom hook for file upload operations
import { useState, useCallback } from 'react';
import { 
    uploadFioData, 
    validateUploadMetadata, 
    validateUploadFile,
    getSupportedDriveTypes,
    getSupportedProtocols,
} from '../../services/api';
import type { 
    UploadMetadata, 
    UploadResponse, 
    UploadValidationError 
} from '../../services/api/upload';

export interface UseUploadResult {
    uploading: boolean;
    uploadProgress: number;
    error: string | null;
    response: UploadResponse | null;
    validationErrors: UploadValidationError[];
    supportedDriveTypes: string[];
    supportedProtocols: string[];
    uploadFile: (file: File, metadata: UploadMetadata) => Promise<boolean>;
    validateFile: (file: File | null) => UploadValidationError[];
    validateMetadata: (metadata: Partial<UploadMetadata>) => UploadValidationError[];
    reset: () => void;
}

export const useUpload = (): UseUploadResult => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [response, setResponse] = useState<UploadResponse | null>(null);
    const [validationErrors, setValidationErrors] = useState<UploadValidationError[]>([]);

    const uploadFile = useCallback(async (file: File, metadata: UploadMetadata): Promise<boolean> => {
        try {
            setUploading(true);
            setUploadProgress(0);
            setError(null);
            setResponse(null);
            setValidationErrors([]);

            // Validate file and metadata before upload
            const fileErrors = validateUploadFile(file);
            const metadataErrors = validateUploadMetadata(metadata);
            const allErrors = [...fileErrors, ...metadataErrors];

            if (allErrors.length > 0) {
                setValidationErrors(allErrors);
                setError('Validation failed. Please check the form.');
                return false;
            }

            // Simulate progress updates
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) return prev;
                    return prev + Math.random() * 20;
                });
            }, 200);

            const uploadResponse = await uploadFioData(file, metadata);
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            setResponse(uploadResponse);
            
            return true;
        } catch (err: any) {
            setError(err.message || 'Upload failed');
            console.error('Upload error:', err);
            return false;
        } finally {
            setUploading(false);
        }
    }, []);

    const validateFile = useCallback((file: File | null): UploadValidationError[] => {
        return validateUploadFile(file);
    }, []);

    const validateMetadata = useCallback((metadata: Partial<UploadMetadata>): UploadValidationError[] => {
        return validateUploadMetadata(metadata);
    }, []);

    const reset = useCallback(() => {
        setUploading(false);
        setUploadProgress(0);
        setError(null);
        setResponse(null);
        setValidationErrors([]);
    }, []);

    const supportedDriveTypes = getSupportedDriveTypes();
    const supportedProtocols = getSupportedProtocols();

    return {
        uploading,
        uploadProgress,
        error,
        response,
        validationErrors,
        supportedDriveTypes,
        supportedProtocols,
        uploadFile,
        validateFile,
        validateMetadata,
        reset,
    };
};

// Hook for batch upload operations
export interface UseBatchUploadResult {
    uploads: Array<{
        id: string;
        file: File;
        metadata: UploadMetadata;
        status: 'pending' | 'uploading' | 'completed' | 'failed';
        progress: number;
        error?: string;
        response?: UploadResponse;
    }>;
    totalProgress: number;
    isUploading: boolean;
    allCompleted: boolean;
    addUpload: (file: File, metadata: UploadMetadata) => string;
    removeUpload: (id: string) => void;
    startUploads: () => Promise<void>;
    reset: () => void;
}

export const useBatchUpload = (): UseBatchUploadResult => {
    const [uploads, setUploads] = useState<UseBatchUploadResult['uploads']>([]);
    const [isUploading, setIsUploading] = useState(false);

    const addUpload = useCallback((file: File, metadata: UploadMetadata): string => {
        const id = `upload_${Date.now()}_${Math.random()}`;
        
        setUploads(prev => [...prev, {
            id,
            file,
            metadata,
            status: 'pending',
            progress: 0,
        }]);
        
        return id;
    }, []);

    const removeUpload = useCallback((id: string) => {
        setUploads(prev => prev.filter(upload => upload.id !== id));
    }, []);

    const startUploads = useCallback(async () => {
        if (isUploading) return;

        setIsUploading(true);

        const pendingUploads = uploads.filter(upload => upload.status === 'pending');
        
        for (const upload of pendingUploads) {
            // Update status to uploading
            setUploads(prev => prev.map(u => 
                u.id === upload.id 
                    ? { ...u, status: 'uploading' as const, progress: 0 }
                    : u
            ));

            try {
                // Validate before upload
                const fileErrors = validateUploadFile(upload.file);
                const metadataErrors = validateUploadMetadata(upload.metadata);
                const allErrors = [...fileErrors, ...metadataErrors];

                if (allErrors.length > 0) {
                    throw new Error(allErrors.map(e => e.message).join(', '));
                }

                // Simulate progress
                const progressInterval = setInterval(() => {
                    setUploads(prev => prev.map(u => 
                        u.id === upload.id && u.progress < 90
                            ? { ...u, progress: u.progress + Math.random() * 20 }
                            : u
                    ));
                }, 200);

                const response = await uploadFioData(upload.file, upload.metadata);
                
                clearInterval(progressInterval);

                // Update to completed
                setUploads(prev => prev.map(u => 
                    u.id === upload.id 
                        ? { 
                            ...u, 
                            status: 'completed' as const, 
                            progress: 100,
                            response 
                        }
                        : u
                ));

            } catch (error: any) {
                // Update to failed
                setUploads(prev => prev.map(u => 
                    u.id === upload.id 
                        ? { 
                            ...u, 
                            status: 'failed' as const, 
                            error: error.message || 'Upload failed' 
                        }
                        : u
                ));
            }
        }

        setIsUploading(false);
    }, [uploads, isUploading]);

    const reset = useCallback(() => {
        setUploads([]);
        setIsUploading(false);
    }, []);

    // Calculate total progress
    const totalProgress = uploads.length > 0 
        ? uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length
        : 0;

    const allCompleted = uploads.length > 0 && uploads.every(upload => 
        upload.status === 'completed' || upload.status === 'failed'
    );

    return {
        uploads,
        totalProgress,
        isUploading,
        allCompleted,
        addUpload,
        removeUpload,
        startUploads,
        reset,
    };
};

// Hook for upload form state management
export interface UseUploadFormResult {
    formData: Partial<UploadMetadata>;
    file: File | null;
    errors: Record<string, string>;
    isValid: boolean;
    updateField: (field: keyof UploadMetadata, value: string) => void;
    setFile: (file: File | null) => void;
    reset: () => void;
    getFormData: () => UploadMetadata | null;
}

export const useUploadForm = (): UseUploadFormResult => {
    const [formData, setFormData] = useState<Partial<UploadMetadata>>({});
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const updateField = useCallback((field: keyof UploadMetadata, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [errors]);

    const setFileHandler = useCallback((newFile: File | null) => {
        setFile(newFile);
        
        // Clear file error
        if (errors.file) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.file;
                return newErrors;
            });
        }
    }, [errors]);

    const reset = useCallback(() => {
        setFormData({});
        setFile(null);
        setErrors({});
    }, []);

    const getFormData = useCallback((): UploadMetadata | null => {
        // Validate all fields
        const fileErrors = validateUploadFile(file);
        const metadataErrors = validateUploadMetadata(formData);
        const allErrors = [...fileErrors, ...metadataErrors];

        if (allErrors.length > 0) {
            const errorMap: Record<string, string> = {};
            allErrors.forEach(error => {
                errorMap[error.field] = error.message;
            });
            setErrors(errorMap);
            return null;
        }

        // Type assertion since we've validated all required fields
        return formData as UploadMetadata;
    }, [file, formData]);

    const isValid = Object.keys(errors).length === 0 && 
        file !== null && 
        formData.drive_model &&
        formData.drive_type &&
        formData.hostname &&
        formData.protocol &&
        formData.description;

    return {
        formData,
        file,
        errors,
        isValid,
        updateField,
        setFile: setFileHandler,
        reset,
        getFormData,
    };
};
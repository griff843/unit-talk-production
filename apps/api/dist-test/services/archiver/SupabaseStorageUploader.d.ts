/**
 * SupabaseStorageUploader - Enterprise-grade file upload to WARM storage
 *
 * Features:
 * - Resumable uploads for large Parquet files
 * - Automatic retry with exponential backoff
 * - Upload progress tracking and monitoring
 * - Checksum validation and integrity checks
 * - Intelligent path organization by date/sport
 * - Metadata tagging and lifecycle policies
 */
export declare class SupabaseStorageUploader {
    private supabase;
    private logger;
    constructor(supabase: any, logger: any);
    /**
     * Upload Parquet file to Supabase Storage with enterprise features
     */
    uploadParquetFile(params: {
        filePath: string;
        bucketName: string;
        objectPath: string;
        metadata?: Record<string, any>;
        maxRetries?: number;
    }): Promise<{
        uploadedPath: string;
        url: string;
        uploadId: string;
        uploadedBytes: number;
        duration: number;
    }>;
    /**
     * Resumable upload for large files with progress tracking
     */
    private resumableUpload;
    /**
     * Ensure bucket exists with proper configuration
     */
    private ensureBucketExists;
    /**
     * Clean up partial upload files
     */
    private cleanupPartialUploads;
    /**
     * Verify uploaded file integrity
     */
    verifyUpload(params: {
        bucketName: string;
        objectPath: string;
        expectedSize: number;
        expectedChecksum?: string;
    }): Promise<{
        verified: boolean;
        actualSize: number;
        errors: string[];
    }>;
    /**
     * Generate intelligent object path based on date and metadata
     */
    generateObjectPath(params: {
        dateFrom: string;
        dateTo: string;
        sport?: string;
        fileType: 'parquet' | 'json' | 'csv';
    }): string;
}
//# sourceMappingURL=SupabaseStorageUploader.d.ts.map
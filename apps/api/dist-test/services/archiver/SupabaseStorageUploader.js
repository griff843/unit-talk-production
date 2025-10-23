"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseStorageUploader = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
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
class SupabaseStorageUploader {
    constructor(supabase, logger) {
        this.supabase = supabase;
        this.logger = logger;
    }
    /**
     * Upload Parquet file to Supabase Storage with enterprise features
     */
    async uploadParquetFile(params) {
        const startTime = Date.now();
        const maxRetries = params.maxRetries || 3;
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                this.logger.info('☁️ Starting Supabase Storage upload', {
                    filePath: params.filePath,
                    bucketName: params.bucketName,
                    objectPath: params.objectPath,
                    attempt: attempt + 1,
                    maxRetries
                });
                // Get file stats for progress tracking
                const stats = await fs.stat(params.filePath);
                const fileSizeBytes = stats.size;
                const fileSizeMB = Math.round(fileSizeBytes / 1024 / 1024 * 100) / 100;
                this.logger.info('📊 File upload details', {
                    fileSizeBytes,
                    fileSizeMB,
                    lastModified: stats.mtime.toISOString()
                });
                // Ensure bucket exists
                await this.ensureBucketExists(params.bucketName);
                // For large files, use resumable upload
                if (fileSizeBytes > 50 * 1024 * 1024) { // 50MB threshold
                    return await this.resumableUpload({
                        filePath: params.filePath,
                        bucketName: params.bucketName,
                        objectPath: params.objectPath,
                        fileSizeBytes,
                        metadata: params.metadata
                    });
                }
                // Standard upload for smaller files
                const fileBuffer = await fs.readFile(params.filePath);
                // Upload with metadata
                const { data, error } = await this.supabase.storage
                    .from(params.bucketName)
                    .upload(params.objectPath, fileBuffer, {
                    cacheControl: '86400', // 24 hours cache
                    upsert: false, // Prevent accidental overwrites
                    metadata: {
                        ...params.metadata,
                        uploadedAt: new Date().toISOString(),
                        originalPath: params.filePath,
                        fileSizeBytes: fileSizeBytes.toString(),
                        uploadMethod: 'standard'
                    }
                });
                if (error) {
                    throw new Error(`Supabase upload failed: ${error.message}`);
                }
                // Get public URL
                const { data: urlData } = this.supabase.storage
                    .from(params.bucketName)
                    .getPublicUrl(params.objectPath);
                const duration = Date.now() - startTime;
                this.logger.info('✅ Supabase Storage upload completed', {
                    uploadedPath: data.path,
                    publicUrl: urlData.publicUrl,
                    fileSizeMB,
                    uploadDurationMs: duration,
                    uploadSpeedMBps: Math.round((fileSizeMB / duration) * 1000 * 100) / 100
                });
                return {
                    uploadedPath: data.path,
                    url: urlData.publicUrl,
                    uploadId: data.id || crypto.randomUUID(),
                    uploadedBytes: fileSizeBytes,
                    duration
                };
            }
            catch (error) {
                attempt++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error('❌ Upload attempt failed', {
                    attempt,
                    maxRetries,
                    error: errorMessage,
                    filePath: params.filePath
                });
                if (attempt >= maxRetries) {
                    throw new Error(`Upload failed after ${maxRetries} attempts: ${errorMessage}`);
                }
                // Exponential backoff
                const backoffMs = Math.pow(2, attempt) * 1000;
                this.logger.info('⏳ Retrying upload with backoff', {
                    backoffMs,
                    nextAttempt: attempt + 1
                });
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
        throw new Error('Upload failed: Maximum retries exceeded');
    }
    /**
     * Resumable upload for large files with progress tracking
     */
    async resumableUpload(params) {
        const startTime = Date.now();
        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(params.fileSizeBytes / chunkSize);
        this.logger.info('🔄 Starting resumable upload', {
            fileSizeBytes: params.fileSizeBytes,
            chunkSize,
            totalChunks,
            objectPath: params.objectPath
        });
        // Initialize multipart upload
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        const parts = [];
        try {
            // Read and upload file in chunks
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, params.fileSizeBytes);
                const currentChunkSize = end - start;
                this.logger.debug('📦 Uploading chunk', {
                    chunkIndex: chunkIndex + 1,
                    totalChunks,
                    chunkStart: start,
                    chunkEnd: end,
                    chunkSizeMB: Math.round(currentChunkSize / 1024 / 1024 * 100) / 100,
                    progressPercent: Math.round(((chunkIndex + 1) / totalChunks) * 100)
                });
                // Read chunk from file
                const chunk = Buffer.alloc(currentChunkSize);
                const fd = await fs.open(params.filePath, 'r');
                await fd.read(chunk, 0, currentChunkSize, start);
                await fd.close();
                // Upload chunk with part number
                const chunkPath = `${params.objectPath}_part_${chunkIndex}`;
                const { data: chunkData, error: chunkError } = await this.supabase.storage
                    .from(params.bucketName)
                    .upload(chunkPath, chunk, {
                    cacheControl: '0', // Don't cache partial uploads
                    metadata: {
                        uploadId,
                        partNumber: chunkIndex.toString(),
                        totalParts: totalChunks.toString(),
                        isPartialUpload: 'true'
                    }
                });
                if (chunkError) {
                    throw new Error(`Chunk upload failed: ${chunkError.message}`);
                }
                parts.push({
                    partNumber: chunkIndex,
                    path: chunkData.path,
                    size: currentChunkSize
                });
                // Log progress every 10 chunks or at completion
                if ((chunkIndex + 1) % 10 === 0 || chunkIndex === totalChunks - 1) {
                    const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
                    this.logger.info('📊 Upload progress', {
                        chunksCompleted: chunkIndex + 1,
                        totalChunks,
                        progressPercent,
                        uploadedMB: Math.round((chunkIndex + 1) * chunkSize / 1024 / 1024 * 100) / 100
                    });
                }
            }
            // Combine chunks into final file (simplified approach)
            // In a real implementation, you might use Supabase's multipart completion API
            const finalBuffer = Buffer.alloc(params.fileSizeBytes);
            let offset = 0;
            for (const part of parts) {
                const { data: partData, error: partError } = await this.supabase.storage
                    .from(params.bucketName)
                    .download(part.path);
                if (partError) {
                    throw new Error(`Failed to download part for combination: ${partError.message}`);
                }
                const partBuffer = Buffer.from(await partData.arrayBuffer());
                partBuffer.copy(finalBuffer, offset);
                offset += part.size;
            }
            // Upload final combined file
            const { data: finalData, error: finalError } = await this.supabase.storage
                .from(params.bucketName)
                .upload(params.objectPath, finalBuffer, {
                cacheControl: '86400',
                upsert: true, // Overwrite if exists
                metadata: {
                    ...params.metadata,
                    uploadedAt: new Date().toISOString(),
                    uploadMethod: 'resumable',
                    totalParts: totalChunks.toString(),
                    uploadId
                }
            });
            if (finalError) {
                throw new Error(`Final upload failed: ${finalError.message}`);
            }
            // Clean up temporary part files
            await this.cleanupPartialUploads(params.bucketName, parts.map(p => p.path));
            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from(params.bucketName)
                .getPublicUrl(params.objectPath);
            const duration = Date.now() - startTime;
            this.logger.info('✅ Resumable upload completed', {
                uploadedPath: finalData.path,
                publicUrl: urlData.publicUrl,
                totalParts: parts.length,
                uploadDurationMs: duration,
                uploadSpeedMBps: Math.round((params.fileSizeBytes / 1024 / 1024 / duration) * 1000 * 100) / 100
            });
            return {
                uploadedPath: finalData.path,
                url: urlData.publicUrl,
                uploadId,
                uploadedBytes: params.fileSizeBytes,
                duration
            };
        }
        catch (error) {
            // Clean up partial uploads on failure
            if (parts.length > 0) {
                await this.cleanupPartialUploads(params.bucketName, parts.map(p => p.path));
            }
            throw error;
        }
    }
    /**
     * Ensure bucket exists with proper configuration
     */
    async ensureBucketExists(bucketName) {
        try {
            // Check if bucket exists
            const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
            if (listError) {
                throw new Error(`Failed to list buckets: ${listError.message}`);
            }
            const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);
            if (!bucketExists) {
                this.logger.info('📦 Creating new storage bucket', { bucketName });
                const { error: createError } = await this.supabase.storage.createBucket(bucketName, {
                    public: false, // Private by default
                    allowedMimeTypes: ['application/octet-stream', 'application/parquet'],
                    fileSizeLimit: 500 * 1024 * 1024, // 500MB limit
                });
                if (createError) {
                    throw new Error(`Failed to create bucket: ${createError.message}`);
                }
                this.logger.info('✅ Storage bucket created successfully', { bucketName });
            }
            else {
                this.logger.debug('✓ Storage bucket already exists', { bucketName });
            }
        }
        catch (error) {
            this.logger.error('❌ Bucket creation/verification failed', {
                bucketName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Clean up partial upload files
     */
    async cleanupPartialUploads(bucketName, partPaths) {
        try {
            if (partPaths.length === 0)
                return;
            this.logger.info('🧹 Cleaning up partial upload files', {
                bucketName,
                partCount: partPaths.length
            });
            const { error } = await this.supabase.storage
                .from(bucketName)
                .remove(partPaths);
            if (error) {
                this.logger.warn('⚠️ Partial cleanup failed', {
                    error: error.message,
                    partPaths: partPaths.slice(0, 5) // Log first 5 paths
                });
            }
            else {
                this.logger.debug('✅ Partial uploads cleaned up', {
                    partCount: partPaths.length
                });
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Cleanup error (non-critical)', {
                error: error instanceof Error ? error.message : String(error),
                partCount: partPaths.length
            });
        }
    }
    /**
     * Verify uploaded file integrity
     */
    async verifyUpload(params) {
        const errors = [];
        try {
            this.logger.info('🔍 Verifying uploaded file', {
                bucketName: params.bucketName,
                objectPath: params.objectPath,
                expectedSize: params.expectedSize
            });
            // Get file info
            const { data: fileList, error: listError } = await this.supabase.storage
                .from(params.bucketName)
                .list(path.dirname(params.objectPath));
            if (listError) {
                errors.push(`Failed to list files: ${listError.message}`);
                return { verified: false, actualSize: 0, errors };
            }
            const fileName = path.basename(params.objectPath);
            const fileInfo = fileList?.find((file) => file.name === fileName);
            if (!fileInfo) {
                errors.push(`File not found in storage: ${params.objectPath}`);
                return { verified: false, actualSize: 0, errors };
            }
            const actualSize = fileInfo.metadata?.size || 0;
            // Verify file size
            if (actualSize !== params.expectedSize) {
                errors.push(`Size mismatch: expected ${params.expectedSize}, got ${actualSize}`);
            }
            // Verify checksum if provided
            if (params.expectedChecksum) {
                // Download file to compute checksum (for smaller files)
                if (actualSize < 100 * 1024 * 1024) { // Only for files < 100MB
                    const { data: fileData, error: downloadError } = await this.supabase.storage
                        .from(params.bucketName)
                        .download(params.objectPath);
                    if (downloadError) {
                        errors.push(`Failed to download for checksum verification: ${downloadError.message}`);
                    }
                    else {
                        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
                        const buffer = Buffer.from(await fileData.arrayBuffer());
                        const actualChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
                        if (actualChecksum !== params.expectedChecksum) {
                            errors.push(`Checksum mismatch: expected ${params.expectedChecksum}, got ${actualChecksum}`);
                        }
                    }
                }
            }
            const verified = errors.length === 0;
            this.logger.info('✅ Upload verification completed', {
                verified,
                actualSize,
                expectedSize: params.expectedSize,
                errors: errors.length
            });
            return {
                verified,
                actualSize,
                errors
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`Verification error: ${errorMessage}`);
            return {
                verified: false,
                actualSize: 0,
                errors
            };
        }
    }
    /**
     * Generate intelligent object path based on date and metadata
     */
    generateObjectPath(params) {
        const fromDate = new Date(params.dateFrom);
        const year = fromDate.getFullYear();
        const month = String(fromDate.getMonth() + 1).padStart(2, '0');
        const day = String(fromDate.getDate()).padStart(2, '0');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sportPrefix = params.sport ? `${params.sport.toLowerCase()}/` : '';
        return `prop-ticks/${year}/${month}/${day}/${sportPrefix}ticks_${params.dateFrom}_${timestamp}.${params.fileType}`;
    }
}
exports.SupabaseStorageUploader = SupabaseStorageUploader;

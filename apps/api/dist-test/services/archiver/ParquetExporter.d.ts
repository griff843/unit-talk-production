interface ParquetExporterConfig {
    outputDir: string;
    compressionLevel: number;
    batchSize: number;
    maxFileSize: number;
    enableCompression: boolean;
}
interface ExportResult {
    filePath: string;
    recordCount: number;
    fileSizeBytes: number;
    compressionRatio: number;
    checksum: string;
    metadata: {
        dateRange: {
            from: string;
            to: string;
        };
        sports: string[];
        totalBooks: number;
        avgRecordsPerSecond: number;
        processingTime: number;
    };
}
/**
 * ParquetExporter - High-performance data export for WARM storage
 *
 * Features:
 * - Streaming export for memory efficiency with 8K+ props
 * - Columnar compression optimized for time-series data
 * - Automatic batching and file size management
 * - Schema validation and data quality checks
 * - Checksums and integrity validation
 */
export declare class ParquetExporter {
    private config;
    private logger;
    constructor(config: Partial<ParquetExporterConfig>, logger: any);
    /**
     * Export prop tick data to compressed Parquet format
     */
    exportToParquet(params: {
        dateFrom: string;
        dateTo: string;
        supabase: any;
        tableName?: string;
    }): Promise<ExportResult>;
    /**
     * Write data to Parquet file with streaming and compression
     */
    private writeParquetFile;
    /**
     * Generate Parquet schema for prop tick data
     */
    private generateParquetSchema;
    /**
     * Convert row data to columnar format for efficient compression
     */
    private toColumnarFormat;
    /**
     * Build optimized export query
     */
    private buildExportQuery;
    /**
     * Sanitize record for export (remove nulls, validate types)
     */
    private sanitizeRecord;
    /**
     * Validate exported file integrity
     */
    validateExport(filePath: string, expectedRecords: number, expectedChecksum: string): Promise<{
        isValid: boolean;
        actualRecords: number;
        actualChecksum: string;
        errors: string[];
    }>;
    /**
     * Clean up temporary files
     */
    cleanup(filePaths: string[]): Promise<void>;
}
export {};
//# sourceMappingURL=ParquetExporter.d.ts.map
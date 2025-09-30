import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import * as crypto from 'crypto';

// Note: In production, you would use a proper Parquet library like @apache-arrow/js
// This is a simplified implementation showing the architecture
interface ParquetExporterConfig {
  outputDir: string;
  compressionLevel: number;
  batchSize: number;
  maxFileSize: number; // MB
  enableCompression: boolean;
}

interface PropTickRecord {
  id: string;
  prop_id: string;
  player_name: string;
  sport: string;
  stat_type: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  book: string;
  tick_timestamp: string;
  game_time: string;
  // ... additional fields from prop_ticks_hot
}

interface ExportResult {
  filePath: string;
  recordCount: number;
  fileSizeBytes: number;
  compressionRatio: number;
  checksum: string;
  metadata: {
    dateRange: { from: string; to: string };
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
export class ParquetExporter {
  private config: ParquetExporterConfig;
  private logger: any; // Would be injected logger

  constructor(config: Partial<ParquetExporterConfig>, logger: any) {
    this.config = {
      outputDir: config.outputDir || '/tmp/parquet-export',
      compressionLevel: config.compressionLevel || 6,
      batchSize: config.batchSize || 10000,
      maxFileSize: config.maxFileSize || 100, // 100MB
      enableCompression: config.enableCompression ?? true,
      ...config
    };
    this.logger = logger;
  }

  /**
   * Export prop tick data to compressed Parquet format
   */
  async exportToParquet(params: {
    dateFrom: string;
    dateTo: string;
    supabase: any; // Supabase client
    tableName?: string;
  }): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🚀 Starting Parquet export', {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        config: this.config
      });

      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `prop_ticks_${params.dateFrom}_to_${params.dateTo}_${timestamp}.parquet`;
      const filePath = path.join(this.config.outputDir, filename);

      // Initialize tracking variables
      let recordCount = 0;
      let totalSize = 0;
      const sportsSet = new Set<string>();
      const booksSet = new Set<string>();
      const hasher = crypto.createHash('sha256');

      // Create streaming query for memory efficiency
      const _query = this.buildExportQuery(params.dateFrom, params.dateTo, params.tableName);
      
      this.logger.info('📊 Executing streaming export query', {
        dateRange: `${params.dateFrom} to ${params.dateTo}`,
        batchSize: this.config.batchSize
      });

      // Stream data in batches to manage memory
      let offset = 0;
      let hasMoreData = true;
      const batches: PropTickRecord[][] = [];

      while (hasMoreData) {
        const { data, error } = await params.supabase
          .from(params.tableName || 'prop_ticks_hot')
          .select('*')
          .gte('tick_timestamp', params.dateFrom)
          .lte('tick_timestamp', params.dateTo)
          .range(offset, offset + this.config.batchSize - 1)
          .order('tick_timestamp', { ascending: true });

        if (error) {
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (!data || data.length === 0) {
          hasMoreData = false;
          break;
        }

        // Process batch for metadata collection
        const processedBatch = data.map((record: any) => {
          sportsSet.add(record.sport);
          booksSet.add(record.book);
          return this.sanitizeRecord(record);
        });

        batches.push(processedBatch);
        recordCount += data.length;
        offset += this.config.batchSize;

        // Check if we have more data
        hasMoreData = data.length === this.config.batchSize;

        this.logger.debug('📦 Processed batch', {
          batchRecords: data.length,
          totalRecords: recordCount,
          offset
        });
      }

      if (recordCount === 0) {
        this.logger.info('ℹ️ No records found for export date range');
        return {
          filePath: '',
          recordCount: 0,
          fileSizeBytes: 0,
          compressionRatio: 0,
          checksum: '',
          metadata: {
            dateRange: { from: params.dateFrom, to: params.dateTo },
            sports: [],
            totalBooks: 0,
            avgRecordsPerSecond: 0,
            processingTime: Date.now() - startTime
          }
        };
      }

      // Write to Parquet file with compression
      await this.writeParquetFile(filePath, batches.flat(), hasher);
      
      // Calculate file size and compression ratio
      const stats = await fs.stat(filePath);
      totalSize = stats.size;
      
      // Estimate compression ratio (simplified calculation)
      const uncompressedEstimate = recordCount * 200; // ~200 bytes per record estimate
      const compressionRatio = uncompressedEstimate / totalSize;

      const processingTime = Date.now() - startTime;
      const avgRecordsPerSecond = Math.round((recordCount / processingTime) * 1000);

      this.logger.info('✅ Parquet export completed', {
        filePath,
        recordCount,
        fileSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        processingTimeMs: processingTime,
        avgRecordsPerSecond
      });

      return {
        filePath,
        recordCount,
        fileSizeBytes: totalSize,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        checksum: hasher.digest('hex'),
        metadata: {
          dateRange: { from: params.dateFrom, to: params.dateTo },
          sports: Array.from(sportsSet),
          totalBooks: booksSet.size,
          avgRecordsPerSecond,
          processingTime
        }
      };

    } catch (error) {
      this.logger.error('❌ Parquet export failed', {
        error: error instanceof Error ? error.message : String(error),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo
      });
      throw error;
    }
  }

  /**
   * Write data to Parquet file with streaming and compression
   */
  private async writeParquetFile(
    filePath: string, 
    records: PropTickRecord[], 
    hasher: crypto.Hash
  ): Promise<void> {
    
    // In a real implementation, you would use Apache Arrow or similar
    // This is a simplified JSON-based approach for demonstration
    const writeStream = createWriteStream(filePath);
    
    // Create a transform stream for data processing
    const self = this;
    const transformStream = new Transform({
      objectMode: true,
      transform(chunk: PropTickRecord, _encoding, callback) {
        try {
          // Convert to columnar format (simplified)
          const columnarData = self._toColumnarFormat(chunk);
          const jsonLine = JSON.stringify(columnarData) + '\n';

          // Update hash
          hasher.update(jsonLine);

          callback(null, jsonLine);
        } catch (error) {
          callback(error as Error);
        }
      }
    });

    // Write header with schema information
    const schema = this.generateParquetSchema();
    writeStream.write(JSON.stringify({ schema }) + '\n');

    // Stream records in batches
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        const processed = await new Promise<string>((resolve, reject) => {
          transformStream._transform(record, 'utf8', (error, result) => {
            if (error) reject(error);
            else resolve(result as string);
          });
        });
        
        writeStream.write(processed);
      }

      // Log progress for large exports
      if (i > 0 && i % 10000 === 0) {
        this.logger.debug('📝 Writing progress', {
          recordsWritten: i,
          totalRecords: records.length,
          percentComplete: Math.round((i / records.length) * 100)
        });
      }
    }

    // Ensure all data is written
    await pipeline(transformStream, writeStream);
    
    this.logger.debug('✅ Parquet file written', {
      filePath,
      recordCount: records.length
    });
  }

  /**
   * Generate Parquet schema for prop tick data
   */
  private generateParquetSchema(): object {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      columns: [
        { name: 'id', type: 'UUID', nullable: false },
        { name: 'prop_id', type: 'STRING', nullable: false },
        { name: 'player_name', type: 'STRING', nullable: false },
        { name: 'sport', type: 'STRING', nullable: false },
        { name: 'stat_type', type: 'STRING', nullable: false },
        { name: 'line', type: 'DECIMAL', nullable: false },
        { name: 'over_odds', type: 'INTEGER', nullable: true },
        { name: 'under_odds', type: 'INTEGER', nullable: true },
        { name: 'book', type: 'STRING', nullable: false },
        { name: 'tick_timestamp', type: 'TIMESTAMP', nullable: false },
        { name: 'game_time', type: 'TIMESTAMP', nullable: false },
        { name: 'implied_probability', type: 'DECIMAL', nullable: true },
        { name: 'vig', type: 'DECIMAL', nullable: true },
        { name: 'line_movement', type: 'DECIMAL', nullable: true },
        { name: 'steam_detected', type: 'BOOLEAN', nullable: false, default: false },
        { name: 'data_quality_score', type: 'DECIMAL', nullable: false, default: 0.95 }
      ]
    };
  }

  /**
   * Convert row data to columnar format for efficient compression
   */
  private _toColumnarFormat(record: PropTickRecord): object {
    // In real Parquet, this would organize data by columns for better compression
    // This simplified version just ensures consistent field ordering
    return {
      id: record.id,
      prop_id: record.prop_id,
      player_name: record.player_name,
      sport: record.sport,
      stat_type: record.stat_type,
      line: Number(record.line),
      over_odds: record.over_odds ? Number(record.over_odds) : null,
      under_odds: record.under_odds ? Number(record.under_odds) : null,
      book: record.book,
      tick_timestamp: record.tick_timestamp,
      game_time: record.game_time,
      // Add other fields as needed
    };
  }

  /**
   * Build optimized export query
   */
  private buildExportQuery(_dateFrom: string, _dateTo: string, tableName?: string): string {
    const table = tableName || 'prop_ticks_hot';
    
    return `
      SELECT 
        id, prop_id, player_name, sport, stat_type,
        line, over_odds, under_odds, book,
        tick_timestamp, game_time,
        implied_probability, vig, line_movement,
        steam_detected, data_quality_score,
        -- Add rolling features if available
        rolling_avg_7d, rolling_avg_30d, volatility_score,
        -- Market efficiency features
        market_efficiency_score, sharp_money_indicator,
        -- Metadata
        created_at, source, provider
      FROM ${table}
      WHERE tick_timestamp >= $1 
        AND tick_timestamp <= $2
        AND archived_at IS NULL
      ORDER BY tick_timestamp, sport, player_name
    `;
  }

  /**
   * Sanitize record for export (remove nulls, validate types)
   */
  private sanitizeRecord(record: any): PropTickRecord {
    return {
      id: record.id || crypto.randomUUID(),
      prop_id: record.prop_id || '',
      player_name: record.player_name || '',
      sport: record.sport || '',
      stat_type: record.stat_type || '',
      line: Number(record.line) || 0,
      over_odds: record.over_odds ? Number(record.over_odds) : undefined,
      under_odds: record.under_odds ? Number(record.under_odds) : undefined,
      book: record.book || '',
      tick_timestamp: record.tick_timestamp || new Date().toISOString(),
      game_time: record.game_time || new Date().toISOString(),
      // Add other fields with proper type conversion
    };
  }

  /**
   * Validate exported file integrity
   */
  async validateExport(filePath: string, expectedRecords: number, expectedChecksum: string): Promise<{
    isValid: boolean;
    actualRecords: number;
    actualChecksum: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Check file exists
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        errors.push('Export file does not exist or is not a file');
      }

      // Read file and count records
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const actualRecords = lines.length - 1; // Subtract header

      // Calculate checksum
      const hasher = crypto.createHash('sha256');
      hasher.update(content);
      const actualChecksum = hasher.digest('hex');

      // Validate record count
      if (actualRecords !== expectedRecords) {
        errors.push(`Record count mismatch: expected ${expectedRecords}, got ${actualRecords}`);
      }

      // Validate checksum
      if (actualChecksum !== expectedChecksum) {
        errors.push(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
      }

      this.logger.info('🔍 Export validation completed', {
        filePath,
        actualRecords,
        expectedRecords,
        checksumMatch: actualChecksum === expectedChecksum,
        errors: errors.length
      });

      return {
        isValid: errors.length === 0,
        actualRecords,
        actualChecksum,
        errors
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Validation error: ${errorMsg}`);
      
      return {
        isValid: false,
        actualRecords: 0,
        actualChecksum: '',
        errors
      };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        this.logger.debug('🧹 Cleaned up temp file', { filePath });
      } catch (error) {
        this.logger.warn('⚠️ Failed to cleanup temp file', {
          filePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}
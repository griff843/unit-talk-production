/**
 * Apply Critical Database Indexes
 * Safely applies performance-critical indexes to production database
 * Uses CONCURRENTLY to avoid blocking production traffic
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
};

interface IndexCreationResult {
  indexName: string;
  success: boolean;
  error?: string;
  executionTimeMs: number;
}

class CriticalIndexManager {
  private supabase: any;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Apply all critical indexes from SQL file
   */
  async applyCriticalIndexes(): Promise<IndexCreationResult[]> {
    logger.info('🚀 Starting critical index creation process');

    try {
      // Read the SQL file
      const sqlFilePath = join(__dirname, '../apps/api/src/database/migrations/create-critical-indexes.sql');
      const sqlContent = readFileSync(sqlFilePath, 'utf-8');

      // Extract individual CREATE INDEX statements
      const indexStatements = this.extractIndexStatements(sqlContent);
      
      logger.info(`📊 Found ${indexStatements.length} index creation statements`);

      // Apply indexes one by one with progress tracking
      const results: IndexCreationResult[] = [];
      
      for (let i = 0; i < indexStatements.length; i++) {
        const statement = indexStatements[i];
        const indexName = this.extractIndexName(statement);
        
        logger.info(`⏳ Creating index ${i + 1}/${indexStatements.length}: ${indexName}`);
        
        const result = await this.createIndexSafely(statement, indexName);
        results.push(result);
        
        if (result.success) {
          logger.info(`✅ Index created successfully: ${indexName} (${result.executionTimeMs}ms)`);
        } else {
          logger.error(`❌ Failed to create index: ${indexName}`, result.error);
        }
      }

      // Apply ANALYZE statements
      await this.analyzeTablesAfterIndexing();

      // Generate performance report
      await this.generatePerformanceReport(results);

      return results;

    } catch (error) {
      logger.error('❌ Critical error during index creation', error);
      throw error;
    }
  }

  /**
   * Extract CREATE INDEX statements from SQL content
   */
  private extractIndexStatements(sqlContent: string): string[] {
    const statements: string[] = [];
    
    // Split by semicolons and filter for CREATE INDEX statements
    const lines = sqlContent.split('\n');
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // If line ends with semicolon, we have a complete statement
      if (trimmedLine.endsWith(';')) {
        if (currentStatement.includes('CREATE INDEX CONCURRENTLY')) {
          statements.push(currentStatement.trim());
        }
        currentStatement = '';
      }
    }
    
    return statements;
  }

  /**
   * Extract index name from CREATE INDEX statement
   */
  private extractIndexName(statement: string): string {
    const match = statement.match(/CREATE INDEX CONCURRENTLY IF NOT EXISTS (\w+)/i);
    return match ? match[1] : 'unknown_index';
  }

  /**
   * Create index safely with error handling and timing
   */
  private async createIndexSafely(statement: string, indexName: string): Promise<IndexCreationResult> {
    const startTime = Date.now();
    
    try {
      // Execute the CREATE INDEX statement
      const { error } = await this.supabase.rpc('exec_sql', { sql: statement });
      
      const executionTimeMs = Date.now() - startTime;
      
      if (error) {
        // Check if error is because index already exists
        if (error.message.includes('already exists')) {
          logger.warn(`⚠️ Index already exists: ${indexName}`);
          return {
            indexName,
            success: true,
            executionTimeMs,
          };
        }
        
        return {
          indexName,
          success: false,
          error: error.message,
          executionTimeMs,
        };
      }
      
      return {
        indexName,
        success: true,
        executionTimeMs,
      };
      
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      return {
        indexName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
      };
    }
  }

  /**
   * Analyze tables after index creation
   */
  private async analyzeTablesAfterIndexing(): Promise<void> {
    logger.info('📊 Analyzing tables after index creation');
    
    const tables = ['unified_picks', 'raw_props', 'agent_health', 'agent_metrics', 'users'];
    
    for (const table of tables) {
      try {
        await this.supabase.rpc('exec_sql', { sql: `ANALYZE ${table};` });
        logger.info(`✅ Analyzed table: ${table}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to analyze table: ${table}`, error);
      }
    }
  }

  /**
   * Generate performance report
   */
  private async generatePerformanceReport(results: IndexCreationResult[]): Promise<void> {
    logger.info('📈 Generating performance report');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);
    
    logger.info('🎯 Index Creation Summary:', {
      totalIndexes: results.length,
      successful: successful.length,
      failed: failed.length,
      totalExecutionTimeMs: totalTime,
      avgExecutionTimeMs: Math.round(totalTime / results.length),
    });
    
    if (failed.length > 0) {
      logger.error('❌ Failed indexes:', failed.map(f => ({ name: f.indexName, error: f.error })));
    }
    
    // Test query performance
    await this.testQueryPerformance();
  }

  /**
   * Test query performance after index creation
   */
  private async testQueryPerformance(): Promise<void> {
    logger.info('🧪 Testing query performance');
    
    const testQueries = [
      {
        name: 'unified_picks_user_query',
        sql: `SELECT COUNT(*) FROM unified_picks WHERE user_id IS NOT NULL`,
      },
      {
        name: 'raw_props_unprocessed_query',
        sql: `SELECT COUNT(*) FROM raw_props WHERE processed_at IS NULL`,
      },
      {
        name: 'agent_health_recent_query',
        sql: `SELECT COUNT(*) FROM agent_health WHERE timestamp > NOW() - INTERVAL '1 hour'`,
      },
    ];
    
    for (const query of testQueries) {
      try {
        const startTime = Date.now();
        await this.supabase.rpc('exec_sql', { sql: query.sql });
        const executionTime = Date.now() - startTime;
        
        logger.info(`⚡ Query performance: ${query.name} - ${executionTime}ms`);
      } catch (error) {
        logger.warn(`⚠️ Failed to test query: ${query.name}`, error);
      }
    }
  }
}

// Main execution
async function main() {
  try {
    const indexManager = new CriticalIndexManager();
    const results = await indexManager.applyCriticalIndexes();
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
      logger.info('🎉 All critical indexes created successfully!');
      process.exit(0);
    } else {
      logger.error(`⚠️ ${totalCount - successCount} indexes failed to create`);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('💥 Fatal error during index creation', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { CriticalIndexManager };

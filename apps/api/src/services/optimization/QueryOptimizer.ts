import { SupabaseClient } from '@supabase/supabase-js';
import { Logger, createLogger } from '../../utils/logger';

export interface QueryStats {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  minTime: number;
  maxTime: number;
  recommendations: string[];
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  estimatedImprovement: number;
}

export class QueryOptimizer {
  private logger: Logger;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.logger = createLogger('QueryOptimizer');
  }

  /**
   * Analyze slow queries and provide recommendations
   */
  async analyzeSlowQueries(thresholdMs: number = 100): Promise<QueryStats[]> {
    this.logger.info(`Analyzing queries slower than ${thresholdMs}ms`);

    try {
      // Get slow queries from pg_stat_statements
      const { data: slowQueries, error } = await this.supabase.rpc('get_slow_queries', {
        threshold_ms: thresholdMs,
      });

      if (error) {
        this.logger.error('Failed to fetch slow queries:', error);
        return [];
      }

      // Analyze each query
      const analyzedQueries: QueryStats[] = [];
      
      for (const query of slowQueries || []) {
        const stats: QueryStats = {
          query: query.query,
          calls: query.calls,
          totalTime: query.total_time,
          meanTime: query.mean_time,
          minTime: query.min_time,
          maxTime: query.max_time,
          recommendations: this.generateRecommendations(query),
        };
        
        analyzedQueries.push(stats);
      }

      return analyzedQueries;
    } catch (error) {
      this.logger.error('Query analysis failed:', error);
      return [];
    }
  }

  /**
   * Generate index recommendations based on query patterns
   */
  async generateIndexRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Analyze common query patterns
    const patterns = await this.analyzeQueryPatterns();

    // Check for missing indexes on foreign keys
    const fkIndexes = await this.checkForeignKeyIndexes();
    recommendations.push(...fkIndexes);

    // Check for missing indexes on commonly filtered columns
    const filterIndexes = await this.checkFilterColumns();
    recommendations.push(...filterIndexes);

    // Check for missing indexes on JOIN columns
    const joinIndexes = await this.checkJoinColumns();
    recommendations.push(...joinIndexes);

    // Check for composite index opportunities
    const compositeIndexes = await this.checkCompositeIndexes();
    recommendations.push(...compositeIndexes);

    return recommendations;
  }

  /**
   * Create missing indexes with safety checks
   */
  async createRecommendedIndexes(
    recommendations: IndexRecommendation[],
    dryRun: boolean = true
  ): Promise<void> {
    for (const rec of recommendations) {
      const indexName = this.generateIndexName(rec.table, rec.columns);
      const columnList = rec.columns.join(', ');
      
      const sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} 
                   ON ${rec.table} (${columnList})`;

      if (dryRun) {
        this.logger.info(`[DRY RUN] Would create index: ${sql}`);
      } else {
        try {
          await this.supabase.rpc('create_index_safe', {
            index_sql: sql,
          });
          this.logger.info(`Created index: ${indexName}`);
        } catch (error) {
          this.logger.error(`Failed to create index ${indexName}:`, error);
        }
      }
    }
  }

  /**
   * Optimize materialized views
   */
  async optimizeMaterializedViews(): Promise<void> {
    this.logger.info('Optimizing materialized views');

    // Get all materialized views
    const { data: mvList, error } = await this.supabase.rpc('get_materialized_views');
    
    if (error || !mvList) {
      this.logger.error('Failed to fetch materialized views:', error);
      return;
    }

    for (const mv of mvList) {
      // Analyze MV query performance
      const refreshTime = await this.measureMVRefreshTime(mv.schemaname, mv.matviewname);
      
      if (refreshTime > 800) { // SLO target
        this.logger.warn(`MV ${mv.matviewname} refresh time ${refreshTime}ms exceeds SLO`);
        
        // Generate optimization recommendations
        const optimizations = await this.generateMVOptimizations(mv);
        
        for (const opt of optimizations) {
          this.logger.info(`Recommendation for ${mv.matviewname}: ${opt}`);
        }
      }
    }
  }

  /**
   * Generate recommendations for a slow query
   */
  private generateRecommendations(query: any): string[] {
    const recommendations: string[] = [];

    // Check for sequential scans
    if (query.query.toLowerCase().includes('seq scan')) {
      recommendations.push('Consider adding indexes to avoid sequential scans');
    }

    // Check for missing WHERE clause on large tables
    if (!query.query.toLowerCase().includes('where') && query.rows > 10000) {
      recommendations.push('Add WHERE clause to limit result set');
    }

    // Check for SELECT *
    if (query.query.includes('SELECT *')) {
      recommendations.push('Select only required columns instead of SELECT *');
    }

    // Check for missing LIMIT on large results
    if (!query.query.toLowerCase().includes('limit') && query.rows > 1000) {
      recommendations.push('Consider adding LIMIT clause for large result sets');
    }

    // Check for expensive JOINs
    const joinCount = (query.query.match(/join/gi) || []).length;
    if (joinCount > 3) {
      recommendations.push('Consider reducing number of JOINs or using materialized views');
    }

    return recommendations;
  }

  /**
   * Analyze query patterns to identify optimization opportunities
   */
  private async analyzeQueryPatterns(): Promise<Map<string, number>> {
    const patterns = new Map<string, number>();

    try {
      const { data, error } = await this.supabase.rpc('analyze_query_patterns');
      
      if (!error && data) {
        for (const pattern of data) {
          patterns.set(pattern.pattern, pattern.frequency);
        }
      }
    } catch (error) {
      this.logger.error('Failed to analyze query patterns:', error);
    }

    return patterns;
  }

  /**
   * Check for missing indexes on foreign keys
   */
  private async checkForeignKeyIndexes(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    const { data: missingIndexes, error } = await this.supabase.rpc('find_missing_fk_indexes');

    if (!error && missingIndexes) {
      for (const fk of missingIndexes) {
        recommendations.push({
          table: fk.table_name,
          columns: [fk.column_name],
          type: 'btree',
          reason: `Missing index on foreign key ${fk.column_name}`,
          estimatedImprovement: 30,
        });
      }
    }

    return recommendations;
  }

  /**
   * Check for missing indexes on commonly filtered columns
   */
  private async checkFilterColumns(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Key filter columns based on our schema
    const filterColumns = [
      { table: 'unified_picks', column: 'created_at', type: 'btree' as const },
      { table: 'unified_picks', column: 'sport', type: 'btree' as const },
      { table: 'unified_picks', column: 'status', type: 'btree' as const },
      { table: 'raw_props', column: 'game_date', type: 'btree' as const },
      { table: 'raw_props', column: 'player_name', type: 'btree' as const },
      { table: 'users', column: 'discord_id', type: 'hash' as const },
    ];

    for (const col of filterColumns) {
      const hasIndex = await this.checkIndexExists(col.table, [col.column]);
      
      if (!hasIndex) {
        recommendations.push({
          table: col.table,
          columns: [col.column],
          type: col.type,
          reason: `Frequently filtered column without index`,
          estimatedImprovement: 40,
        });
      }
    }

    return recommendations;
  }

  /**
   * Check for missing indexes on JOIN columns
   */
  private async checkJoinColumns(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Common JOIN patterns in our system
    const joinPatterns = [
      { table: 'unified_picks', column: 'user_id' },
      { table: 'unified_picks', column: 'raw_prop_id' },
      { table: 'agent_health', column: 'agent_name' },
    ];

    for (const pattern of joinPatterns) {
      const hasIndex = await this.checkIndexExists(pattern.table, [pattern.column]);
      
      if (!hasIndex) {
        recommendations.push({
          table: pattern.table,
          columns: [pattern.column],
          type: 'btree',
          reason: `JOIN column without index`,
          estimatedImprovement: 50,
        });
      }
    }

    return recommendations;
  }

  /**
   * Check for composite index opportunities
   */
  private async checkCompositeIndexes(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Common multi-column filter patterns
    const compositePatterns = [
      { table: 'unified_picks', columns: ['sport', 'created_at'] },
      { table: 'unified_picks', columns: ['user_id', 'status'] },
      { table: 'raw_props', columns: ['sport', 'game_date'] },
      { table: 'raw_props', columns: ['player_name', 'stat_type'] },
    ];

    for (const pattern of compositePatterns) {
      const hasIndex = await this.checkIndexExists(pattern.table, pattern.columns);
      
      if (!hasIndex) {
        recommendations.push({
          table: pattern.table,
          columns: pattern.columns,
          type: 'btree',
          reason: `Composite index for common filter combination`,
          estimatedImprovement: 35,
        });
      }
    }

    return recommendations;
  }

  /**
   * Check if an index exists
   */
  private async checkIndexExists(table: string, columns: string[]): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('check_index_exists', {
        table_name: table,
        column_names: columns,
      });

      return !error && data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate index name
   */
  private generateIndexName(table: string, columns: string[]): string {
    const columnPart = columns.join('_');
    return `idx_${table}_${columnPart}`;
  }

  /**
   * Measure materialized view refresh time
   */
  private async measureMVRefreshTime(schema: string, name: string): Promise<number> {
    const start = Date.now();
    
    try {
      await this.supabase.rpc('refresh_materialized_view', {
        schema_name: schema,
        view_name: name,
      });
      
      return Date.now() - start;
    } catch (error) {
      this.logger.error(`Failed to measure MV refresh time for ${name}:`, error);
      return -1;
    }
  }

  /**
   * Generate optimization recommendations for a materialized view
   */
  private async generateMVOptimizations(mv: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Check if MV has proper indexes
    recommendations.push(`Ensure indexes exist on ${mv.matviewname} for common query patterns`);

    // Check if MV could be incrementally refreshed
    recommendations.push(`Consider incremental refresh strategy for ${mv.matviewname}`);

    // Check if MV query could be optimized
    recommendations.push(`Review and optimize the underlying query for ${mv.matviewname}`);

    return recommendations;
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport(): Promise<string> {
    const report: string[] = [];
    
    report.push('# Query Optimization Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Slow queries
    report.push('## Slow Queries');
    const slowQueries = await this.analyzeSlowQueries(100);
    
    for (const query of slowQueries.slice(0, 10)) {
      report.push(`### Query (${query.meanTime.toFixed(1)}ms avg)`);
      report.push('```sql');
      report.push(query.query.substring(0, 200) + '...');
      report.push('```');
      report.push('**Recommendations:**');
      query.recommendations.forEach(rec => report.push(`- ${rec}`));
      report.push('');
    }

    // Index recommendations
    report.push('## Index Recommendations');
    const indexRecs = await this.generateIndexRecommendations();
    
    for (const rec of indexRecs) {
      report.push(`- **${rec.table}** (${rec.columns.join(', ')})`);
      report.push(`  - Reason: ${rec.reason}`);
      report.push(`  - Estimated improvement: ${rec.estimatedImprovement}%`);
    }

    return report.join('\n');
  }
}
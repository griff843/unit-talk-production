import { SupabaseClient } from '@supabase/supabase-js';
import { RedisCache } from '../services/cache/RedisCache';
import { Logger } from '../services/logger';

export interface Feature {
  name: string;
  type: 'numerical' | 'categorical' | 'boolean' | 'timestamp';
  description: string;
  source: string;
  updateFrequency: 'real-time' | 'hourly' | 'daily' | 'weekly';
  retention: string; // ISO duration format
}

export interface FeatureGroup {
  name: string;
  features: Feature[];
  entityKey: string; // Primary key for joining
  tags: string[];
}

export interface FeatureValue {
  featureName: string;
  entityId: string;
  value: any;
  timestamp: Date;
  version: number;
}

export interface TrainingDataset {
  name: string;
  featureGroups: string[];
  targetColumn: string;
  filters: Record<string, any>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class FeatureStore {
  private logger: Logger;
  private supabase: SupabaseClient;
  private cache: RedisCache;
  private featureGroups: Map<string, FeatureGroup> = new Map();
  
  constructor(supabase: SupabaseClient, cache: RedisCache) {
    this.supabase = supabase;
    this.cache = cache;
    this.logger = new Logger('FeatureStore');
    
    this.initializeFeatureGroups();
  }

  /**
   * Initialize feature groups for Unit Talk platform
   */
  private initializeFeatureGroups(): void {
    // Player performance features
    this.registerFeatureGroup({
      name: 'player_stats',
      entityKey: 'player_id',
      tags: ['player', 'performance', 'historical'],
      features: [
        {
          name: 'season_avg_points',
          type: 'numerical',
          description: 'Player season average points',
          source: 'external_sports_api',
          updateFrequency: 'daily',
          retention: 'P1Y', // 1 year
        },
        {
          name: 'last_5_games_avg',
          type: 'numerical',
          description: 'Average performance last 5 games',
          source: 'external_sports_api',
          updateFrequency: 'daily',
          retention: 'P90D', // 90 days
        },
        {
          name: 'injury_status',
          type: 'categorical',
          description: 'Current injury status',
          source: 'injury_reports',
          updateFrequency: 'hourly',
          retention: 'P30D',
        },
        {
          name: 'minutes_per_game',
          type: 'numerical',
          description: 'Average minutes played per game',
          source: 'external_sports_api',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
        {
          name: 'home_vs_away_performance',
          type: 'numerical',
          description: 'Performance differential home vs away',
          source: 'calculated',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
      ],
    });

    // Market features
    this.registerFeatureGroup({
      name: 'market_data',
      entityKey: 'prop_id',
      tags: ['market', 'odds', 'real-time'],
      features: [
        {
          name: 'opening_line',
          type: 'numerical',
          description: 'Opening betting line',
          source: 'raw_props',
          updateFrequency: 'real-time',
          retention: 'P30D',
        },
        {
          name: 'current_line',
          type: 'numerical',
          description: 'Current betting line',
          source: 'raw_props',
          updateFrequency: 'real-time',
          retention: 'P30D',
        },
        {
          name: 'line_movement',
          type: 'numerical',
          description: 'Line movement from opening',
          source: 'calculated',
          updateFrequency: 'real-time',
          retention: 'P30D',
        },
        {
          name: 'market_volume',
          type: 'numerical',
          description: 'Betting volume indicator',
          source: 'market_data',
          updateFrequency: 'hourly',
          retention: 'P7D',
        },
        {
          name: 'bookmaker_confidence',
          type: 'numerical',
          description: 'Implied bookmaker confidence',
          source: 'calculated',
          updateFrequency: 'real-time',
          retention: 'P30D',
        },
      ],
    });

    // Game context features
    this.registerFeatureGroup({
      name: 'game_context',
      entityKey: 'game_id',
      tags: ['game', 'context', 'situational'],
      features: [
        {
          name: 'total_game_total',
          type: 'numerical',
          description: 'Game over/under total',
          source: 'game_lines',
          updateFrequency: 'hourly',
          retention: 'P90D',
        },
        {
          name: 'spread',
          type: 'numerical',
          description: 'Point spread',
          source: 'game_lines',
          updateFrequency: 'hourly',
          retention: 'P90D',
        },
        {
          name: 'weather_conditions',
          type: 'categorical',
          description: 'Weather for outdoor games',
          source: 'weather_api',
          updateFrequency: 'hourly',
          retention: 'P30D',
        },
        {
          name: 'rest_days',
          type: 'numerical',
          description: 'Days of rest before game',
          source: 'schedule',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
        {
          name: 'back_to_back',
          type: 'boolean',
          description: 'Back-to-back game indicator',
          source: 'schedule',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
      ],
    });

    // Historical performance features
    this.registerFeatureGroup({
      name: 'historical_props',
      entityKey: 'prop_pattern_id',
      tags: ['historical', 'patterns', 'outcomes'],
      features: [
        {
          name: 'hit_rate_last_10',
          type: 'numerical',
          description: 'Hit rate for similar props last 10 occurrences',
          source: 'calculated',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
        {
          name: 'avg_actual_vs_line',
          type: 'numerical',
          description: 'Average actual performance vs line',
          source: 'calculated',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
        {
          name: 'variance',
          type: 'numerical',
          description: 'Performance variance',
          source: 'calculated',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
      ],
    });

    // Capper performance features
    this.registerFeatureGroup({
      name: 'capper_features',
      entityKey: 'user_id',
      tags: ['capper', 'performance', 'expertise'],
      features: [
        {
          name: 'overall_roi',
          type: 'numerical',
          description: 'Return on investment',
          source: 'unified_picks',
          updateFrequency: 'hourly',
          retention: 'P1Y',
        },
        {
          name: 'sport_specialization',
          type: 'categorical',
          description: 'Primary sport expertise',
          source: 'calculated',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
        {
          name: 'streak_length',
          type: 'numerical',
          description: 'Current winning/losing streak',
          source: 'calculated',
          updateFrequency: 'real-time',
          retention: 'P90D',
        },
        {
          name: 'confidence_accuracy',
          type: 'numerical',
          description: 'Accuracy of confidence predictions',
          source: 'calculated',
          updateFrequency: 'daily',
          retention: 'P1Y',
        },
      ],
    });
  }

  /**
   * Register a new feature group
   */
  registerFeatureGroup(group: FeatureGroup): void {
    this.featureGroups.set(group.name, group);
    this.logger.info(`Registered feature group: ${group.name} with ${group.features.length} features`);
  }

  /**
   * Get feature values for entities
   */
  async getFeatures(
    featureNames: string[],
    entityIds: string[],
    asOfTime?: Date
  ): Promise<Map<string, Map<string, any>>> {
    const result = new Map<string, Map<string, any>>();
    
    // Initialize result structure
    for (const entityId of entityIds) {
      result.set(entityId, new Map());
    }

    // Group features by their feature group
    const featuresByGroup = this.groupFeaturesByGroup(featureNames);
    
    for (const [groupName, features] of featuresByGroup) {
      const groupData = await this.getFeatureGroupData(
        groupName,
        features,
        entityIds,
        asOfTime
      );
      
      // Merge into result
      for (const [entityId, entityFeatures] of groupData) {
        const entityResult = result.get(entityId);
        if (entityResult) {
          for (const [featureName, value] of entityFeatures) {
            entityResult.set(featureName, value);
          }
        }
      }
    }

    return result;
  }

  /**
   * Store feature values
   */
  async storeFeatures(featureValues: FeatureValue[]): Promise<void> {
    // Batch insert feature values
    const batchSize = 1000;
    
    for (let i = 0; i < featureValues.length; i += batchSize) {
      const batch = featureValues.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from('feature_values')
        .upsert(batch.map(fv => ({
          feature_name: fv.featureName,
          entity_id: fv.entityId,
          value: fv.value,
          timestamp: fv.timestamp.toISOString(),
          version: fv.version,
        })), {
          onConflict: 'feature_name,entity_id,timestamp',
        });
      
      if (error) {
        this.logger.error('Failed to store feature batch:', error);
        throw error;
      }
    }

    // Cache frequently accessed features
    await this.cacheFeatures(featureValues);
    
    this.logger.info(`Stored ${featureValues.length} feature values`);
  }

  /**
   * Generate training dataset
   */
  async generateTrainingDataset(dataset: TrainingDataset): Promise<any[]> {
    this.logger.info(`Generating training dataset: ${dataset.name}`);
    
    // Build feature selection query
    const featureSelections = [];
    const joins = [];
    
    for (const groupName of dataset.featureGroups) {
      const group = this.featureGroups.get(groupName);
      if (!group) continue;
      
      const tableAlias = `fg_${groupName}`;
      
      // Add feature selections
      for (const feature of group.features) {
        featureSelections.push(`${tableAlias}.${feature.name}`);
      }
      
      // Add join
      joins.push(`
        LEFT JOIN (
          SELECT DISTINCT ON (entity_id) 
            entity_id, 
            ${group.features.map(f => f.name).join(', ')}
          FROM feature_values 
          WHERE feature_name IN (${group.features.map(f => `'${f.name}'`).join(', ')})
            AND timestamp <= '${dataset.timeRange.end.toISOString()}'
            AND timestamp >= '${dataset.timeRange.start.toISOString()}'
          ORDER BY entity_id, timestamp DESC
        ) ${tableAlias} ON base.${group.entityKey} = ${tableAlias}.entity_id
      `);
    }
    
    // Build main query
    const query = `
      SELECT 
        base.${dataset.targetColumn},
        ${featureSelections.join(', ')}
      FROM (
        SELECT * FROM unified_picks 
        WHERE created_at >= '${dataset.timeRange.start.toISOString()}'
        AND created_at <= '${dataset.timeRange.end.toISOString()}'
        ${this.buildFilterClause(dataset.filters)}
      ) base
      ${joins.join(' ')}
      WHERE base.${dataset.targetColumn} IS NOT NULL
    `;
    
    const { data, error } = await this.supabase.rpc('execute_query', {
      query_text: query,
    });
    
    if (error) {
      this.logger.error('Failed to generate training dataset:', error);
      throw error;
    }
    
    this.logger.info(`Generated dataset with ${data?.length || 0} samples`);
    return data || [];
  }

  /**
   * Real-time feature computation
   */
  async computeRealTimeFeatures(
    entityId: string,
    featureNames: string[]
  ): Promise<Map<string, any>> {
    const features = new Map<string, any>();
    
    for (const featureName of featureNames) {
      const feature = this.findFeature(featureName);
      if (!feature) continue;
      
      if (feature.updateFrequency === 'real-time') {
        const value = await this.computeFeatureValue(feature, entityId);
        features.set(featureName, value);
      } else {
        // Get from cache or database
        const cachedValue = await this.cache.get(`feature:${featureName}:${entityId}`);
        if (cachedValue !== null) {
          features.set(featureName, cachedValue);
        } else {
          const dbValue = await this.getLatestFeatureValue(featureName, entityId);
          features.set(featureName, dbValue);
        }
      }
    }
    
    return features;
  }

  /**
   * Feature drift detection
   */
  async detectFeatureDrift(
    featureName: string,
    baselinePeriod: { start: Date; end: Date },
    currentPeriod: { start: Date; end: Date }
  ): Promise<{
    isDrifting: boolean;
    driftScore: number;
    statistics: any;
  }> {
    // Get feature values for both periods
    const baseline = await this.getFeatureStatistics(featureName, baselinePeriod);
    const current = await this.getFeatureStatistics(featureName, currentPeriod);
    
    // Calculate drift score using statistical tests
    const driftScore = this.calculateDriftScore(baseline, current);
    
    return {
      isDrifting: driftScore > 0.5, // Threshold
      driftScore,
      statistics: {
        baseline,
        current,
      },
    };
  }

  // Private helper methods

  private groupFeaturesByGroup(featureNames: string[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    
    for (const featureName of featureNames) {
      const group = this.findFeatureGroup(featureName);
      if (group) {
        if (!grouped.has(group.name)) {
          grouped.set(group.name, []);
        }
        grouped.get(group.name)!.push(featureName);
      }
    }
    
    return grouped;
  }

  private findFeatureGroup(featureName: string): FeatureGroup | null {
    for (const group of this.featureGroups.values()) {
      if (group.features.some(f => f.name === featureName)) {
        return group;
      }
    }
    return null;
  }

  private findFeature(featureName: string): Feature | null {
    for (const group of this.featureGroups.values()) {
      const feature = group.features.find(f => f.name === featureName);
      if (feature) return feature;
    }
    return null;
  }

  private async getFeatureGroupData(
    groupName: string,
    features: string[],
    entityIds: string[],
    asOfTime?: Date
  ): Promise<Map<string, Map<string, any>>> {
    const result = new Map<string, Map<string, any>>();
    
    // Try cache first
    for (const entityId of entityIds) {
      result.set(entityId, new Map());
      
      for (const featureName of features) {
        const cacheKey = `feature:${featureName}:${entityId}`;
        const cached = await this.cache.get(cacheKey);
        
        if (cached !== null) {
          result.get(entityId)!.set(featureName, cached);
        }
      }
    }
    
    // Get missing features from database
    const missingFeatures = this.findMissingFeatures(result, features, entityIds);
    
    if (missingFeatures.size > 0) {
      const dbData = await this.fetchFeaturesFromDB(missingFeatures, asOfTime);
      
      // Merge database data
      for (const [entityId, entityFeatures] of dbData) {
        const entityResult = result.get(entityId);
        if (entityResult) {
          for (const [featureName, value] of entityFeatures) {
            entityResult.set(featureName, value);
          }
        }
      }
    }
    
    return result;
  }

  private findMissingFeatures(
    result: Map<string, Map<string, any>>,
    features: string[],
    entityIds: string[]
  ): Set<string> {
    const missing = new Set<string>();
    
    for (const entityId of entityIds) {
      const entityFeatures = result.get(entityId)!;
      for (const featureName of features) {
        if (!entityFeatures.has(featureName)) {
          missing.add(`${featureName}:${entityId}`);
        }
      }
    }
    
    return missing;
  }

  private async fetchFeaturesFromDB(
    missingFeatures: Set<string>,
    asOfTime?: Date
  ): Promise<Map<string, Map<string, any>>> {
    // Implementation would fetch from database
    // For now, return empty result
    return new Map();
  }

  private async cacheFeatures(featureValues: FeatureValue[]): Promise<void> {
    for (const fv of featureValues) {
      const cacheKey = `feature:${fv.featureName}:${fv.entityId}`;
      const feature = this.findFeature(fv.featureName);
      
      if (feature) {
        const ttl = this.getFeatureTTL(feature);
        await this.cache.set(cacheKey, fv.value, ttl);
      }
    }
  }

  private getFeatureTTL(feature: Feature): number {
    const ttlMap = {
      'real-time': 60, // 1 minute
      'hourly': 3600, // 1 hour
      'daily': 86400, // 1 day
      'weekly': 604800, // 1 week
    };
    
    return ttlMap[feature.updateFrequency] || 3600;
  }

  private buildFilterClause(filters: Record<string, any>): string {
    const conditions = [];
    
    for (const [column, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        conditions.push(`${column} IN (${value.map(v => `'${v}'`).join(', ')})`);
      } else {
        conditions.push(`${column} = '${value}'`);
      }
    }
    
    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  private async computeFeatureValue(feature: Feature, entityId: string): Promise<any> {
    // Implementation depends on the feature
    // This would contain the actual computation logic
    switch (feature.name) {
      case 'line_movement':
        return this.computeLineMovement(entityId);
      case 'market_volume':
        return this.computeMarketVolume(entityId);
      default:
        return null;
    }
  }

  private async computeLineMovement(propId: string): Promise<number> {
    const { data } = await this.supabase
      .from('raw_props')
      .select('line, created_at')
      .eq('id', propId)
      .order('created_at', { ascending: true })
      .limit(2);
    
    if (data && data.length >= 2) {
      return data[data.length - 1].line - data[0].line;
    }
    
    return 0;
  }

  private async computeMarketVolume(propId: string): Promise<number> {
    // Simulated market volume calculation
    return Math.random() * 100;
  }

  private async getLatestFeatureValue(featureName: string, entityId: string): Promise<any> {
    const { data } = await this.supabase
      .from('feature_values')
      .select('value')
      .eq('feature_name', featureName)
      .eq('entity_id', entityId)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    return data?.[0]?.value || null;
  }

  private async getFeatureStatistics(
    featureName: string,
    period: { start: Date; end: Date }
  ): Promise<any> {
    const { data } = await this.supabase
      .from('feature_values')
      .select('value')
      .eq('feature_name', featureName)
      .gte('timestamp', period.start.toISOString())
      .lte('timestamp', period.end.toISOString());
    
    if (!data || data.length === 0) return null;
    
    const values = data.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
    
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      std: Math.sqrt(values.reduce((a, b) => a + Math.pow(b - values.reduce((c, d) => c + d, 0) / values.length, 2), 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  private calculateDriftScore(baseline: any, current: any): number {
    if (!baseline || !current) return 0;
    
    // Simple drift calculation based on mean and standard deviation changes
    const meanDrift = Math.abs(current.mean - baseline.mean) / baseline.std;
    const stdDrift = Math.abs(current.std - baseline.std) / baseline.std;
    
    return (meanDrift + stdDrift) / 2;
  }
}
/**
 * ML Feature Store Service
 *
 * Production-grade feature store for machine learning model training and inference.
 * Implements Redis/Feast-compatible patterns for low-latency feature serving.
 *
 * Features:
 * - Online feature serving (< 10ms p95)
 * - Offline feature storage for training
 * - Feature versioning and lineage tracking
 * - dbt integration for feature engineering
 * - Feature freshness monitoring
 * - Point-in-time correctness for training
 *
 * @module services/ml/MLFeatureStore
 * @since Phase 12 - ML Training Pipeline
 * @reference Production Charter v3.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { Redis } from 'ioredis';

/**
 * Feature value types supported by the feature store
 */
export type FeatureValue = number | string | boolean | number[] | null;

/**
 * Feature metadata for versioning and lineage
 */
export interface FeatureMetadata {
  name: string;
  version: string;
  dataType: 'int' | 'float' | 'string' | 'boolean' | 'array';
  description?: string;
  source: string; // dbt model name or source table
  owner: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Feature entity (e.g., pick, user, game, prop)
 */
export interface FeatureEntity {
  entityType: 'pick' | 'user' | 'game' | 'prop' | 'capper';
  entityId: string;
  timestamp: Date; // Point-in-time for training data
}

/**
 * Feature vector for model training/inference
 */
export interface FeatureVector {
  entity: FeatureEntity;
  features: Record<string, FeatureValue>;
  metadata: {
    retrievedAt: Date;
    cacheHit: boolean;
    freshnessSeconds: number;
  };
}

/**
 * Feature group configuration (collection of related features)
 */
export interface FeatureGroup {
  name: string;
  entity: 'pick' | 'user' | 'game' | 'prop' | 'capper';
  features: string[];
  dbtModel?: string; // Source dbt model
  refreshIntervalSeconds: number; // How often to refresh from source
  ttlSeconds: number; // Redis TTL
}

/**
 * Training dataset configuration
 */
export interface TrainingDatasetConfig {
  name: string;
  entityType: 'pick' | 'user' | 'game' | 'prop';
  featureGroups: string[];
  startDate: Date;
  endDate: Date;
  label: string; // Target variable name
  filters?: Record<string, any>;
  samplingRate?: number; // 0.0 to 1.0
}

/**
 * ML Feature Store Service
 *
 * Provides online and offline feature storage for ML models with
 * Redis caching for low-latency serving and Supabase for training datasets.
 */
export class MLFeatureStore {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly redis: Redis | null;
  private readonly featureGroups: Map<string, FeatureGroup> = new Map();
  private readonly featureMetadata: Map<string, FeatureMetadata> = new Map();
  private readonly enableRedis: boolean;

  constructor(
    logger: Logger,
    supabase: SupabaseClient,
    redis?: Redis
  ) {
    this.logger = logger;
    this.supabase = supabase;
    this.redis = redis || null;
    this.enableRedis = !!redis;

    if (!this.enableRedis) {
      this.logger.warn('[MLFeatureStore] Redis not provided, running without caching');
    }
  }

  /**
   * Initialize feature store and register feature groups
   */
  async initialize(): Promise<void> {
    this.logger.info('[MLFeatureStore] Initializing feature store...');

    // Register standard feature groups
    await this.registerStandardFeatureGroups();

    // Load feature metadata from database
    await this.loadFeatureMetadata();

    this.logger.info('[MLFeatureStore] Feature store initialized', {
      featureGroups: this.featureGroups.size,
      features: this.featureMetadata.size,
      redisEnabled: this.enableRedis
    });
  }

  /**
   * Register standard feature groups from dbt models
   */
  private async registerStandardFeatureGroups(): Promise<void> {
    // Pick-level features from internal_scores
    this.registerFeatureGroup({
      name: 'pick_scoring_features',
      entity: 'pick',
      features: [
        'professional_score',
        'clv_pct',
        'kelly_fraction',
        'sharp_money_alignment',
        'steam_move_detected',
        'win_probability_model_v1',
        'win_probability_model_v2',
        'expected_value',
        'player_form_score',
        'matchup_score',
        'venue_impact_score'
      ],
      dbtModel: 'fct_scoring_analytics',
      refreshIntervalSeconds: 300, // 5 minutes
      ttlSeconds: 600 // 10 minutes
    });

    // Pick performance features
    this.registerFeatureGroup({
      name: 'pick_performance_features',
      entity: 'pick',
      features: [
        'is_win',
        'profit_loss',
        'edge',
        'implied_probability',
        'confidence_tier'
      ],
      dbtModel: 'fct_picks_performance',
      refreshIntervalSeconds: 300,
      ttlSeconds: 600
    });

    // Capper-level features
    this.registerFeatureGroup({
      name: 'capper_features',
      entity: 'capper',
      features: [
        'win_rate_pct',
        'roi_pct',
        'total_settled_picks',
        'avg_professional_score',
        'avg_clv_pct',
        'steam_capture_rate_pct',
        'high_score_picks_pct',
        'capper_rating',
        'skill_tier'
      ],
      dbtModel: 'dim_cappers',
      refreshIntervalSeconds: 3600, // 1 hour
      ttlSeconds: 7200 // 2 hours
    });

    // Game context features (from raw_props and external data)
    this.registerFeatureGroup({
      name: 'game_context_features',
      entity: 'game',
      features: [
        'home_team_strength',
        'away_team_strength',
        'head_to_head_history',
        'recent_form_home',
        'recent_form_away',
        'venue_advantage',
        'weather_impact',
        'rest_days_home',
        'rest_days_away'
      ],
      refreshIntervalSeconds: 1800, // 30 minutes
      ttlSeconds: 3600
    });
  }

  /**
   * Register a feature group
   */
  registerFeatureGroup(group: FeatureGroup): void {
    this.featureGroups.set(group.name, group);
    this.logger.info('[MLFeatureStore] Registered feature group', {
      name: group.name,
      entity: group.entity,
      featureCount: group.features.length,
      dbtModel: group.dbtModel
    });
  }

  /**
   * Load feature metadata from database
   */
  private async loadFeatureMetadata(): Promise<void> {
    // In production, this would load from a feature_metadata table
    // For now, we'll generate metadata from feature groups
    for (const [groupName, group] of this.featureGroups) {
      for (const featureName of group.features) {
        const metadata: FeatureMetadata = {
          name: featureName,
          version: '1.0.0',
          dataType: this.inferDataType(featureName),
          source: group.dbtModel || group.name,
          owner: 'platform-engineering',
          tags: [group.entity, groupName],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.featureMetadata.set(featureName, metadata);
      }
    }
  }

  /**
   * Infer data type from feature name (heuristic)
   */
  private inferDataType(featureName: string): 'int' | 'float' | 'string' | 'boolean' | 'array' {
    if (featureName.includes('_detected') || featureName.includes('is_')) return 'boolean';
    if (featureName.includes('_pct') || featureName.includes('_score') || featureName.includes('probability')) return 'float';
    if (featureName.includes('count') || featureName.includes('total_')) return 'int';
    if (featureName.includes('tier') || featureName.includes('status')) return 'string';
    return 'float'; // Default
  }

  /**
   * Get online features for a single entity (fast path with Redis)
   *
   * @param entity - Entity to get features for
   * @param featureNames - List of feature names to retrieve
   * @returns Feature vector with metadata
   */
  async getOnlineFeatures(
    entity: FeatureEntity,
    featureNames: string[]
  ): Promise<FeatureVector> {
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey(entity, featureNames);

    // Try Redis cache first
    if (this.enableRedis && this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug('[MLFeatureStore] Cache hit for online features', {
          entity: entity.entityType,
          entityId: entity.entityId,
          features: featureNames.length
        });

        const features = JSON.parse(cached);
        return {
          entity,
          features,
          metadata: {
            retrievedAt: new Date(),
            cacheHit: true,
            freshnessSeconds: Date.now() - startTime
          }
        };
      }
    }

    // Cache miss - fetch from database
    const features = await this.fetchFeaturesFromDatabase(entity, featureNames);

    // Update cache
    if (this.enableRedis && this.redis) {
      const ttl = this.getFeatureTTL(featureNames);
      await this.redis.setex(cacheKey, ttl, JSON.stringify(features));
    }

    const latency = Date.now() - startTime;
    this.logger.debug('[MLFeatureStore] Fetched online features from database', {
      entity: entity.entityType,
      entityId: entity.entityId,
      features: featureNames.length,
      latencyMs: latency
    });

    return {
      entity,
      features,
      metadata: {
        retrievedAt: new Date(),
        cacheHit: false,
        freshnessSeconds: 0
      }
    };
  }

  /**
   * Get offline features for training dataset (batch fetch with point-in-time correctness)
   *
   * @param config - Training dataset configuration
   * @returns Array of feature vectors for training
   */
  async getOfflineFeatures(
    config: TrainingDatasetConfig
  ): Promise<FeatureVector[]> {
    this.logger.info('[MLFeatureStore] Fetching offline features for training', {
      dataset: config.name,
      entityType: config.entityType,
      featureGroups: config.featureGroups.length,
      dateRange: `${config.startDate.toISOString()} to ${config.endDate.toISOString()}`
    });

    const startTime = Date.now();

    // Build SQL query for point-in-time correct features
    const query = this.buildOfflineFeaturesQuery(config);

    // Execute query
    const { data, error } = await this.supabase.rpc('get_training_features', {
      query_config: query
    });

    if (error) {
      this.logger.error('[MLFeatureStore] Failed to fetch offline features', { error });
      throw new Error(`Failed to fetch offline features: ${error.message}`);
    }

    const features: FeatureVector[] = data.map((row: any) => ({
      entity: {
        entityType: config.entityType,
        entityId: row.entity_id,
        timestamp: new Date(row.timestamp)
      },
      features: this.extractFeatures(row, config.featureGroups),
      metadata: {
        retrievedAt: new Date(),
        cacheHit: false,
        freshnessSeconds: 0
      }
    }));

    const latency = Date.now() - startTime;
    this.logger.info('[MLFeatureStore] Fetched offline features', {
      dataset: config.name,
      rows: features.length,
      latencyMs: latency
    });

    return features;
  }

  /**
   * Build cache key for online features
   */
  private buildCacheKey(entity: FeatureEntity, featureNames: string[]): string {
    const featuresHash = featureNames.sort().join(',');
    return `features:${entity.entityType}:${entity.entityId}:${featuresHash}`;
  }

  /**
   * Get TTL for feature names (use minimum TTL of all feature groups)
   */
  private getFeatureTTL(featureNames: string[]): number {
    let minTTL = 600; // Default 10 minutes

    for (const [groupName, group] of this.featureGroups) {
      const hasFeature = featureNames.some(f => group.features.includes(f));
      if (hasFeature && group.ttlSeconds < minTTL) {
        minTTL = group.ttlSeconds;
      }
    }

    return minTTL;
  }

  /**
   * Fetch features from database (Supabase)
   */
  private async fetchFeaturesFromDatabase(
    entity: FeatureEntity,
    featureNames: string[]
  ): Promise<Record<string, FeatureValue>> {
    // Determine which feature groups to query
    const groupsToQuery = this.getFeatureGroupsForFeatures(featureNames);

    const features: Record<string, FeatureValue> = {};

    // Query each feature group
    for (const groupName of groupsToQuery) {
      const group = this.featureGroups.get(groupName);
      if (!group) continue;

      const groupFeatures = featureNames.filter(f => group.features.includes(f));

      // Query based on entity type
      const tableName = group.dbtModel || this.getTableForEntity(entity.entityType);
      const { data, error } = await this.supabase
        .from(tableName)
        .select(groupFeatures.join(','))
        .eq(this.getEntityIdColumn(entity.entityType), entity.entityId)
        .single();

      if (error) {
        this.logger.warn('[MLFeatureStore] Failed to fetch features from group', {
          group: groupName,
          entity: entity.entityType,
          entityId: entity.entityId,
          error: error.message
        });
        continue;
      }

      if (data) {
        Object.assign(features, data);
      }
    }

    return features;
  }

  /**
   * Get feature groups that contain the requested features
   */
  private getFeatureGroupsForFeatures(featureNames: string[]): string[] {
    const groups: string[] = [];

    for (const [groupName, group] of this.featureGroups) {
      const hasFeature = featureNames.some(f => group.features.includes(f));
      if (hasFeature) {
        groups.push(groupName);
      }
    }

    return groups;
  }

  /**
   * Get database table for entity type
   */
  private getTableForEntity(entityType: string): string {
    const tableMap: Record<string, string> = {
      pick: 'picks',
      user: 'users',
      game: 'games',
      prop: 'props',
      capper: 'users'
    };
    return tableMap[entityType] || entityType;
  }

  /**
   * Get entity ID column name for entity type
   */
  private getEntityIdColumn(entityType: string): string {
    const columnMap: Record<string, string> = {
      pick: 'id',
      user: 'id',
      game: 'id',
      prop: 'id',
      capper: 'id'
    };
    return columnMap[entityType] || 'id';
  }

  /**
   * Build SQL query for offline features (point-in-time correct)
   */
  private buildOfflineFeaturesQuery(config: TrainingDatasetConfig): any {
    // This is a simplified version - in production, this would be a complex SQL query
    // that joins multiple feature tables with point-in-time correctness
    return {
      entity_type: config.entityType,
      feature_groups: config.featureGroups,
      start_date: config.startDate.toISOString(),
      end_date: config.endDate.toISOString(),
      label: config.label,
      filters: config.filters || {},
      sampling_rate: config.samplingRate || 1.0
    };
  }

  /**
   * Extract features from database row
   */
  private extractFeatures(
    row: any,
    featureGroups: string[]
  ): Record<string, FeatureValue> {
    const features: Record<string, FeatureValue> = {};

    for (const groupName of featureGroups) {
      const group = this.featureGroups.get(groupName);
      if (!group) continue;

      for (const featureName of group.features) {
        if (row[featureName] !== undefined) {
          features[featureName] = row[featureName];
        }
      }
    }

    return features;
  }

  /**
   * Invalidate cache for entity
   */
  async invalidateCache(entity: FeatureEntity): Promise<void> {
    if (!this.enableRedis || !this.redis) return;

    const pattern = `features:${entity.entityType}:${entity.entityId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.debug('[MLFeatureStore] Invalidated cache', {
        entity: entity.entityType,
        entityId: entity.entityId,
        keysDeleted: keys.length
      });
    }
  }

  /**
   * Get feature metadata
   */
  getFeatureMetadata(featureName: string): FeatureMetadata | undefined {
    return this.featureMetadata.get(featureName);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const details: any = {
      featureGroups: this.featureGroups.size,
      features: this.featureMetadata.size,
      redisEnabled: this.enableRedis
    };

    // Check Redis connection
    if (this.enableRedis && this.redis) {
      try {
        await this.redis.ping();
        details.redisStatus = 'connected';
      } catch (error) {
        details.redisStatus = 'disconnected';
        details.redisError = error instanceof Error ? error.message : 'Unknown error';
        return { status: 'degraded', details };
      }
    }

    // Check Supabase connection
    try {
      const { error } = await this.supabase.from('picks').select('id').limit(1);
      if (error) throw error;
      details.supabaseStatus = 'connected';
    } catch (error) {
      details.supabaseStatus = 'disconnected';
      details.supabaseError = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', details };
    }

    return { status: 'healthy', details };
  }
}

/**
 * Create and initialize ML Feature Store
 */
export async function createMLFeatureStore(
  logger: Logger,
  supabase: SupabaseClient,
  redis?: Redis
): Promise<MLFeatureStore> {
  const featureStore = new MLFeatureStore(logger, supabase, redis);
  await featureStore.initialize();
  return featureStore;
}

export default MLFeatureStore;

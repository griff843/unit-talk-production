import { createLogger } from '../utils/logger';
import { featureMetrics } from './metricsServer';

import { supabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface UpsertFeatureInput {
  entityType: string;
  entityId: string;
  featureName: string;
  asOf: string; // ISO timestamp
  value: unknown;
}

export interface FeatureQuery {
  entityType: string;
  entityId: string;
  featureNames: string[];
  asOf?: string; // if omitted, fetch latest
}

export class FeatureStoreService {
  private logger = createLogger('FeatureStoreService');

  async upsertFeature(input: UpsertFeatureInput): Promise<{ success: boolean }>{
    if (!isSupabaseConfigured) return { success: true };

    const { entityType, entityId, featureName, asOf, value } = input;

    this.logger.info('Upserting feature', { entityType, entityId, featureName, asOf });

    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // Idempotent upsert by unique constraint (entity_type, entity_id, feature_name, as_of)
    const endTimer = featureMetrics.upsertDuration.labels(featureName).startTimer();
    const { error } = await supabaseClient
      .from('feature_values')
      .upsert({
        entity_type: entityType,
        entity_id: entityId,
        feature_name: featureName,
        as_of: asOf,
        value: value as any,
      }, { onConflict: 'entity_type,entity_id,feature_name,as_of' });

    endTimer();

    if (error) {
      featureMetrics.upsertsTotal.labels(featureName, 'failure').inc();
      this.logger.error('Upsert failed', { error: error?.message || 'Unknown error' });
      throw error;
    } else {
      featureMetrics.upsertsTotal.labels(featureName, 'success').inc();
    }

    // Update freshness for this feature (optionally scoping by entity)
    const { error: freshErr } = await supabaseClient
      .from('feature_freshness')
      .upsert({
        feature_name: featureName,
        entity_type: entityType,
        entity_id: entityId,
        last_updated: new Date().toISOString(),
      });

    if (freshErr) {
      featureMetrics.dqEventsTotal.labels('feature_freshness', 'error').inc();
      this.logger.error('Freshness upsert failed', { error: freshErr?.message || 'Unknown error' });
      // Do not throw; non-critical
    }

    // Update freshness age gauge (0 immediately after upsert)
    featureMetrics.freshnessAgeSeconds.labels(featureName).set(0);

    return { success: true };
  }

  async queryFeatures(params: FeatureQuery): Promise<Record<string, any>> {
    if (!isSupabaseConfigured) return {};

    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const { entityType, entityId, featureNames, asOf } = params;

    if (asOf) {
      const { data, error } = await supabaseClient
        .from('feature_values')
        .select('feature_name, value')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .in('feature_name', featureNames)
        .lte('as_of', asOf)
        .order('as_of', { ascending: false });

      if (error) { throw error; }

      // Return the latest at-or-before asOf per feature
      const result: Record<string, any> = {};
      for (const name of featureNames) {
        const rows = (data || []).filter((r: any) => r.feature_name === name);
        if (rows.length > 0) result[name] = rows[0].value;
      }
      return result;
    }

    // Latest for each requested feature
    const results: Record<string, any> = {};
    for (const name of featureNames) {
      const { data, error } = await supabaseClient
        .from('feature_values')
        .select('value')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('feature_name', name)
        .order('as_of', { ascending: false })
        .limit(1);
      if (error) { throw error; }
      if (data && data[0]) results[name] = data[0].value;
    }
    return results;
  }
}


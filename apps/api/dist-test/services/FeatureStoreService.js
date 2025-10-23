"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureStoreService = void 0;
const logger_1 = require("../utils/logger");
const metricsServer_1 = require("./metricsServer");
const supabaseClient_1 = require("./supabaseClient");
class FeatureStoreService {
    constructor() {
        this.logger = (0, logger_1.createLogger)('FeatureStoreService');
    }
    async upsertFeature(input) {
        if (!supabaseClient_1.isSupabaseConfigured)
            return { success: true };
        const { entityType, entityId, featureName, asOf, value } = input;
        this.logger.info('Upserting feature', { entityType, entityId, featureName, asOf });
        // Idempotent upsert by unique constraint (entity_type, entity_id, feature_name, as_of)
        const endTimer = metricsServer_1.featureMetrics.upsertDuration.labels(featureName).startTimer();
        const { error } = await supabaseClient_1.supabaseClient
            .from('feature_values')
            .upsert({
            entity_type: entityType,
            entity_id: entityId,
            feature_name: featureName,
            as_of: asOf,
            value: value,
        }, { onConflict: 'entity_type,entity_id,feature_name,as_of' });
        endTimer();
        if (error) {
            metricsServer_1.featureMetrics.upsertsTotal.labels(featureName, 'failure').inc();
            this.logger.error('Upsert failed', { error: error.message });
            throw error;
        }
        else {
            metricsServer_1.featureMetrics.upsertsTotal.labels(featureName, 'success').inc();
        }
        // Update freshness for this feature (optionally scoping by entity)
        const { error: freshErr } = await supabaseClient_1.supabaseClient
            .from('feature_freshness')
            .upsert({
            feature_name: featureName,
            entity_type: entityType,
            entity_id: entityId,
            last_updated: new Date().toISOString(),
        });
        if (freshErr) {
            metricsServer_1.featureMetrics.dqEventsTotal.labels('feature_freshness', 'error').inc();
            this.logger.error('Freshness upsert failed', { error: freshErr.message });
            // Do not throw; non-critical
        }
        // Update freshness age gauge (0 immediately after upsert)
        metricsServer_1.featureMetrics.freshnessAgeSeconds.labels(featureName).set(0);
        return { success: true };
    }
    async queryFeatures(params) {
        if (!supabaseClient_1.isSupabaseConfigured)
            return {};
        const { entityType, entityId, featureNames, asOf } = params;
        if (asOf) {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('feature_values')
                .select('feature_name, value')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .in('feature_name', featureNames)
                .lte('as_of', asOf)
                .order('as_of', { ascending: false });
            if (error) {
                throw error;
            }
            // Return the latest at-or-before asOf per feature
            const result = {};
            for (const name of featureNames) {
                const rows = (data || []).filter((r) => r.feature_name === name);
                if (rows.length > 0)
                    result[name] = rows[0].value;
            }
            return result;
        }
        // Latest for each requested feature
        const results = {};
        for (const name of featureNames) {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('feature_values')
                .select('value')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .eq('feature_name', name)
                .order('as_of', { ascending: false })
                .limit(1);
            if (error) {
                throw error;
            }
            if (data && data[0])
                results[name] = data[0].value;
        }
        return results;
    }
}
exports.FeatureStoreService = FeatureStoreService;

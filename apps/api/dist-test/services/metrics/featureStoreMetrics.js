"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureStoreMetrics = void 0;
const prom_client_1 = require("prom-client");
class FeatureStoreMetrics {
    constructor(register) {
        this.upsertsTotal = new prom_client_1.Counter({
            name: 'feature_upserts_total',
            help: 'Total feature upserts',
            labelNames: ['feature_name', 'status'],
            registers: [register],
        });
        this.upsertDuration = new prom_client_1.Histogram({
            name: 'feature_upsert_duration_seconds',
            help: 'Duration of feature upserts',
            labelNames: ['feature_name'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [register],
        });
        this.dqEventsTotal = new prom_client_1.Counter({
            name: 'data_quality_events_total',
            help: 'Data quality events total',
            labelNames: ['component', 'severity'],
            registers: [register],
        });
        this.freshnessAgeSeconds = new prom_client_1.Gauge({
            name: 'feature_freshness_age_seconds',
            help: 'Age of feature freshness (seconds)',
            labelNames: ['feature_name'],
            registers: [register],
        });
    }
}
exports.FeatureStoreMetrics = FeatureStoreMetrics;

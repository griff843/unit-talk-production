import { Counter, Histogram, Gauge, Registry } from 'prom-client';
export declare class FeatureStoreMetrics {
    upsertsTotal: Counter<string>;
    upsertDuration: Histogram<string>;
    dqEventsTotal: Counter<string>;
    freshnessAgeSeconds: Gauge<string>;
    constructor(register: Registry);
}
//# sourceMappingURL=featureStoreMetrics.d.ts.map
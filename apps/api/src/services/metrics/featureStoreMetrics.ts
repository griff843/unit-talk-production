import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export class FeatureStoreMetrics {
  public upsertsTotal: Counter<string>;
  public upsertDuration: Histogram<string>;
  public dqEventsTotal: Counter<string>;
  public freshnessAgeSeconds: Gauge<string>;

  constructor(register: Registry) {
    this.upsertsTotal = new Counter({
      name: 'feature_upserts_total',
      help: 'Total feature upserts',
      labelNames: ['feature_name', 'status'],
      registers: [register],
    });

    this.upsertDuration = new Histogram({
      name: 'feature_upsert_duration_seconds',
      help: 'Duration of feature upserts',
      labelNames: ['feature_name'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register],
    });

    this.dqEventsTotal = new Counter({
      name: 'data_quality_events_total',
      help: 'Data quality events total',
      labelNames: ['component', 'severity'],
      registers: [register],
    });

    this.freshnessAgeSeconds = new Gauge({
      name: 'feature_freshness_age_seconds',
      help: 'Age of feature freshness (seconds)',
      labelNames: ['feature_name'],
      registers: [register],
    });
  }
}


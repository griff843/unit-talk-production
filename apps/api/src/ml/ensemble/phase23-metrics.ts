/**
 * Phase 23: Prometheus Metrics & OpenTelemetry Configuration
 * Date: 2025-11-14
 * Charter: v3.0
 * 
 * Implements all required metrics for Phase 23 ensemble analytics
 */

import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();

// ============================================================================
// CORRELATION ANALYSIS METRICS
// ============================================================================

export const correlationAnalysisDuration = new Histogram({
  name: 'ensemble_correlation_analysis_duration_seconds',
  help: 'Time to analyze model correlations',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry]
});

export const correlationTrendsDetected = new Counter({
  name: 'ensemble_correlation_trends_detected_total',
  help: 'Total correlation trends detected',
  labelNames: ['trend_type'],
  registers: [registry]
});

export const redundantModelsIdentified = new Gauge({
  name: 'ensemble_redundant_models_identified',
  help: 'Number of redundant models identified',
  registers: [registry]
});

// ============================================================================
// WEIGHT CONVERGENCE METRICS
// ============================================================================

export const weightConvergenceScore = new Gauge({
  name: 'ensemble_weight_convergence_score',
  help: 'Current weight convergence score (0-1)',
  labelNames: ['model_id'],
  registers: [registry]
});

export const weightOscillationScore = new Gauge({
  name: 'ensemble_weight_oscillation_score',
  help: 'Weight oscillation score (0-1)',
  labelNames: ['model_id'],
  registers: [registry]
});

export const convergenceSnapshotsCaptured = new Counter({
  name: 'ensemble_convergence_snapshots_total',
  help: 'Total convergence snapshots captured',
  registers: [registry]
});

// ============================================================================
// ROUTING METRICS
// ============================================================================

export const routingDecisionLatency = new Histogram({
  name: 'ensemble_routing_decision_latency_ms',
  help: 'Latency of routing decisions in milliseconds',
  buckets: [1, 5, 10, 20, 50, 100, 200],
  registers: [registry]
});

export const routingCacheHits = new Counter({
  name: 'ensemble_routing_cache_hits_total',
  help: 'Total routing cache hits',
  registers: [registry]
});

export const routingCacheMisses = new Counter({
  name: 'ensemble_routing_cache_misses_total',
  help: 'Total routing cache misses',
  registers: [registry]
});

export const loadDistributionAllocations = new Gauge({
  name: 'ensemble_load_distribution_allocations',
  help: 'Load allocated to each model',
  labelNames: ['model_id'],
  registers: [registry]
});

// ============================================================================
// DRIFT DETECTION METRICS
// ============================================================================

export const driftDetectionScore = new Gauge({
  name: 'ensemble_drift_detection_score',
  help: 'Current drift detection score (0-1)',
  labelNames: ['severity'],
  registers: [registry]
});

export const driftAlertsTotal = new Counter({
  name: 'ensemble_drift_alerts_total',
  help: 'Total drift alerts generated',
  labelNames: ['severity'],
  registers: [registry]
});

export const clvPredictionAccuracy = new Histogram({
  name: 'ensemble_clv_prediction_accuracy',
  help: 'CLV prediction accuracy metrics',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [registry]
});

// ============================================================================
// ERROR METRICS
// ============================================================================

export const ensembleErrors = new Counter({
  name: 'ensemble_errors_total',
  help: 'Total ensemble operation errors',
  labelNames: ['component', 'operation'],
  registers: [registry]
});

export const databaseQueryErrors = new Counter({
  name: 'ensemble_database_query_errors_total',
  help: 'Database query errors in ensemble operations',
  labelNames: ['table'],
  registers: [registry]
});

// ============================================================================
// CIRCUIT BREAKER METRICS
// ============================================================================

export const circuitBreakerTrips = new Counter({
  name: 'ensemble_circuit_breaker_trips_total',
  help: 'Total circuit breaker trips',
  labelNames: ['service'],
  registers: [registry]
});

export const circuitBreakerState = new Gauge({
  name: 'ensemble_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service'],
  registers: [registry]
});


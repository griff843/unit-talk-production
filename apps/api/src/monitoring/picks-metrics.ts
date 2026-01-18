/**
 * Phase 11B: Picks Domain Metrics
 * Date: 2025-11-01
 * 
 * Prometheus metrics for picks domain SLO tracking
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// Create dedicated registry for picks domain
export const picksRegistry = new Registry();

// ===============================================================================
// COUNTERS
// ===============================================================================

/**
 * Total picks submitted
 */
export const picksSubmitted = new Counter({
  name: 'picks_submitted_total',
  help: 'Total number of picks submitted',
  labelNames: ['tenant_id', 'workflow_stage'],
  registers: [picksRegistry]
});

/**
 * Total picks scored
 */
export const picksScored = new Counter({
  name: 'picks_scored_total',
  help: 'Total number of picks scored',
  labelNames: ['tenant_id', 'grading_engine_version'],
  registers: [picksRegistry]
});

/**
 * Total picks published
 */
export const picksPublished = new Counter({
  name: 'picks_published_total',
  help: 'Total number of picks published',
  labelNames: ['tenant_id', 'channels'],
  registers: [picksRegistry]
});

/**
 * Total pick operation failures
 */
export const picksFailed = new Counter({
  name: 'picks_failed_total',
  help: 'Total number of failed pick operations',
  labelNames: ['tenant_id', 'operation', 'error_type'],
  registers: [picksRegistry]
});

/**
 * Total pick events published
 */
export const pickEventsPublished = new Counter({
  name: 'pick_events_published_total',
  help: 'Total number of pick events published',
  labelNames: ['tenant_id', 'event_type'],
  registers: [picksRegistry]
});

// ===============================================================================
// HISTOGRAMS (SLO Tracking)
// ===============================================================================

/**
 * Pick operation latency (SLO: p95 < 2s)
 */
export const picksLatency = new Histogram({
  name: 'picks_latency_seconds',
  help: 'Latency of pick operations in seconds (SLO: p95 < 2s)',
  labelNames: ['operation'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [picksRegistry]
});

/**
 * Submit to score latency (SLO: p95 < 2s)
 */
export const submitToScoreLatency = new Histogram({
  name: 'picks_submit_to_score_latency_seconds',
  help: 'Time from pick submission to scoring completion (SLO: p95 < 2s)',
  labelNames: ['tenant_id'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [picksRegistry]
});

/**
 * Score to publish latency
 */
export const scoreToPublishLatency = new Histogram({
  name: 'picks_score_to_publish_latency_seconds',
  help: 'Time from scoring to publishing',
  labelNames: ['tenant_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [picksRegistry]
});

/**
 * End-to-end pick processing latency
 */
export const e2ePickLatency = new Histogram({
  name: 'picks_e2e_latency_seconds',
  help: 'End-to-end pick processing time (submit → publish)',
  labelNames: ['tenant_id'],
  buckets: [1, 2, 5, 10, 30, 60, 120],
  registers: [picksRegistry]
});

// ===============================================================================
// GAUGES
// ===============================================================================

/**
 * Active picks by workflow stage
 */
export const activePicksByStage = new Gauge({
  name: 'picks_active_by_stage',
  help: 'Number of active picks by workflow stage',
  labelNames: ['tenant_id', 'workflow_stage'],
  registers: [picksRegistry]
});

/**
 * Pending scoring queue size
 */
export const pendingScoringQueue = new Gauge({
  name: 'picks_pending_scoring_queue',
  help: 'Number of picks waiting for scoring',
  labelNames: ['tenant_id'],
  registers: [picksRegistry]
});

/**
 * Error rate (SLO: < 1%)
 */
export const picksErrorRate = new Gauge({
  name: 'picks_error_rate',
  help: 'Pick operation error rate (SLO: < 1%)',
  labelNames: ['tenant_id', 'operation'],
  registers: [picksRegistry]
});

// ===============================================================================
// HELPER FUNCTIONS
// ===============================================================================

/**
 * Track pick submission with automatic latency measurement
 */
export function trackPickSubmission(tenantId: string, workflowStage: string) {
  picksSubmitted.inc({ tenant_id: tenantId, workflow_stage: workflowStage });
}

/**
 * Track pick scoring completion
 */
export function trackPickScored(tenantId: string, engineVersion: string, latencyMs: number) {
  picksScored.inc({ tenant_id: tenantId, grading_engine_version: engineVersion });
  submitToScoreLatency.observe({ tenant_id: tenantId }, latencyMs / 1000);
}

/**
 * Track pick publishing
 */
export function trackPickPublished(tenantId: string, channels: string[], latencyMs: number) {
  picksPublished.inc({ tenant_id: tenantId, channels: channels.join(',') });
  scoreToPublishLatency.observe({ tenant_id: tenantId }, latencyMs / 1000);
}

/**
 * Track end-to-end pick processing
 */
export function trackE2EPickProcessing(tenantId: string, totalLatencyMs: number) {
  e2ePickLatency.observe({ tenant_id: tenantId }, totalLatencyMs / 1000);
}

/**
 * Track pick operation failure
 */
export function trackPickFailure(tenantId: string, operation: string, errorType: string) {
  picksFailed.inc({ tenant_id: tenantId, operation, error_type: errorType });
}

/**
 * Update active picks gauge
 */
export async function updateActivePicksGauge(
  tenantId: string,
  picksByStage: Record<string, number>
) {
  Object.entries(picksByStage).forEach(([stage, count]) => {
    activePicksByStage.set({ tenant_id: tenantId, workflow_stage: stage }, count);
  });
}

/**
 * Calculate and update error rate
 */
export function updateErrorRate(
  tenantId: string,
  operation: string,
  totalOps: number,
  failedOps: number
) {
  const errorRate = totalOps > 0 ? (failedOps / totalOps) * 100 : 0;
  picksErrorRate.set({ tenant_id: tenantId, operation }, errorRate);
}

// ===============================================================================
// METRICS ENDPOINT HANDLER
// ===============================================================================

/**
 * Get all picks metrics in Prometheus format
 */
export async function getPicksMetrics(): Promise<string> {
  return picksRegistry.metrics();
}

/**
 * Reset all metrics (for testing)
 */
export function resetPicksMetrics(): void {
  picksRegistry.resetMetrics();
}

// ===============================================================================
// SLO VALIDATION
// ===============================================================================

export interface SLOStatus {
  name: string;
  target: number;
  current: number;
  passing: boolean;
  unit: string;
}

/**
 * Check if picks SLOs are being met
 */
export async function validatePicksSLOs(): Promise<SLOStatus[]> {
  const metrics = await picksRegistry.getMetricsAsJSON();
  
  const slos: SLOStatus[] = [];
  
  // SLO 1: Submit to score latency p95 < 2s
  const submitToScoreMetric = metrics.find(m => m.name === 'picks_submit_to_score_latency_seconds');
  if (submitToScoreMetric && String(submitToScoreMetric.type) === 'histogram') {
    const p95 = calculateP95(submitToScoreMetric.values as any[]);
    slos.push({
      name: 'Submit to Score Latency (p95)',
      target: 2.0,
      current: p95,
      passing: p95 < 2.0,
      unit: 'seconds'
    });
  }
  
  // SLO 2: Error rate < 1%
  const errorRateMetric = metrics.find(m => m.name === 'picks_error_rate');
  if (errorRateMetric && String(errorRateMetric.type) === 'gauge') {
    const avgErrorRate = calculateAverage(errorRateMetric.values as any[]);
    slos.push({
      name: 'Error Rate',
      target: 1.0,
      current: avgErrorRate,
      passing: avgErrorRate < 1.0,
      unit: 'percent'
    });
  }
  
  return slos;
}

/**
 * Calculate p95 from histogram values
 */
function calculateP95(values: any[]): number {
  if (!values || values.length === 0) return 0;
  
  // Simplified p95 calculation
  const sorted = values
    .filter(v => v.metricName?.includes('bucket'))
    .map(v => parseFloat(v.value))
    .sort((a, b) => a - b);
  
  if (sorted.length === 0) return 0;
  
  const p95Index = Math.floor(sorted.length * 0.95);
  return sorted[p95Index] || 0;
}

/**
 * Calculate average from gauge values
 */
function calculateAverage(values: any[]): number {
  if (!values || values.length === 0) return 0;
  
  const sum = values.reduce((acc, v) => acc + parseFloat(v.value), 0);
  return sum / values.length;
}

// ===============================================================================
// EXPORTS
// ===============================================================================

export default {
  // Counters
  picksSubmitted,
  picksScored,
  picksPublished,
  picksFailed,
  pickEventsPublished,
  
  // Histograms
  picksLatency,
  submitToScoreLatency,
  scoreToPublishLatency,
  e2ePickLatency,
  
  // Gauges
  activePicksByStage,
  pendingScoringQueue,
  picksErrorRate,
  
  // Helpers
  trackPickSubmission,
  trackPickScored,
  trackPickPublished,
  trackE2EPickProcessing,
  trackPickFailure,
  updateActivePicksGauge,
  updateErrorRate,
  
  // Metrics
  getPicksMetrics,
  resetPicksMetrics,
  validatePicksSLOs
};


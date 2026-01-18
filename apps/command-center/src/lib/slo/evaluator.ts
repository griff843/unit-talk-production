/**
 * SLO Evaluator - Phase 3
 *
 * Evaluates all SLOs against configurable thresholds.
 * Returns SLO status and generates alerts for violations.
 *
 * NO MOCK DATA - fails closed with UNKNOWN status if datasource unavailable.
 */

import type {
  SLOEvaluation,
  SLOStatus,
  SLOThresholds,
  SLOStatusResponse,
  Alert,
  AlertSeverity,
} from './types';
import { getIngestionMetrics, getPublishingMetrics, getGradingMetrics } from './datasources';

// =============================================================================
// Default Thresholds (overrideable via env vars)
// =============================================================================

export function getThresholds(): SLOThresholds {
  return {
    // Ingestion freshness SLO
    ingestionStaleMinutes: parseInt(
      process.env.SLO_INGESTION_STALE_MINUTES || '30',
      10
    ),
    ingestionRateDropPercentage: parseInt(
      process.env.SLO_INGESTION_RATE_DROP_PERCENTAGE || '50',
      10
    ),

    // Publishing latency SLO (in seconds)
    publishingP50Seconds: parseInt(
      process.env.SLO_PUBLISH_P50_SECONDS || '10',
      10
    ),
    publishingP95Seconds: parseInt(
      process.env.SLO_PUBLISH_P95_SECONDS || '30',
      10
    ),
    publishingP99Seconds: parseInt(
      process.env.SLO_PUBLISH_P99_SECONDS || '60',
      10
    ),

    // Publishing failures
    failedCountThreshold: parseInt(
      process.env.SLO_FAILED_COUNT_THRESHOLD || '10',
      10
    ),
    stuckPendingThreshold: parseInt(
      process.env.SLO_STUCK_PENDING_THRESHOLD || '5',
      10
    ),
    stuckPendingMinutes: parseInt(
      process.env.SLO_STUCK_PENDING_MINUTES || '10',
      10
    ),
    retryExhaustionThreshold: parseInt(
      process.env.SLO_RETRY_EXHAUSTION_THRESHOLD || '0',
      10
    ),

    // Grading backlog SLO
    gradingBacklogThreshold: parseInt(
      process.env.SLO_GRADING_BACKLOG_THRESHOLD || '50',
      10
    ),
    gradingOldestMinutes: parseInt(
      process.env.SLO_GRADING_OLDEST_MINUTES || '60',
      10
    ),
  };
}

// =============================================================================
// SLO Evaluation Logic
// =============================================================================

function determineSLOStatus(
  currentValue: number | null,
  threshold: number,
  mode: 'less_than' | 'greater_than'
): SLOStatus {
  if (currentValue === null) {
    return 'UNKNOWN';
  }

  if (mode === 'less_than') {
    if (currentValue < threshold * 0.5) return 'PASS';
    if (currentValue < threshold) return 'WARN';
    return 'FAIL';
  } else {
    // greater_than mode
    if (currentValue > threshold * 2) return 'FAIL';
    if (currentValue > threshold) return 'WARN';
    return 'PASS';
  }
}

async function evaluateIngestionFreshness(
  thresholds: SLOThresholds
): Promise<SLOEvaluation> {
  const metrics = await getIngestionMetrics();

  const status = determineSLOStatus(
    metrics.minutes_since_last,
    thresholds.ingestionStaleMinutes,
    'less_than'
  );

  let message = '';
  if (status === 'UNKNOWN') {
    message = 'No ingestion data available from local postgres';
  } else if (status === 'PASS') {
    message = `Last ingestion ${metrics.minutes_since_last} minutes ago (threshold: ${thresholds.ingestionStaleMinutes}m)`;
  } else if (status === 'WARN') {
    message = `Ingestion stale: ${metrics.minutes_since_last} minutes ago (approaching threshold: ${thresholds.ingestionStaleMinutes}m)`;
  } else {
    message = `CRITICAL: No ingestion in ${metrics.minutes_since_last} minutes (exceeds threshold: ${thresholds.ingestionStaleMinutes}m)`;
  }

  return {
    slo_name: 'ingestion_freshness',
    status,
    current_value: metrics.minutes_since_last,
    threshold: thresholds.ingestionStaleMinutes,
    message,
    data_source: 'local_postgres',
    evaluated_at: new Date().toISOString(),
    details: {
      last_ingestion_at: metrics.last_ingestion_at,
      count_last_15m: metrics.count_last_15m,
      count_last_2h: metrics.count_last_2h,
      rate_trend_percentage: metrics.rate_trend_percentage,
    },
  };
}

async function evaluatePublishingLatency(
  thresholds: SLOThresholds
): Promise<SLOEvaluation> {
  const metrics = await getPublishingMetrics();

  const status = determineSLOStatus(
    metrics.p95_seconds,
    thresholds.publishingP95Seconds,
    'less_than'
  );

  let message = '';
  if (status === 'UNKNOWN') {
    message = 'No publishing lag data available from supabase';
  } else if (status === 'PASS') {
    message = `P95 lag ${metrics.p95_seconds}s (threshold: ${thresholds.publishingP95Seconds}s)`;
  } else if (status === 'WARN') {
    message = `Publishing lag elevated: P95 ${metrics.p95_seconds}s (approaching threshold: ${thresholds.publishingP95Seconds}s)`;
  } else {
    message = `CRITICAL: Publishing lag P95 ${metrics.p95_seconds}s (exceeds threshold: ${thresholds.publishingP95Seconds}s)`;
  }

  return {
    slo_name: 'publishing_latency',
    status,
    current_value: metrics.p95_seconds,
    threshold: thresholds.publishingP95Seconds,
    message,
    data_source: 'supabase',
    evaluated_at: new Date().toISOString(),
    details: {
      p50_seconds: metrics.p50_seconds,
      p95_seconds: metrics.p95_seconds,
      p99_seconds: metrics.p99_seconds,
      sample_size: metrics.sample_size,
    },
  };
}

async function evaluatePublishingFailures(
  thresholds: SLOThresholds
): Promise<SLOEvaluation> {
  const metrics = await getPublishingMetrics();

  const failedStatus = determineSLOStatus(
    metrics.failed_count_24h,
    thresholds.failedCountThreshold,
    'less_than'
  );

  let message = '';
  if (failedStatus === 'UNKNOWN') {
    message = 'No publishing failure data available from supabase';
  } else if (failedStatus === 'PASS') {
    message = `${metrics.failed_count_24h} failed publishes in 24h (threshold: ${thresholds.failedCountThreshold})`;
  } else if (failedStatus === 'WARN') {
    message = `Publishing failures elevated: ${metrics.failed_count_24h} in 24h (approaching threshold: ${thresholds.failedCountThreshold})`;
  } else {
    message = `CRITICAL: ${metrics.failed_count_24h} failed publishes in 24h (exceeds threshold: ${thresholds.failedCountThreshold})`;
  }

  return {
    slo_name: 'publishing_failures',
    status: failedStatus,
    current_value: metrics.failed_count_24h,
    threshold: thresholds.failedCountThreshold,
    message,
    data_source: 'supabase',
    evaluated_at: new Date().toISOString(),
    details: {
      failed_count_24h: metrics.failed_count_24h,
      stuck_pending_count: metrics.stuck_pending_count,
      retry_exhaustion_count: metrics.retry_exhaustion_count,
    },
  };
}

async function evaluateStuckPending(
  thresholds: SLOThresholds
): Promise<SLOEvaluation> {
  const metrics = await getPublishingMetrics();

  const status = determineSLOStatus(
    metrics.stuck_pending_count,
    thresholds.stuckPendingThreshold,
    'less_than'
  );

  let message = '';
  if (status === 'UNKNOWN') {
    message = 'No stuck pending data available from supabase';
  } else if (status === 'PASS') {
    message = `${metrics.stuck_pending_count} picks stuck pending (threshold: ${thresholds.stuckPendingThreshold})`;
  } else if (status === 'WARN') {
    message = `Stuck pending elevated: ${metrics.stuck_pending_count} picks (approaching threshold: ${thresholds.stuckPendingThreshold})`;
  } else {
    message = `CRITICAL: ${metrics.stuck_pending_count} picks stuck pending ${thresholds.stuckPendingMinutes}+ minutes (exceeds threshold: ${thresholds.stuckPendingThreshold})`;
  }

  return {
    slo_name: 'stuck_pending',
    status,
    current_value: metrics.stuck_pending_count,
    threshold: thresholds.stuckPendingThreshold,
    message,
    data_source: 'supabase',
    evaluated_at: new Date().toISOString(),
    details: {
      stuck_pending_count: metrics.stuck_pending_count,
      stuck_pending_minutes: thresholds.stuckPendingMinutes,
    },
  };
}

async function evaluateRetryExhaustion(
  thresholds: SLOThresholds
): Promise<SLOEvaluation> {
  const metrics = await getPublishingMetrics();

  const status = determineSLOStatus(
    metrics.retry_exhaustion_count,
    thresholds.retryExhaustionThreshold,
    'less_than'
  );

  let message = '';
  if (status === 'UNKNOWN') {
    message = 'No retry exhaustion data available from supabase';
  } else if (status === 'PASS' && metrics.retry_exhaustion_count === 0) {
    message = 'No retry exhaustion detected';
  } else if (status === 'FAIL') {
    message = `CRITICAL: ${metrics.retry_exhaustion_count} picks exhausted retries (threshold: ${thresholds.retryExhaustionThreshold})`;
  } else {
    message = `${metrics.retry_exhaustion_count} picks exhausted retries`;
  }

  return {
    slo_name: 'retry_exhaustion',
    status,
    current_value: metrics.retry_exhaustion_count,
    threshold: thresholds.retryExhaustionThreshold,
    message,
    data_source: 'supabase',
    evaluated_at: new Date().toISOString(),
    details: {
      retry_exhaustion_count: metrics.retry_exhaustion_count,
    },
  };
}

async function evaluateGradingBacklog(
  thresholds: SLOThresholds
): Promise<SLOEvaluation> {
  const metrics = await getGradingMetrics();

  const status = determineSLOStatus(
    metrics.pending_review_count,
    thresholds.gradingBacklogThreshold,
    'less_than'
  );

  let message = '';
  if (status === 'UNKNOWN') {
    message = 'No grading backlog data available from supabase';
  } else if (status === 'PASS') {
    message = `${metrics.pending_review_count} picks pending review (threshold: ${thresholds.gradingBacklogThreshold})`;
  } else if (status === 'WARN') {
    message = `Grading backlog elevated: ${metrics.pending_review_count} picks (approaching threshold: ${thresholds.gradingBacklogThreshold})`;
  } else {
    message = `CRITICAL: ${metrics.pending_review_count} picks pending review (exceeds threshold: ${thresholds.gradingBacklogThreshold})`;
  }

  return {
    slo_name: 'grading_backlog',
    status,
    current_value: metrics.pending_review_count,
    threshold: thresholds.gradingBacklogThreshold,
    message,
    data_source: 'supabase',
    evaluated_at: new Date().toISOString(),
    details: {
      pending_review_count: metrics.pending_review_count,
      oldest_pending_minutes: metrics.oldest_pending_minutes,
    },
  };
}

// =============================================================================
// Main Evaluation Function
// =============================================================================

export async function evaluateAllSLOs(): Promise<SLOStatusResponse> {
  const thresholds = getThresholds();

  const [
    ingestionFreshness,
    publishingLatency,
    publishingFailures,
    stuckPending,
    retryExhaustion,
    gradingBacklog,
  ] = await Promise.all([
    evaluateIngestionFreshness(thresholds),
    evaluatePublishingLatency(thresholds),
    evaluatePublishingFailures(thresholds),
    evaluateStuckPending(thresholds),
    evaluateRetryExhaustion(thresholds),
    evaluateGradingBacklog(thresholds),
  ]);

  const slos = [
    ingestionFreshness,
    publishingLatency,
    publishingFailures,
    stuckPending,
    retryExhaustion,
    gradingBacklog,
  ];

  // Determine overall status (worst of all SLOs)
  let overallStatus: SLOStatus = 'PASS';
  for (const slo of slos) {
    if (slo.status === 'FAIL') {
      overallStatus = 'FAIL';
      break;
    }
    if (slo.status === 'WARN' && (overallStatus === 'PASS' || overallStatus === 'UNKNOWN')) {
      overallStatus = 'WARN';
    }
    if (slo.status === 'UNKNOWN' && overallStatus === 'PASS') {
      overallStatus = 'UNKNOWN';
    }
  }

  // Determine datasource connectivity
  // Local Postgres: Check ingestion_freshness SLO
  // Supabase: Check if ANY Supabase SLO returned non-UNKNOWN (connection working)
  const supabaseSLOs = [
    publishingLatency,
    publishingFailures,
    stuckPending,
    retryExhaustion,
    gradingBacklog,
  ];
  const supabaseConnected = supabaseSLOs.some(slo => slo.status !== 'UNKNOWN');

  return {
    timestamp: new Date().toISOString(),
    overall_status: overallStatus,
    slos,
    thresholds,
    data_sources: {
      local_postgres: ingestionFreshness.status !== 'UNKNOWN',
      supabase: supabaseConnected,
    },
  };
}

// =============================================================================
// Alert Generation
// =============================================================================

function sloToAlert(slo: SLOEvaluation): Alert | null {
  // Only generate alerts for WARN and FAIL status
  if (slo.status !== 'WARN' && slo.status !== 'FAIL') {
    return null;
  }

  const severity: AlertSeverity = slo.status === 'FAIL' ? 'critical' : 'warning';

  // Generate unique fingerprint for deduplication
  const fingerprint = `slo:${slo.slo_name}:${slo.status}`;

  return {
    fingerprint,
    slo_name: slo.slo_name,
    severity,
    title: `SLO ${slo.status}: ${slo.slo_name}`,
    message: slo.message,
    current_value: slo.current_value,
    threshold: slo.threshold,
    data_source: slo.data_source,
    metadata: slo.details || {},
    created_at: new Date().toISOString(),
  };
}

export async function evaluateAndGenerateAlerts(): Promise<{
  status: SLOStatusResponse;
  alerts: Alert[];
}> {
  try {
    const status = await evaluateAllSLOs();

    // Defensive: ensure slos array exists before calling .map
    const alerts: Alert[] = (status.slos || [])
      .map(slo => sloToAlert(slo))
      .filter((alert): alert is Alert => alert !== null);

    return { status, alerts };
  } catch (error) {
    console.error('[SLO Evaluator] Failed to evaluate SLOs:', error);

    // Return fail-closed response with UNKNOWN status
    const failClosedStatus: SLOStatusResponse = {
      timestamp: new Date().toISOString(),
      overall_status: 'UNKNOWN',
      slos: [],
      thresholds: getThresholds(),
      data_sources: {
        local_postgres: false,
        supabase: false,
      },
    };

    return {
      status: failClosedStatus,
      alerts: [],
    };
  }
}

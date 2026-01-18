/**
 * SLO and Alert Type Definitions - Phase 3
 *
 * Defines all types for SLO evaluation and alerting system.
 * NO MOCK DATA - all based on real backend signals.
 */

// =============================================================================
// SLO Types
// =============================================================================

export type SLOStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';

export interface SLOThresholds {
  // Ingestion freshness SLO
  ingestionStaleMinutes: number;
  ingestionRateDropPercentage: number;

  // Publishing latency SLO (in seconds)
  publishingP50Seconds: number;
  publishingP95Seconds: number;
  publishingP99Seconds: number;

  // Publishing failures
  failedCountThreshold: number;
  stuckPendingThreshold: number;
  stuckPendingMinutes: number;
  retryExhaustionThreshold: number;

  // Grading backlog SLO
  gradingBacklogThreshold: number;
  gradingOldestMinutes: number;
}

export interface SLOEvaluation {
  slo_name: string;
  status: SLOStatus;
  current_value: number | null;
  threshold: number;
  message: string;
  data_source: 'local_postgres' | 'supabase' | 'both';
  evaluated_at: string;
  details?: Record<string, any>;
}

export interface SLOStatusResponse {
  timestamp: string;
  overall_status: SLOStatus;
  slos: SLOEvaluation[];
  thresholds: SLOThresholds;
  data_sources: {
    local_postgres: boolean;
    supabase: boolean;
  };
}

// =============================================================================
// Alert Types
// =============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertChannel = 'discord' | 'db' | 'log';

export interface Alert {
  fingerprint: string; // Unique ID for deduplication
  slo_name: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  current_value: number | null;
  threshold: number;
  data_source: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AlertEvent {
  id?: string;
  fingerprint: string;
  slo_name: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  current_value: number | null;
  threshold: number;
  data_source: string;
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface AlertingConfig {
  enabled: boolean;
  channel: AlertChannel;
  discordWebhookUrl?: string;
  rateLimitMinutes: number; // Suppress same alert within N minutes
}

// =============================================================================
// Data Source Metrics Types
// =============================================================================

export interface IngestionMetrics {
  last_ingestion_at: string | null;
  minutes_since_last: number | null;
  count_last_15m: number;
  count_last_2h: number;
  rate_trend_percentage: number;
  data_source: 'local_postgres';
}

export interface PublishingMetrics {
  p50_seconds: number | null;
  p95_seconds: number | null;
  p99_seconds: number | null;
  failed_count_24h: number;
  stuck_pending_count: number;
  retry_exhaustion_count: number;
  sample_size: number;
  data_source: 'supabase';
}

export interface GradingMetrics {
  pending_review_count: number;
  oldest_pending_minutes: number | null;
  data_source: 'supabase';
}

import * as client from 'prom-client';
import { BetType, GradeTier } from '../types';

// Create registry
const register = new client.Registry();

// Grading metrics
export const picksProcessed = new client.Counter({
  name: 'grading_picks_processed_total',
  help: 'Total number of picks processed',
  labelNames: ['bet_type', 'status'] as const
});

export const pickGrades = new client.Counter({
  name: 'grading_pick_grades_total',
  help: 'Distribution of grades assigned to picks',
  labelNames: ['tier', 'bet_type'] as const
});

export const processingDuration = new client.Histogram({
  name: 'grading_processing_duration_seconds',
  help: 'Time spent processing picks',
  buckets: [0.1, 0.5, 1, 2, 5],
  labelNames: ['bet_type'] as const
});

export const failedOperations = new client.Counter({
  name: 'grading_failed_operations_total',
  help: 'Number of failed operations',
  labelNames: ['operation_type', 'error_type'] as const
});

export const queueSize = new client.Gauge({
  name: 'grading_queue_size',
  help: 'Current number of picks waiting to be processed'
});

// Register all metrics
register.registerMetric(picksProcessed);
register.registerMetric(pickGrades);
register.registerMetric(processingDuration);
register.registerMetric(failedOperations);
register.registerMetric(queueSize);

// Helper functions
export function trackPickProcessed(betType: BetType, status: 'success' | 'failure'): void {
  picksProcessed.labels(betType, status).inc();
}

export function trackPickGrade(tier: GradeTier, betType: BetType): void {
  pickGrades.labels(tier, betType).inc();
}

export function trackProcessingTime(betType: BetType, durationMs: number): void {
  processingDuration.labels(betType).observe(durationMs / 1000);
}

export function trackFailedOperation(operationType: string, errorType: string): void {
  failedOperations.labels(operationType, errorType).inc();
}

export function updateQueueSize(size: number): void {
  queueSize.set(size);
}

export { register }; 
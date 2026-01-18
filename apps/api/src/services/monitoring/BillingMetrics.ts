/**
 * Billing Metrics Service
 * Prometheus metrics for billing operations and tenant usage
 * 
 * Phase 15: Analytics & Monetization Layer
 * Date: 2025-01-25
 * 
 * Metrics Exposed:
 * - tenant_usage_total (counter) - Total usage events by tenant and event type
 * - billing_job_duration_seconds (histogram) - Billing job execution time
 * - billing_job_failures_total (counter) - Failed billing jobs
 * - tenant_cost_variance (gauge) - Cost variance from expected
 * - tenant_usage_events_total (counter) - Total events processed
 * - tenant_billing_amount_cents (gauge) - Current billing amount per tenant
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BillingMetrics');

export class BillingMetrics {
  private registry: Registry;

  // Counters
  public tenantUsageTotal: Counter;
  public billingJobFailuresTotal: Counter;
  public tenantUsageEventsTotal: Counter;

  // Histograms
  public billingJobDurationSeconds: Histogram;

  // Gauges
  public tenantCostVariance: Gauge;
  public tenantBillingAmountCents: Gauge;
  public activeTenants: Gauge;
  public monthlyRevenueCents: Gauge;

  constructor(registry: Registry) {
    this.registry = registry;

    // Initialize metrics
    this.tenantUsageTotal = new Counter({
      name: 'tenant_usage_total',
      help: 'Total usage events by tenant and event type',
      labelNames: ['tenant_id', 'user_id', 'event_type', 'resource_type'],
      registers: [registry],
    });

    this.billingJobFailuresTotal = new Counter({
      name: 'billing_job_failures_total',
      help: 'Total number of failed billing jobs',
      labelNames: ['job_type', 'error_type'],
      registers: [registry],
    });

    this.tenantUsageEventsTotal = new Counter({
      name: 'tenant_usage_events_total',
      help: 'Total usage events processed across all tenants',
      labelNames: ['event_type'],
      registers: [registry],
    });

    this.billingJobDurationSeconds = new Histogram({
      name: 'billing_job_duration_seconds',
      help: 'Duration of billing job execution in seconds',
      labelNames: ['job_type', 'status'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600], // 1s to 10min
      registers: [registry],
    });

    this.tenantCostVariance = new Gauge({
      name: 'tenant_cost_variance',
      help: 'Cost variance from expected billing amount (percentage)',
      labelNames: ['tenant_id', 'billing_month'],
      registers: [registry],
    });

    this.tenantBillingAmountCents = new Gauge({
      name: 'tenant_billing_amount_cents',
      help: 'Current billing amount for tenant in cents',
      labelNames: ['tenant_id', 'user_id', 'billing_month'],
      registers: [registry],
    });

    this.activeTenants = new Gauge({
      name: 'active_tenants_total',
      help: 'Total number of active tenants',
      registers: [registry],
    });

    this.monthlyRevenueCents = new Gauge({
      name: 'monthly_revenue_cents',
      help: 'Total monthly revenue in cents',
      labelNames: ['billing_month'],
      registers: [registry],
    });

    logger.info('BillingMetrics initialized');
  }

  /**
   * Record a usage event
   */
  recordUsageEvent(params: {
    tenantId?: string;
    userId: string;
    eventType: string;
    resourceType: string;
  }): void {
    this.tenantUsageTotal.inc({
      tenant_id: params.tenantId || params.userId,
      user_id: params.userId,
      event_type: params.eventType,
      resource_type: params.resourceType,
    });

    this.tenantUsageEventsTotal.inc({
      event_type: params.eventType,
    });
  }

  /**
   * Record billing job execution
   */
  recordBillingJob(params: {
    jobType: string;
    status: 'completed' | 'failed';
    durationSeconds: number;
  }): void {
    this.billingJobDurationSeconds.observe(
      {
        job_type: params.jobType,
        status: params.status,
      },
      params.durationSeconds
    );

    if (params.status === 'failed') {
      this.billingJobFailuresTotal.inc({
        job_type: params.jobType,
        error_type: 'execution_failed',
      });
    }
  }

  /**
   * Record billing job failure
   */
  recordBillingJobFailure(params: { jobType: string; errorType: string }): void {
    this.billingJobFailuresTotal.inc({
      job_type: params.jobType,
      error_type: params.errorType,
    });
  }

  /**
   * Update tenant cost variance
   */
  updateTenantCostVariance(params: {
    tenantId: string;
    billingMonth: string;
    variancePercentage: number;
  }): void {
    this.tenantCostVariance.set(
      {
        tenant_id: params.tenantId,
        billing_month: params.billingMonth,
      },
      params.variancePercentage
    );
  }

  /**
   * Update tenant billing amount
   */
  updateTenantBillingAmount(params: {
    tenantId: string;
    userId: string;
    billingMonth: string;
    amountCents: number;
  }): void {
    this.tenantBillingAmountCents.set(
      {
        tenant_id: params.tenantId,
        user_id: params.userId,
        billing_month: params.billingMonth,
      },
      params.amountCents
    );
  }

  /**
   * Update active tenants count
   */
  updateActiveTenants(count: number): void {
    this.activeTenants.set(count);
  }

  /**
   * Update monthly revenue
   */
  updateMonthlyRevenue(params: { billingMonth: string; revenueCents: number }): void {
    this.monthlyRevenueCents.set(
      {
        billing_month: params.billingMonth,
      },
      params.revenueCents
    );
  }

  /**
   * Get metrics registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics as Prometheus text format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

// Singleton instance
let billingMetrics: BillingMetrics | null = null;

export function initBillingMetrics(registry: Registry): BillingMetrics {
  if (!billingMetrics) {
    billingMetrics = new BillingMetrics(registry);
    logger.info('BillingMetrics singleton initialized');
  }
  return billingMetrics;
}

export function getBillingMetrics(): BillingMetrics {
  if (!billingMetrics) {
    throw new Error('BillingMetrics not initialized. Call initBillingMetrics first.');
  }
  return billingMetrics;
}


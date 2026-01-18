/**
 * Billing Worker
 * Periodic aggregator that sums usage per tenant, applies pricing tiers,
 * generates invoices, and syncs with Stripe API
 * 
 * Phase 15: Analytics & Monetization Layer
 * Date: 2025-01-25
 * 
 * Responsibilities:
 * - Monthly usage aggregation per tenant
 * - Pricing tier application and overage calculation
 * - Invoice generation and Stripe sync
 * - Manual override support
 * - Audit logging
 */

import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createLogger } from '../utils/logger';
import { getBillingService } from '../services/BillingService';

const logger = createLogger('BillingWorker');

interface BillingJobConfig {
  billingMonth: Date;
  jobType: 'monthly_aggregation' | 'invoice_generation' | 'stripe_sync' | 'manual_override';
  dryRun?: boolean;
}

interface BillingJobResult {
  jobId: string;
  tenantsProcessed: number;
  invoicesGenerated: number;
  totalRevenueCents: number;
  durationSeconds: number;
  errors: string[];
}

interface TenantBillingRecord {
  tenantId: string;
  userId: string;
  totalEvents: number;
  apiCalls: number;
  pickSubmissions: number;
  gradingOperations: number;
  webhookDeliveries: number;
  aiAnalyses: number;
  baseCostCents: number;
  usageCostCents: number;
  overageCostCents: number;
  discountCents: number;
  totalCostCents: number;
}

export class BillingWorker {
  private supabase: SupabaseClient;
  private stripe: Stripe;
  private isRunning = false;
  private scheduledJobTimer?: NodeJS.Timeout;

  constructor(supabase: SupabaseClient, stripeSecretKey: string) {
    this.supabase = supabase;
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }

  /**
   * Start scheduled billing jobs
   * Runs on the 1st of each month at 2 AM
   */
  async startScheduled(): Promise<void> {
    if (this.isRunning) {
      logger.warn('BillingWorker already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting BillingWorker scheduled jobs...');

    // Schedule monthly billing job
    this.scheduleMonthlyBilling();
  }

  /**
   * Stop scheduled billing jobs
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.scheduledJobTimer) {
      clearTimeout(this.scheduledJobTimer);
    }

    logger.info('BillingWorker stopped');
  }

  /**
   * Schedule monthly billing to run on 1st of each month at 2 AM
   */
  private scheduleMonthlyBilling(): void {
    const now = new Date();
    const nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0); // 1st of next month at 2 AM

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    logger.info('Scheduling next monthly billing job', {
      nextRun: nextRun.toISOString(),
      msUntilNextRun,
    });

    this.scheduledJobTimer = setTimeout(async () => {
      await this.runMonthlyBilling();
      this.scheduleMonthlyBilling(); // Schedule next run
    }, msUntilNextRun);
  }

  /**
   * Run monthly billing for all tenants
   */
  async runMonthlyBilling(config?: Partial<BillingJobConfig>): Promise<BillingJobResult> {
    const startTime = Date.now();
    const billingMonth = config?.billingMonth || this.getPreviousMonth();
    const dryRun = config?.dryRun || false;

    logger.info('Starting monthly billing job', { billingMonth, dryRun });

    // Create billing job record
    const jobId = await this.createBillingJob({
      jobType: 'monthly_aggregation',
      billingMonth,
    });

    const result: BillingJobResult = {
      jobId,
      tenantsProcessed: 0,
      invoicesGenerated: 0,
      totalRevenueCents: 0,
      durationSeconds: 0,
      errors: [],
    };

    try {
      // Update job status to running
      await this.updateBillingJob(jobId, { status: 'running', started_at: new Date() });

      // Get all active tenants
      const tenants = await this.getActiveTenants(billingMonth);
      logger.info(`Processing billing for ${tenants.length} tenants`);

      // Process each tenant
      for (const tenant of tenants) {
        try {
          const billingRecord = await this.processTenantBilling(tenant, billingMonth, dryRun);
          result.tenantsProcessed++;
          result.totalRevenueCents += billingRecord.totalCostCents;

          // Generate invoice if not dry run
          if (!dryRun && billingRecord.totalCostCents > 0) {
            await this.generateInvoice(billingRecord, billingMonth);
            result.invoicesGenerated++;
          }
        } catch (error) {
          const errorMsg = `Failed to process tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Update job status to completed
      const durationSeconds = (Date.now() - startTime) / 1000;
      result.durationSeconds = durationSeconds;

      await this.updateBillingJob(jobId, {
        status: 'completed',
        completed_at: new Date(),
        duration_seconds: durationSeconds,
        tenants_processed: result.tenantsProcessed,
        invoices_generated: result.invoicesGenerated,
        total_revenue_cents: result.totalRevenueCents,
      });

      logger.info('Monthly billing job completed', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Monthly billing job failed', { error: errorMsg });

      await this.updateBillingJob(jobId, {
        status: 'failed',
        completed_at: new Date(),
        error_message: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Process billing for a single tenant
   */
  private async processTenantBilling(
    tenant: any,
    billingMonth: Date,
    dryRun: boolean
  ): Promise<TenantBillingRecord> {
    logger.debug('Processing tenant billing', { tenantId: tenant.id, billingMonth });

    // Aggregate usage for the month
    const { data: usage, error: usageError } = await this.supabase.rpc(
      'aggregate_tenant_usage',
      {
        p_tenant_id: tenant.id,
        p_billing_month: billingMonth.toISOString().split('T')[0],
      }
    );

    if (usageError) throw usageError;

    const usageData = usage[0] || {
      total_events: 0,
      api_calls: 0,
      pick_submissions: 0,
      grading_operations: 0,
      webhook_deliveries: 0,
      ai_analyses: 0,
      total_cost_cents: 0,
    };

    // Get user's subscription plan
    const { data: subscription } = await this.supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', tenant.user_id)
      .single();

    // Calculate base cost (subscription fee)
    const baseCostCents = subscription?.subscription_plans?.price_monthly_cents || 0;

    // Calculate overage charges
    const { data: overageData } = await this.supabase.rpc('calculate_overage_charges', {
      p_user_id: tenant.user_id,
      p_billing_month: billingMonth.toISOString().split('T')[0],
    });

    const overageCostCents = overageData || 0;

    // Calculate discounts (if any)
    const discountCents = 0; // TODO: Implement discount logic

    // Calculate total cost
    const totalCostCents =
      baseCostCents + usageData.total_cost_cents + overageCostCents - discountCents;

    const billingRecord: TenantBillingRecord = {
      tenantId: tenant.id,
      userId: tenant.user_id,
      totalEvents: usageData.total_events,
      apiCalls: usageData.api_calls,
      pickSubmissions: usageData.pick_submissions,
      gradingOperations: usageData.grading_operations,
      webhookDeliveries: usageData.webhook_deliveries,
      aiAnalyses: usageData.ai_analyses,
      baseCostCents,
      usageCostCents: usageData.total_cost_cents,
      overageCostCents,
      discountCents,
      totalCostCents,
    };

    // Save billing record to database
    if (!dryRun) {
      await this.saveBillingRecord(billingRecord, billingMonth, subscription?.plan_id);
    }

    return billingRecord;
  }

  /**
   * Generate invoice and sync with Stripe
   */
  private async generateInvoice(
    billingRecord: TenantBillingRecord,
    billingMonth: Date
  ): Promise<void> {
    logger.info('Generating invoice', {
      tenantId: billingRecord.tenantId,
      totalCostCents: billingRecord.totalCostCents,
    });

    try {
      // Get user's Stripe customer ID
      const { data: subscription } = await this.supabase
        .from('user_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', billingRecord.userId)
        .single();

      if (!subscription?.stripe_customer_id) {
        logger.warn('No Stripe customer ID for user', { userId: billingRecord.userId });
        return;
      }

      // Create invoice in Stripe
      const invoice = await this.stripe.invoices.create({
        customer: subscription.stripe_customer_id,
        auto_advance: true,
        collection_method: 'charge_automatically',
        description: `Usage for ${billingMonth.toISOString().substring(0, 7)}`,
        metadata: {
          tenant_id: billingRecord.tenantId,
          user_id: billingRecord.userId,
          billing_month: billingMonth.toISOString().split('T')[0],
        },
      });

      // Add line items
      if (billingRecord.baseCostCents > 0) {
        await this.stripe.invoiceItems.create({
          customer: subscription.stripe_customer_id,
          invoice: invoice.id,
          amount: billingRecord.baseCostCents,
          currency: 'usd',
          description: 'Subscription fee',
        });
      }

      if (billingRecord.usageCostCents > 0) {
        await this.stripe.invoiceItems.create({
          customer: subscription.stripe_customer_id,
          invoice: invoice.id,
          amount: billingRecord.usageCostCents,
          currency: 'usd',
          description: 'Usage charges',
        });
      }

      if (billingRecord.overageCostCents > 0) {
        await this.stripe.invoiceItems.create({
          customer: subscription.stripe_customer_id,
          invoice: invoice.id,
          amount: billingRecord.overageCostCents,
          currency: 'usd',
          description: 'Overage charges',
        });
      }

      // Finalize invoice
      await this.stripe.invoices.finalizeInvoice(invoice.id);

      // Update billing record with Stripe invoice ID
      await this.supabase
        .from('tenant_billing')
        .update({
          stripe_invoice_id: invoice.id,
          invoice_status: 'generated',
          invoice_generated_at: new Date().toISOString(),
        })
        .eq('tenant_id', billingRecord.tenantId)
        .eq('billing_month', billingMonth.toISOString().split('T')[0]);

      logger.info('Invoice generated successfully', {
        invoiceId: invoice.id,
        tenantId: billingRecord.tenantId,
      });
    } catch (error) {
      logger.error('Failed to generate invoice', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: billingRecord.tenantId,
      });
      throw error;
    }
  }

  /**
   * Save billing record to database
   */
  private async saveBillingRecord(
    billingRecord: TenantBillingRecord,
    billingMonth: Date,
    pricingPlanId?: string
  ): Promise<void> {
    await this.supabase.from('tenant_billing').upsert({
      tenant_id: billingRecord.tenantId,
      user_id: billingRecord.userId,
      billing_month: billingMonth.toISOString().split('T')[0],
      billing_period_start: billingMonth.toISOString(),
      billing_period_end: new Date(
        billingMonth.getFullYear(),
        billingMonth.getMonth() + 1,
        0
      ).toISOString(),
      total_events: billingRecord.totalEvents,
      api_calls: billingRecord.apiCalls,
      pick_submissions: billingRecord.pickSubmissions,
      grading_operations: billingRecord.gradingOperations,
      webhook_deliveries: billingRecord.webhookDeliveries,
      ai_analyses: billingRecord.aiAnalyses,
      base_cost_cents: billingRecord.baseCostCents,
      usage_cost_cents: billingRecord.usageCostCents,
      overage_cost_cents: billingRecord.overageCostCents,
      discount_cents: billingRecord.discountCents,
      total_cost_cents: billingRecord.totalCostCents,
      pricing_plan_id: pricingPlanId,
    });
  }

  /**
   * Get active tenants for billing period
   */
  private async getActiveTenants(billingMonth: Date): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, username')
      .not('id', 'is', null);

    if (error) throw error;

    // Map users to tenants (for now, 1:1 mapping)
    return (data || []).map((user) => ({
      id: user.id, // tenant_id = user_id
      user_id: user.id,
      email: user.email,
      username: user.username,
    }));
  }

  /**
   * Create billing job record
   */
  private async createBillingJob(config: BillingJobConfig): Promise<string> {
    const { data, error } = await this.supabase
      .from('billing_jobs')
      .insert({
        job_type: config.jobType,
        billing_month: config.billingMonth.toISOString().split('T')[0],
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Update billing job record
   */
  private async updateBillingJob(jobId: string, updates: any): Promise<void> {
    await this.supabase.from('billing_jobs').update(updates).eq('id', jobId);
  }

  /**
   * Get previous month for billing
   */
  private getPreviousMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
}

// Singleton instance
let billingWorker: BillingWorker | null = null;

export function initBillingWorker(
  supabase: SupabaseClient,
  stripeSecretKey: string
): BillingWorker {
  if (!billingWorker) {
    billingWorker = new BillingWorker(supabase, stripeSecretKey);
    logger.info('BillingWorker initialized');
  }
  return billingWorker;
}

export function getBillingWorker(): BillingWorker {
  if (!billingWorker) {
    throw new Error('BillingWorker not initialized. Call initBillingWorker first.');
  }
  return billingWorker;
}


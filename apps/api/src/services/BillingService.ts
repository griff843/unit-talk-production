/**
 * Billing Service
 * Manages subscriptions, invoices, and payment processing via Stripe
 * 
 * Phase 15: Analytics and Monetization Engine
 * Date: 2025-01-25
 */

import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const logger = createLogger('BillingService');

export interface CreateSubscriptionParams {
  userId: string;
  planSlug: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  planSlug?: string;
  billingCycle?: 'monthly' | 'yearly';
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionInfo {
  id: string;
  userId: string;
  planName: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
}

export class BillingService {
  private stripe: Stripe;
  private supabase: SupabaseClient;

  constructor(stripeSecretKey: string, supabase: SupabaseClient) {
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
    this.supabase = supabase;
    logger.info('BillingService initialized');
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionInfo> {
    try {
      // Get plan details
      const { data: plan, error: planError } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', params.planSlug)
        .single();

      if (planError || !plan) {
        throw new Error(`Plan not found: ${params.planSlug}`);
      }

      // Get or create Stripe customer
      const stripeCustomerId = await this.getOrCreateStripeCustomer(params.userId);

      // Attach payment method if provided
      if (params.paymentMethodId) {
        await this.stripe.paymentMethods.attach(params.paymentMethodId, {
          customer: stripeCustomerId,
        });

        await this.stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: params.paymentMethodId,
          },
        });
      }

      // Get Stripe price ID
      const stripePriceId =
        params.billingCycle === 'yearly'
          ? plan.stripe_price_id_yearly
          : plan.stripe_price_id_monthly;

      if (!stripePriceId) {
        throw new Error(`Stripe price ID not configured for plan: ${params.planSlug}`);
      }

      // Create Stripe subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePriceId }],
        trial_period_days: params.trialDays,
        expand: ['latest_invoice.payment_intent'],
      });

      // Save subscription to database
      const { data: dbSubscription, error: dbError } = await this.supabase
        .from('user_subscriptions')
        .upsert({
          user_id: params.userId,
          plan_id: plan.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          stripe_payment_method_id: params.paymentMethodId || null,
          status: subscription.status,
          billing_cycle: params.billingCycle,
          current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          trial_start: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : null,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      logger.info('Subscription created', {
        userId: params.userId,
        planSlug: params.planSlug,
        subscriptionId: subscription.id,
      });

      return {
        id: dbSubscription.id,
        userId: params.userId,
        planName: plan.name,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to create subscription', {
        error: error instanceof Error ? error.message : String(error),
        params,
      });
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(params: UpdateSubscriptionParams): Promise<SubscriptionInfo> {
    try {
      // Get current subscription
      const { data: dbSubscription, error: dbError } = await this.supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('id', params.subscriptionId)
        .single();

      if (dbError || !dbSubscription) {
        throw new Error(`Subscription not found: ${params.subscriptionId}`);
      }

      const updateData: Stripe.SubscriptionUpdateParams = {};

      // Update plan if requested
      if (params.planSlug) {
        const { data: newPlan } = await this.supabase
          .from('subscription_plans')
          .select('*')
          .eq('slug', params.planSlug)
          .single();

        if (newPlan) {
          const stripePriceId =
            params.billingCycle === 'yearly'
              ? newPlan.stripe_price_id_yearly
              : newPlan.stripe_price_id_monthly;

          updateData.items = [
            {
              id: (await this.stripe.subscriptions.retrieve(dbSubscription.stripe_subscription_id))
                .items.data[0].id,
              price: stripePriceId,
            },
          ];
        }
      }

      // Update cancel_at_period_end if requested
      if (params.cancelAtPeriodEnd !== undefined) {
        updateData.cancel_at_period_end = params.cancelAtPeriodEnd;
      }

      // Update Stripe subscription
      const subscription = await this.stripe.subscriptions.update(
        dbSubscription.stripe_subscription_id,
        updateData
      );

      // Update database
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
        })
        .eq('id', params.subscriptionId);

      logger.info('Subscription updated', {
        subscriptionId: params.subscriptionId,
        updates: params,
      });

      return {
        id: dbSubscription.id,
        userId: dbSubscription.user_id,
        planName: dbSubscription.subscription_plans.name,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    } catch (error) {
      logger.error('Failed to update subscription', {
        error: error instanceof Error ? error.message : String(error),
        params,
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<void> {
    try {
      const { data: dbSubscription } = await this.supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id')
        .eq('id', subscriptionId)
        .single();

      if (!dbSubscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (immediately) {
        // Cancel immediately
        await this.stripe.subscriptions.cancel(dbSubscription.stripe_subscription_id);
      } else {
        // Cancel at period end
        await this.stripe.subscriptions.update(dbSubscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }

      await this.supabase
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: !immediately,
          canceled_at: immediately ? new Date().toISOString() : null,
          status: immediately ? 'canceled' : 'active',
        })
        .eq('id', subscriptionId);

      logger.info('Subscription canceled', { subscriptionId, immediately });
    } catch (error) {
      logger.error('Failed to cancel subscription', {
        error: error instanceof Error ? error.message : String(error),
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      // Log event
      await this.supabase.from('payment_events').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event.data.object as any,
        processed: false,
      });

      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      // Mark event as processed
      await this.supabase
        .from('payment_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('stripe_event_id', event.id);

      logger.info('Webhook processed', { eventType: event.type, eventId: event.id });
    } catch (error) {
      logger.error('Failed to handle webhook', {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
        eventId: event.id,
      });

      // Log error in payment_events
      await this.supabase
        .from('payment_events')
        .update({
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('stripe_event_id', event.id);

      throw error;
    }
  }

  /**
   * Get or create Stripe customer for user
   */
  private async getOrCreateStripeCustomer(userId: string): Promise<string> {
    // Check if customer already exists
    const { data: subscription } = await this.supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (subscription?.stripe_customer_id) {
      return subscription.stripe_customer_id;
    }

    // Get user details
    const { data: user } = await this.supabase
      .from('users')
      .select('email, username, discord_id')
      .eq('id', userId)
      .single();

    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      email: user?.email || undefined,
      name: user?.username || undefined,
      metadata: {
        user_id: userId,
        discord_id: user?.discord_id || '',
      },
    });

    return customer.id;
  }

  /**
   * Handle subscription update webhook
   */
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    await this.supabase
      .from('user_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  /**
   * Handle subscription deleted webhook
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  /**
   * Handle invoice paid webhook
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Create or update invoice record
    await this.supabase.from('invoices').upsert({
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: (invoice as any).payment_intent as string,
      invoice_number: invoice.number || `INV-${invoice.id}`,
      amount_cents: invoice.amount_paid,
      amount_paid_cents: invoice.amount_paid,
      status: 'paid',
      paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
    });
  }

  /**
   * Handle invoice payment failed webhook
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Update subscription status
    if ((invoice as any).subscription) {
      await this.supabase
        .from('user_subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', (invoice as any).subscription as string);
    }

    // TODO: Send alert to user about payment failure
    logger.warn('Invoice payment failed', { invoiceId: invoice.id });
  }

  /**
   * Handle trial will end webhook
   */
  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    // TODO: Send alert to user about trial ending
    logger.info('Trial will end soon', { subscriptionId: subscription.id });
  }
}

// Singleton instance
let billingService: BillingService | null = null;

export function initBillingService(
  stripeSecretKey: string,
  supabase: SupabaseClient
): BillingService {
  if (!billingService) {
    billingService = new BillingService(stripeSecretKey, supabase);
    logger.info('BillingService initialized');
  }
  return billingService;
}

export function getBillingService(): BillingService {
  if (!billingService) {
    throw new Error('BillingService not initialized. Call initBillingService first.');
  }
  return billingService;
}


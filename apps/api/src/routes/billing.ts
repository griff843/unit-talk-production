/**
 * Billing API Routes
 * Handles subscription management and Stripe webhooks
 * 
 * Phase 15: Analytics and Monetization Engine
 * Date: 2025-01-25
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getBillingService } from '../services/BillingService';
import { logger } from '../shared/logger';

const router = Router();

/**
 * POST /api/billing/subscriptions
 * Create a new subscription
 */
router.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { userId, planSlug, billingCycle, paymentMethodId, trialDays } = req.body;

    if (!userId || !planSlug || !billingCycle) {
      return res.status(400).json({
        error: 'Missing required fields: userId, planSlug, billingCycle',
      });
    }

    const billingService = getBillingService();
    const subscription = await billingService.createSubscription({
      userId,
      planSlug,
      billingCycle,
      paymentMethodId,
      trialDays,
    });

    res.status(201).json({ subscription });
  } catch (error) {
    logger.error('Failed to create subscription', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/billing/subscriptions/:id
 * Update an existing subscription
 */
router.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { planSlug, billingCycle, cancelAtPeriodEnd } = req.body;

    const billingService = getBillingService();
    const subscription = await billingService.updateSubscription({
      subscriptionId: id,
      planSlug,
      billingCycle,
      cancelAtPeriodEnd,
    });

    res.json({ subscription });
  } catch (error) {
    logger.error('Failed to update subscription', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to update subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/billing/subscriptions/:id
 * Cancel a subscription
 */
router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { immediately } = req.query;

    const billingService = getBillingService();
    await billingService.cancelSubscription(id, immediately === 'true');

    res.json({ message: 'Subscription canceled successfully' });
  } catch (error) {
    logger.error('Failed to cancel subscription', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/billing/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post(
  '/webhooks/stripe',
  // Use raw body for Stripe signature verification
  async (req: Request, res: Response) => {
    try {
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.error('STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      // Verify webhook signature
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-12-15.clover',
      });

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig as string,
          webhookSecret
        );
      } catch (err) {
        logger.error('Webhook signature verification failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return res.status(400).json({
          error: 'Webhook signature verification failed',
        });
      }

      // Handle the event
      const billingService = getBillingService();
      await billingService.handleWebhook(event);

      res.json({ received: true });
    } catch (error) {
      logger.error('Failed to handle webhook', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: 'Failed to handle webhook',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * GET /api/billing/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const { supabase } = req as any; // Assuming supabase middleware

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order');

    if (error) throw error;

    res.json({ plans });
  } catch (error) {
    logger.error('Failed to fetch plans', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to fetch plans',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as billingRoutes };


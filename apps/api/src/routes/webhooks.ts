import { Router } from 'express';

import { smartFormWebhookHandler } from '../api/webhooks/smartFormWebhook';

const router: Router = Router();

/**
 * Smart Form Webhook Routes
 * For Supabase webhook integration
 */

// Main webhook endpoint for smart_tickets table changes
router.post('/smart-form', async (req, res) => {
  await smartFormWebhookHandler.handleWebhook(req, res);
});

// Health check endpoint
router.get('/smart-form/health', async (req, res) => {
  await smartFormWebhookHandler.healthCheck(req, res);
});

export { router as webhookRoutes };

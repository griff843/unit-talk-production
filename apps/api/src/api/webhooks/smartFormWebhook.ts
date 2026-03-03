import { Request, Response } from 'express';

import { SmartFormBridge } from '../../services/SmartFormBridge';
import { logger } from '../../shared/logger';

/**
 * Webhook endpoint for Supabase smart_tickets table changes
 * Triggered when new submissions are added to smart_tickets table
 */
export class SmartFormWebhookHandler {
  private bridge: SmartFormBridge;

  constructor() {
    this.bridge = new SmartFormBridge();
  }

  /**
   * Handle webhook from Supabase on smart_tickets INSERT
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const webhookLogger = logger.child({ source: 'smart_form_webhook' });

    try {
      // Validate webhook payload
      const { type, table, record, old_record: _old_record } = req.body;

      if (!this.isValidWebhook(type, table, record)) {
        webhookLogger.warn('Invalid webhook payload received', { body: req.body });
        res.status(400).json({ error: 'Invalid webhook payload' });
        return;
      }

      webhookLogger.info('Processing smart form webhook', {
        type,
        table,
        ticketId: record.id,
        capper: record.capper,
      });

      // Only process INSERT events for new submissions
      if (type === 'INSERT' && record.status === 'submitted') {
        // Process asynchronously to avoid webhook timeout
        this.processSubmissionAsync(record.id, webhookLogger);

        // Respond immediately to Supabase
        res.status(200).json({
          message: 'Webhook received, processing submission',
          ticketId: record.id,
        });
      } else {
        webhookLogger.info('Webhook ignored - not a new submission', {
          type,
          status: record.status,
        });

        res.status(200).json({ message: 'Webhook acknowledged but not processed' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      webhookLogger.error('Webhook processing failed', {
        error: errorMessage,
        stack: errorStack,
        body: req.body,
      });

      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Validate webhook payload structure
   */
  private isValidWebhook(type: string, table: string, record: any): boolean {
    if (!type || !table || !record) {
      return false;
    }

    if (table !== 'smart_tickets') {
      return false;
    }

    if (!record.id || !record.capper) {
      return false;
    }

    return true;
  }

  /**
   * Process submission asynchronously to avoid webhook timeout
   */
  private async processSubmissionAsync(ticketId: string, webhookLogger: any): Promise<void> {
    try {
      // Add small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process the submission through the bridge
      await this.bridge.processSubmission(ticketId);

      webhookLogger.info('Smart form submission processed successfully', { ticketId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      webhookLogger.error('Async submission processing failed', {
        ticketId,
        error: errorMessage,
        stack: errorStack,
      });

      // The error is already handled in the bridge service
      // which will update the smart ticket status and send alerts
    }
  }

  /**
   * Health check endpoint for webhook
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'smart-form-webhook',
      timestamp: new Date().toISOString(),
    });
  }
}

// Export the handler instance
export const smartFormWebhookHandler = new SmartFormWebhookHandler();

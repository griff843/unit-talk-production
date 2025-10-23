import { Request, Response } from 'express';
/**
 * Webhook endpoint for Supabase smart_tickets table changes
 * Triggered when new submissions are added to smart_tickets table
 */
export declare class SmartFormWebhookHandler {
    private bridge;
    constructor();
    /**
     * Handle webhook from Supabase on smart_tickets INSERT
     */
    handleWebhook(req: Request, res: Response): Promise<void>;
    /**
     * Validate webhook payload structure
     */
    private isValidWebhook;
    /**
     * Process submission asynchronously to avoid webhook timeout
     */
    private processSubmissionAsync;
    /**
     * Health check endpoint for webhook
     */
    healthCheck(_req: Request, res: Response): Promise<void>;
}
export declare const smartFormWebhookHandler: SmartFormWebhookHandler;
//# sourceMappingURL=smartFormWebhook.d.ts.map
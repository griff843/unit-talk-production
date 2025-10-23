"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRoutes = void 0;
const express_1 = require("express");
const smartFormWebhook_1 = require("../api/webhooks/smartFormWebhook");
const router = (0, express_1.Router)();
exports.webhookRoutes = router;
/**
 * Smart Form Webhook Routes
 * For Supabase webhook integration
 */
// Main webhook endpoint for smart_tickets table changes
router.post('/smart-form', async (req, res) => {
    await smartFormWebhook_1.smartFormWebhookHandler.handleWebhook(req, res);
});
// Health check endpoint
router.get('/smart-form/health', async (req, res) => {
    await smartFormWebhook_1.smartFormWebhookHandler.healthCheck(req, res);
});

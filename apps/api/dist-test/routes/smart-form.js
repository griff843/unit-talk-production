"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartFormRouter = void 0;
const express_1 = __importDefault(require("express"));
const SmartFormBridge_1 = require("../services/SmartFormBridge");
const logger_1 = require("../shared/logger");
const errorHandling_1 = require("../utils/errorHandling");
const router = express_1.default.Router();
exports.smartFormRouter = router;
/**
 * Process smart form submission via SmartFormBridge
 * POST /api/smart-form/process
 */
router.post('/process', async (req, res) => {
    const correlationId = `smart-form-api-${Date.now()}`;
    const requestLogger = logger_1.logger.child({ correlationId, endpoint: '/api/smart-form/process' });
    try {
        const { ticketId, source } = req.body;
        if (!ticketId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: ticketId'
            });
        }
        requestLogger.info('Processing smart form submission via API', {
            ticketId,
            source: source || 'unknown',
            userAgent: req.headers['user-agent'],
            authorization: req.headers.authorization ? 'provided' : 'missing'
        });
        // Initialize SmartFormBridge and process
        const bridge = new SmartFormBridge_1.SmartFormBridge();
        await bridge.processSubmission(ticketId);
        requestLogger.info('Smart form processing completed successfully', {
            ticketId,
            processingTimeMs: Date.now() - parseInt(correlationId.split('-').pop() || '0')
        });
        return res.json({
            success: true,
            ticketId,
            message: 'Smart form processed successfully',
            correlationId
        });
    }
    catch (error) {
        requestLogger.error('Smart form processing failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ticketId: req.body?.ticketId
        });
        // Use centralized error handler
        const handler = new errorHandling_1.ErrorHandler('smart-form-api');
        await handler.handleError(error instanceof Error ? error : new Error(String(error)), {
            correlationId,
            ticketId: req.body?.ticketId
        });
        return res.status(500).json({
            success: false,
            error: 'Internal server error during smart form processing',
            correlationId,
            message: error instanceof Error ? error.message : 'Unknown processing error'
        });
    }
});
/**
 * Health check for smart form API
 * GET /api/smart-form/health
 */
router.get('/health', (_req, res) => {
    return res.json({
        success: true,
        service: 'smart-form-api',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

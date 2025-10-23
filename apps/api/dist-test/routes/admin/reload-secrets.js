"use strict";
/**
 * Admin endpoint for hot-reloading secrets without container restart
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reloadSecretsEndpoint = reloadSecretsEndpoint;
const secretDriftGuard_1 = require("../../agents/FeedAgent/secretDriftGuard");
// Simple auth middleware (in production, use proper auth)
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    // In production, implement proper JWT validation
    if (token === 'admin-reload-token' || process.env.ADMIN_TOKEN === token) {
        next();
    }
    else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}
async function reloadSecretsEndpoint(req, res) {
    try {
        // Apply simple auth
        requireAdmin(req, res, () => { });
        if (res.headersSent)
            return;
        console.log('[Admin] Secret reload requested');
        // Optional: Accept new secrets in request body
        const newSecrets = req.body?.secrets || undefined;
        // Reload secrets
        const result = await secretDriftGuard_1.secretDriftGuard.reloadSecrets(newSecrets);
        console.log('[Admin] Secret reload result:', result);
        res.json({
            success: result.success,
            updated: result.updated,
            failed: result.failed,
            error: result.error,
            timestamp: new Date().toISOString(),
            message: result.success
                ? `Successfully updated ${result.updated.length} secrets`
                : `Failed to update ${result.failed.length} secrets`
        });
    }
    catch (error) {
        console.error('[Admin] Secret reload error:', error);
        res.status(500).json({
            error: 'Secret reload failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}

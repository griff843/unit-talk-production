/**
 * Admin endpoint for hot-reloading secrets without container restart
 */

import { Request, Response } from 'express';
import { secretDriftGuard } from '../../agents/FeedAgent/secretDriftGuard';

// Simple auth middleware (in production, use proper auth)
function requireAdmin(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  // In production, implement proper JWT validation
  if (token === 'admin-reload-token' || process.env.ADMIN_TOKEN === token) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function reloadSecretsEndpoint(req: Request, res: Response) {
  try {
    // Apply simple auth
    requireAdmin(req, res, () => {});
    if (res.headersSent) return;
    
    console.log('[Admin] Secret reload requested');
    
    // Optional: Accept new secrets in request body
    const newSecrets = req.body?.secrets || undefined;
    
    // Reload secrets
    const result = await secretDriftGuard.reloadSecrets(newSecrets);
    
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
    
  } catch (error) {
    console.error('[Admin] Secret reload error:', error);
    res.status(500).json({
      error: 'Secret reload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
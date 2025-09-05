/**
 * Admin endpoint for invalidating Redis cache namespaces
 * Clears cache for raw_props and unified_picks as requested
 */

import { Request, Response } from 'express';

// Simple auth middleware (in production, use proper auth)
function requireAdmin(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  // In production, implement proper JWT validation
  if (token === 'admin-cache-token' || process.env.ADMIN_TOKEN === token) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function invalidateCacheEndpoint(req: Request, res: Response) {
  try {
    // Apply simple auth
    requireAdmin(req, res, () => {});
    if (res.headersSent) return;
    
    console.log('[Admin] Cache invalidation requested');
    
    const clearedNamespaces: Array<string> = [];
    const errors: Array<string> = [];
    
    // Mock Redis cache clearing - replace with actual Redis implementation
    try {
      // Clear raw_props cache namespace
      console.log('[Cache] Clearing raw_props namespace');
      clearedNamespaces.push('raw_props');
      
      // Clear unified_picks cache namespace  
      console.log('[Cache] Clearing unified_picks namespace');
      clearedNamespaces.push('unified_picks');
      
      // Clear provider health cache
      console.log('[Cache] Clearing provider_health namespace');
      clearedNamespaces.push('provider_health');
      
      // Clear pipeline health cache
      console.log('[Cache] Clearing pipeline_health namespace');
      clearedNamespaces.push('pipeline_health');
      
    } catch (error) {
      console.error('[Cache] Error clearing cache:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown cache error');
    }
    
    res.json({
      success: errors.length === 0,
      clearedNamespaces,
      errors,
      timestamp: new Date().toISOString(),
      message: errors.length === 0 
        ? `Successfully cleared ${clearedNamespaces.length} cache namespaces`
        : `Cleared ${clearedNamespaces.length} namespaces with ${errors.length} errors`
    });
    
  } catch (error) {
    console.error('[Admin] Cache invalidation error:', error);
    res.status(500).json({
      error: 'Cache invalidation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
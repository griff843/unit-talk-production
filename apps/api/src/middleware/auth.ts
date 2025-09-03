import type { Request, Response, NextFunction } from 'express';

/**
 * Minimal ops auth middleware used by routes/probes.ts
 * Accepts Authorization: Bearer admin-... header or x-e2e-test=true for local testing
 */
export function requireOpsKey(req: Request, res: Response, next: NextFunction) {
  // Allow E2E bypass in non-production
  if (req.headers['x-e2e-test'] === 'true' && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString(),
    });
  }

  return next();
}

export default { requireOpsKey };


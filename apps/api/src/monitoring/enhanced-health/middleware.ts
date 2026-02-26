/**
 * Health Check Middleware and Handlers
 * PHASE1-ENFORCEMENT-LOCK-001: Split from enhanced-health-checks.ts for lint compliance
 */

import { Request, Response, NextFunction } from 'express';

import { logger } from '../../shared/logger';

import { healthChecker } from './checker';

/** Health check middleware for Express routes */
export const healthCheckMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const health = await healthChecker.getSystemHealth();
    (req as Request & { systemHealth: unknown }).systemHealth = health;
    // PHASE1-ENFORCEMENT-LOCK-001: Binary health (200 only if fully healthy)
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode);
    next();
  } catch (error) {
    logger.error('Health check middleware error', { error });
    res.status(503);
    next();
  }
};

/** Health check route handler */
export const handleHealthCheck = async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await healthChecker.getSystemHealth();
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    // PHASE1-ENFORCEMENT-LOCK-001: Binary health (200 only if fully healthy)
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check handler error', { error });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check system failure',
      timestamp: new Date().toISOString(),
    });
  }
};

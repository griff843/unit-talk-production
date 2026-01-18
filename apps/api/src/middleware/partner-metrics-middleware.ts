/**
 * Partner API Metrics Middleware
 * Phase 14: Automatic metrics collection for all partner API requests
 */

import { Response, NextFunction } from 'express';
import { PartnerAuthRequest } from './partner-auth';
import { recordApiRequest, recordApiError } from '../monitoring/partner-metrics';

/**
 * Middleware to automatically collect metrics for partner API requests
 */
export function collectPartnerMetrics(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.partner) {
    // Skip metrics collection if partner not authenticated
    next();
    return;
  }

  const startTime = Date.now();

  // Capture original send function
  const originalSend = res.send;
  res.send = function (data): Response {
    const durationMs = Date.now() - startTime;
    const durationSeconds = durationMs / 1000;

    // Record request metrics
    recordApiRequest(
      req.partner!.id,
      req.partner!.tier,
      req.path,
      req.method,
      res.statusCode,
      durationSeconds
    );

    // Record errors if status code indicates failure
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      recordApiError(
        req.partner!.id,
        req.partner!.tier,
        req.path,
        errorType
      );
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Operator Audit Log Middleware
 * Sprint: SPRINT-046-OPERATOR-AUDIT-TRAIL
 *
 * Records all authenticated operator actions to operator_audit_log.
 * Must be mounted AFTER operatorAuth middleware.
 * Best-effort: DB write failures are logged but do not block the request.
 */

import { Response, NextFunction } from 'express';

import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

import { AuthenticatedRequest } from './operatorAuth';

const logger = createLogger('OperatorAuditLog');

/** Fields that should never appear in audit log request bodies */
const REDACTED_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
  'credential',
  'private_key',
  'privateKey',
]);

/**
 * Shallow-redact sensitive fields from a request body.
 * Returns a new object with sensitive values replaced by '[REDACTED]'.
 */
function sanitizeBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    sanitized[key] = REDACTED_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return sanitized;
}

/**
 * Express middleware that writes an audit log entry after the response is sent.
 * Captures operator identity, endpoint, method, duration, and response status.
 */
export const operatorAuditLog = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Hook into response finish to capture status code and duration
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const operatorId = req.authenticatedOperatorId || 'unknown';
    const operatorEmail = req.authenticatedUser?.email || null;

    const entry = {
      operator_id: operatorId,
      operator_email: operatorEmail,
      action: `${req.method} ${req.route?.path || req.path}`,
      endpoint: req.originalUrl,
      method: req.method,
      request_body: sanitizeBody(req.body),
      response_status: res.statusCode,
      ip_address: req.ip || req.socket?.remoteAddress || null,
      user_agent: req.get('User-Agent') || null,
      duration_ms: durationMs,
      meta: {
        correlation_id: (req as any).correlationId || null,
      },
    };

    // Best-effort write — never block the response
    Promise.resolve(supabase.from('operator_audit_log').insert(entry)).then(
      ({ error }) => {
        if (error) {
          logger.warn('Failed to write audit log entry', {
            error: error.message,
            operatorId,
            endpoint: entry.endpoint,
          });
        }
      },
      (err: Error) => {
        logger.warn('Audit log write threw', {
          error: err.message,
          operatorId,
          endpoint: entry.endpoint,
        });
      }
    );
  });

  next();
};

export default operatorAuditLog;

/* eslint-disable max-lines-per-function, complexity */
// Security-critical authentication middleware requires complete validation logic
/**
 * Operator Authentication Middleware
 * Sprint: SPRINT-STRUCTURAL-REINFORCEMENT-P0-003
 *
 * CRITICAL: This middleware enforces operator identity from authenticated principal ONLY.
 * The x-operator-id header is IGNORED for authorization; it may only be used as
 * non-authoritative display metadata.
 *
 * Authority derivation:
 * 1. JWT token from Authorization header → decode → userId
 * 2. Validate user exists and is active in users table
 * 3. Set req.authenticatedOperatorId = user.id (the ONLY authority)
 * 4. If x-operator-id header differs from auth.uid → log spoof attempt
 */

import { Request, Response, NextFunction } from 'express';

import { TokenManager, SecurityEventLogger } from '../security';
import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('OperatorAuth');

/**
 * Extended Request type with authenticated operator ID
 */
export interface AuthenticatedRequest extends Request {
  authenticatedOperatorId?: string;
  authenticatedUser?: {
    id: string;
    email?: string;
    role?: string;
    display_name?: string;
  };
}

/**
 * Operator authentication middleware.
 *
 * Extracts operator identity from JWT token (Authorization: Bearer <token>).
 * NEVER trusts x-operator-id header for authorization.
 *
 * In test environment (NODE_ENV=test), allows bypass for E2E testing.
 * In production, JWT authentication is MANDATORY.
 */
export const operatorAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const correlationId = `op-auth-${Date.now()}`;

  try {
    // E2E test bypass - ONLY in test environment
    if (process.env.NODE_ENV === 'test' && req.headers['x-e2e-test'] === 'true') {
      logger.info('E2E test bypass enabled (test environment only)', { correlationId });
      // Use 'e2e-test-operator' as the authenticated ID for test tracing
      req.authenticatedOperatorId = 'e2e-test-operator';
      req.authenticatedUser = { id: 'e2e-test-operator', role: 'operator_override' };
      return next();
    }

    // UTRP-R3 DEFECT-15: Internal service token authentication
    // Allows authorized internal services (e.g. Command Center) to call lifecycle endpoints
    // without a user JWT. Token must match INTERNAL_SERVICE_TOKEN env var exactly.
    // Grants operator_override authority — never logged, never returned in responses.
    const configuredToken = process.env.INTERNAL_SERVICE_TOKEN;
    const internalToken = req.headers['x-internal-service-token'];
    if (configuredToken && configuredToken.length >= 32 && internalToken === configuredToken) {
      logger.info('Internal service token authenticated', {
        correlationId,
        source: 'internal-service',
      });
      req.authenticatedOperatorId = 'internal-service';
      req.authenticatedUser = { id: 'internal-service', role: 'operator_override' };
      return next();
    }

    // Extract JWT token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // In production, JWT is MANDATORY
    if (!token) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Operator auth failed: No JWT token provided', { correlationId });
        res.status(401).json({
          success: false,
          error: 'Authentication required: Bearer token missing',
          correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Non-production: allow with 'system' operator (for development)
      logger.warn('Non-production: No JWT token, using system operator', { correlationId });
      req.authenticatedOperatorId = 'system';
      return next();
    }

    // Verify JWT token
    const decoded = TokenManager.verifyToken(token);
    if (!decoded) {
      logger.warn('Operator auth failed: Invalid or expired token', { correlationId });
      res.status(403).json({
        success: false,
        error: 'Invalid or expired authentication token',
        correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate user exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, display_name, status, active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      logger.warn('Operator auth failed: User not found', {
        correlationId,
        userId: decoded.userId,
        error: error?.message,
      });
      res.status(403).json({
        success: false,
        error: 'User not found or access denied',
        correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check if user is active (support both status and active columns)
    const isActive = user.active === true || user.status === 'active';
    if (!isActive) {
      logger.warn('Operator auth failed: User inactive', {
        correlationId,
        userId: user.id,
      });
      res.status(403).json({
        success: false,
        error: 'User account is inactive',
        correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Set authenticated operator ID - THIS IS THE ONLY AUTHORITY
    req.authenticatedOperatorId = user.id;
    req.authenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
    };

    // SPOOF DETECTION: Check if x-operator-id header differs from authenticated user
    const spoofedOperatorId = req.headers['x-operator-id'] as string | undefined;
    if (spoofedOperatorId && spoofedOperatorId !== user.id) {
      // Log spoof attempt to security_events table
      logger.warn(
        'SPOOF ATTEMPT DETECTED: x-operator-id header does not match authenticated user',
        {
          correlationId,
          authenticatedUserId: user.id,
          spoofedOperatorId,
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
        }
      );

      await SecurityEventLogger.logEvent({
        type: 'operator_spoof_attempt',
        userId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          authenticatedUserId: user.id,
          spoofedOperatorId,
          endpoint: req.path,
          method: req.method,
          headerIgnored: true,
          message: 'x-operator-id header was present but ignored - authority derived from JWT only',
        },
        timestamp: new Date().toISOString(),
      });

      // NOTE: We continue with the authenticated user ID, NOT the spoofed header
      // The spoof attempt is logged but does not alter the operation
    }

    logger.debug('Operator authenticated successfully', {
      correlationId,
      operatorId: user.id,
      role: user.role,
    });

    next();
  } catch (error) {
    logger.error('Operator auth error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      success: false,
      error: 'Authentication system error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Require specific roles for an operation.
 * Must be used AFTER operatorAuth middleware.
 */
export const requireOperatorRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authenticatedOperatorId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userRole = req.authenticatedUser?.role;
    // operator_override role bypasses all role checks (internal service + emergency operators)
    if (!userRole || (!allowedRoles.includes(userRole) && userRole !== 'operator_override')) {
      logger.warn('Operator role check failed', {
        operatorId: req.authenticatedOperatorId,
        userRole,
        requiredRoles: allowedRoles,
        endpoint: req.path,
      });

      SecurityEventLogger.logEvent({
        type: 'insufficient_permissions',
        userId: req.authenticatedOperatorId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          userRole,
          requiredRoles: allowedRoles,
          endpoint: req.path,
        },
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        success: false,
        error: 'Insufficient permissions for this operation',
        requiredRoles: allowedRoles,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

export default operatorAuth;

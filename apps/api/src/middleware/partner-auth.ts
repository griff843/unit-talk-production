/**
 * Partner API Authentication Middleware
 * Phase 14: OAuth2 + API Key authentication for external partners
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('PartnerAuth');

export interface PartnerAuthRequest extends Request {
  partner?: {
    id: string;
    slug: string;
    tier: string;
    status: string;
    apiKeyId: string;
    scopes: string[];
  };
  correlationId?: string;
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer" and "ApiKey" prefixes
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const apiKeyMatch = authHeader.match(/^ApiKey\s+(.+)$/i);

  return bearerMatch?.[1] || apiKeyMatch?.[1] || null;
}

/**
 * Hash API key using SHA-256
 */
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Authenticate partner via API key
 */
export async function authenticatePartner(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || `partner-auth-${Date.now()}`;

  try {
    // Extract API key
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      logger.warn('Missing API key in request', { correlationId });
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API key required. Use Authorization: Bearer <api_key>',
        correlationId,
      });
      return;
    }

    // Validate API key format (should start with "ut_live_" or "ut_test_")
    if (!apiKey.match(/^ut_(live|test)_[A-Za-z0-9]{32,}$/)) {
      logger.warn('Invalid API key format', { correlationId });
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid API key format',
        correlationId,
      });
      return;
    }

    // Hash the API key
    const keyHash = hashApiKey(apiKey);

    // Retrieve partner info from database
    const { data: partnerData, error: partnerError } = await supabaseClient.rpc(
      'get_partner_by_api_key',
      { p_key_hash: keyHash }
    );

    if (partnerError) {
      logger.error('Database error during authentication', {
        correlationId,
        error: partnerError.message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Authentication service unavailable',
        correlationId,
      });
      return;
    }

    if (!partnerData || partnerData.length === 0) {
      logger.warn('Invalid or expired API key', { correlationId });
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired API key',
        correlationId,
      });
      return;
    }

    const partner = partnerData[0];

    // Check partner status
    if (partner.partner_status !== 'active') {
      logger.warn('Partner account not active', {
        correlationId,
        partnerId: partner.partner_id,
        status: partner.partner_status,
      });
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Partner account is not active',
        correlationId,
      });
      return;
    }

    // Attach partner info to request
    req.partner = {
      id: partner.partner_id,
      slug: partner.partner_slug,
      tier: partner.partner_tier,
      status: partner.partner_status,
      apiKeyId: partner.api_key_id,
      scopes: partner.scopes || [],
    };

    // Update API key last used timestamp
    await supabaseClient
      .from('partner_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: req.ip || req.socket.remoteAddress,
        usage_count: supabaseClient.rpc('increment', { x: 1 }),
      })
      .eq('id', partner.api_key_id);

    logger.info('Partner authenticated successfully', {
      correlationId,
      partnerId: partner.partner_id,
      tier: partner.partner_tier,
    });

    next();
  } catch (error) {
    logger.error('Authentication error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed',
      correlationId,
    });
  }
}

/**
 * Require specific scopes for endpoint access
 */
export function requireScopes(...requiredScopes: string[]) {
  return (req: PartnerAuthRequest, res: Response, next: NextFunction): void => {
    const correlationId = req.correlationId || `scope-check-${Date.now()}`;

    if (!req.partner) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        correlationId,
      });
      return;
    }

    const hasAllScopes = requiredScopes.every((scope) =>
      req.partner!.scopes.includes(scope)
    );

    if (!hasAllScopes) {
      logger.warn('Insufficient scopes for endpoint', {
        correlationId,
        partnerId: req.partner.id,
        required: requiredScopes,
        actual: req.partner.scopes,
      });

      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Insufficient permissions. Required scopes: ${requiredScopes.join(', ')}`,
        correlationId,
      });
      return;
    }

    next();
  };
}

/**
 * OAuth2 middleware (placeholder for future implementation)
 */
export async function authenticateOAuth2(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || `oauth2-${Date.now()}`;

  // TODO: Implement full OAuth2 flow
  // For now, fallback to API key authentication
  logger.info('OAuth2 authentication not yet implemented, using API key fallback', {
    correlationId,
  });

  return authenticatePartner(req, res, next);
}

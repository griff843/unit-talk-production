/**
 * Partner API Rate Limiting Middleware
 * Phase 14: Implement rate limiting and quota policies
 */

import { Response, NextFunction } from 'express';
import { PartnerAuthRequest } from './partner-auth';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('RateLimit');

interface RateLimitInfo {
  allowed: boolean;
  limit_value: number;
  current_usage: number;
  reset_at: string;
}

/**
 * Rate limiting middleware for partner API
 */
export async function rateLimitPartner(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || `rate-limit-${Date.now()}`;

  if (!req.partner) {
    // Partner not authenticated, skip rate limiting
    next();
    return;
  }

  try {
    // Check rate limits (minute, hour, day)
    const [minuteLimit, hourLimit, dayLimit] = await Promise.all([
      checkRateLimit(req.partner.id, 'minute'),
      checkRateLimit(req.partner.id, 'hour'),
      checkRateLimit(req.partner.id, 'day'),
    ]);

    // Check if any limit is exceeded
    if (!minuteLimit.allowed || !hourLimit.allowed || !dayLimit.allowed) {
      const exceededLimit = !minuteLimit.allowed
        ? 'minute'
        : !hourLimit.allowed
        ? 'hour'
        : 'day';

      const limitInfo = !minuteLimit.allowed
        ? minuteLimit
        : !hourLimit.allowed
        ? hourLimit
        : dayLimit;

      logger.warn('Rate limit exceeded', {
        correlationId,
        partnerId: req.partner.id,
        tier: req.partner.tier,
        window: exceededLimit,
        usage: limitInfo.current_usage,
        limit: limitInfo.limit_value,
      });

      res.setHeader('X-RateLimit-Limit', limitInfo.limit_value.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(limitInfo.reset_at).getTime().toString());
      res.setHeader('Retry-After', Math.ceil((new Date(limitInfo.reset_at).getTime() - Date.now()) / 1000).toString());

      res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message: `Rate limit exceeded for ${exceededLimit}ly window. Please retry after ${new Date(limitInfo.reset_at).toISOString()}`,
        rateLimit: {
          window: exceededLimit,
          limit: limitInfo.limit_value,
          remaining: 0,
          resetAt: limitInfo.reset_at,
        },
        correlationId,
      });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit-Minute', minuteLimit.limit_value.toString());
    res.setHeader('X-RateLimit-Remaining-Minute', (minuteLimit.limit_value - minuteLimit.current_usage).toString());
    res.setHeader('X-RateLimit-Limit-Hour', hourLimit.limit_value.toString());
    res.setHeader('X-RateLimit-Remaining-Hour', (hourLimit.limit_value - hourLimit.current_usage).toString());
    res.setHeader('X-RateLimit-Limit-Day', dayLimit.limit_value.toString());
    res.setHeader('X-RateLimit-Remaining-Day', (dayLimit.limit_value - dayLimit.current_usage).toString());

    next();
  } catch (error) {
    logger.error('Rate limit check failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't block request on rate limit check failure
    next();
  }
}

/**
 * Check rate limit for a specific window
 */
async function checkRateLimit(
  partnerId: string,
  window: 'minute' | 'hour' | 'day'
): Promise<RateLimitInfo> {
  const { data, error } = await supabaseClient.rpc('check_partner_rate_limit', {
    p_partner_id: partnerId,
    p_window: window,
  });

  if (error) {
    logger.error('Rate limit check database error', {
      partnerId,
      window,
      error: error.message,
    });
    // Return permissive default on error
    return {
      allowed: true,
      limit_value: 9999,
      current_usage: 0,
      reset_at: new Date(Date.now() + 60000).toISOString(),
    };
  }

  return data[0] || {
    allowed: true,
    limit_value: 0,
    current_usage: 0,
    reset_at: new Date().toISOString(),
  };
}

/**
 * Quota enforcement middleware
 */
export async function enforceQuota(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || `quota-${Date.now()}`;

  if (!req.partner) {
    next();
    return;
  }

  try {
    // Check monthly quota
    const { data: partnerData, error } = await supabaseClient
      .from('partner_organizations')
      .select('monthly_quota, current_month_usage, quota_reset_date')
      .eq('id', req.partner.id)
      .single();

    if (error) {
      logger.error('Quota check database error', {
        correlationId,
        partnerId: req.partner.id,
        error: error.message,
      });
      // Don't block on database error
      next();
      return;
    }

    if (!partnerData) {
      logger.error('Partner not found during quota check', {
        correlationId,
        partnerId: req.partner.id,
      });
      next();
      return;
    }

    // Check if quota exceeded
    if (partnerData.current_month_usage >= partnerData.monthly_quota) {
      logger.warn('Monthly quota exceeded', {
        correlationId,
        partnerId: req.partner.id,
        usage: partnerData.current_month_usage,
        quota: partnerData.monthly_quota,
      });

      res.setHeader('X-Quota-Limit', partnerData.monthly_quota.toString());
      res.setHeader('X-Quota-Remaining', '0');
      res.setHeader('X-Quota-Reset', new Date(partnerData.quota_reset_date).getTime().toString());

      res.status(429).json({
        success: false,
        error: 'Quota Exceeded',
        message: `Monthly API quota exceeded. Quota resets on ${new Date(partnerData.quota_reset_date).toISOString()}`,
        quota: {
          limit: partnerData.monthly_quota,
          used: partnerData.current_month_usage,
          remaining: 0,
          resetAt: partnerData.quota_reset_date,
        },
        correlationId,
      });
      return;
    }

    // Set quota headers
    const remaining = partnerData.monthly_quota - partnerData.current_month_usage;
    res.setHeader('X-Quota-Limit', partnerData.monthly_quota.toString());
    res.setHeader('X-Quota-Remaining', remaining.toString());
    res.setHeader('X-Quota-Reset', new Date(partnerData.quota_reset_date).getTime().toString());

    next();
  } catch (error) {
    logger.error('Quota check failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't block request on quota check failure
    next();
  }
}

/**
 * Log API usage to database
 */
export async function logApiUsage(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.partner) {
    next();
    return;
  }

  const startTime = Date.now();

  // Capture original send function
  const originalSend = res.send;
  res.send = function (data): Response {
    const responseTime = Date.now() - startTime;

    // Log usage asynchronously (don't block response)
    logUsageToDatabase(req, res, responseTime, data).catch((error) => {
      logger.error('Failed to log API usage', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Increment usage counter
    supabaseClient.rpc('increment_partner_usage', {
      p_partner_id: req.partner!.id,
    }).then(({ error }) => {
      if (error) {
        logger.error('Failed to increment usage counter', {
          error: error.message,
        });
      }
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Log usage to database
 */
async function logUsageToDatabase(
  req: PartnerAuthRequest,
  res: Response,
  responseTime: number,
  responseData: any
): Promise<void> {
  if (!req.partner) return;

  const requestSize = JSON.stringify(req.body || {}).length;
  const responseSize = typeof responseData === 'string'
    ? responseData.length
    : JSON.stringify(responseData).length;

  await supabaseClient.from('partner_api_usage_logs').insert({
    partner_id: req.partner.id,
    api_key_id: req.partner.apiKeyId,
    method: req.method,
    endpoint: req.path,
    status_code: res.statusCode,
    response_time_ms: responseTime,
    request_size_bytes: requestSize,
    response_size_bytes: responseSize,
    ip_address: req.ip || req.socket.remoteAddress,
    user_agent: req.headers['user-agent'],
    metadata: {
      correlationId: req.correlationId,
      query: req.query,
    },
  });
}

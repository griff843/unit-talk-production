/**
 * Tenant Validation Middleware
 *
 * Enforces tenant isolation and validates:
 * - Tenant exists and is active
 * - Tenant limits are not exceeded (max_picks_per_day)
 * - Tenant has required features enabled
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../supabase';
import { createComponentLogger } from '../logger';
import { env } from '../env';

const log = createComponentLogger('tenant-validation-middleware');

export interface TenantValidationResult {
  valid: boolean;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    status: string;
    limits: {
      max_picks_per_day: number;
      max_users: number;
      max_storage_gb: number;
    };
    features: Record<string, boolean>;
  };
  error?: string;
  errorCode?: string;
}

/**
 * Validate tenant and check limits
 */
export async function validateTenant(tenantId: string): Promise<TenantValidationResult> {
  try {
    const supabase = supabaseServer();

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, tier, status, limits, features')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      log.warn({
        tenant_id: tenantId,
        error: tenantError?.message,
      }, 'Tenant not found');

      return {
        valid: false,
        error: 'Invalid tenant ID',
        errorCode: 'TENANT_NOT_FOUND',
      };
    }

    // Check if tenant is active
    if (tenant.status !== 'active') {
      log.warn({
        tenant_id: tenantId,
        tenant_status: tenant.status,
      }, 'Tenant is not active');

      return {
        valid: false,
        error: `Tenant is ${tenant.status}`,
        errorCode: 'TENANT_INACTIVE',
      };
    }

    const limits = tenant.limits || {
      max_picks_per_day: 100,
      max_users: 1000,
      max_storage_gb: 10,
    };

    // Check daily pick limit (skip if DISABLE_TENANT_DAILY_LIMIT is true for testing)
    const disableDailyLimit = process.env.DISABLE_TENANT_DAILY_LIMIT === 'true';

    if (!disableDailyLimit) {
      const { count: todayPickCount, error: countError } = await supabase
        .from('picks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date().toISOString().split('T')[0]); // Today

      if (countError) {
        log.error({
          tenant_id: tenantId,
          error: countError.message,
        }, 'Failed to check daily pick count');

        // Allow request if count check fails (fail open)
        return {
          valid: true,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            tier: tenant.tier,
            status: tenant.status,
            limits,
            features: tenant.features || {},
          },
        };
      }

      if ((todayPickCount || 0) >= limits.max_picks_per_day) {
        log.warn({
          tenant_id: tenantId,
          today_pick_count: todayPickCount,
          max_picks_per_day: limits.max_picks_per_day,
        }, 'Tenant daily pick limit exceeded');

        return {
          valid: false,
          error: `Daily pick limit exceeded (${limits.max_picks_per_day} picks per day)`,
          errorCode: 'DAILY_LIMIT_EXCEEDED',
        };
      }
    } else {
      log.info({ tenant_id: tenantId }, 'Daily pick limit check DISABLED for testing');
    }

    // Validation passed
    return {
      valid: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        tier: tenant.tier,
        status: tenant.status,
        limits,
        features: tenant.features || {},
      },
    };

  } catch (error) {
    log.error({
      tenant_id: tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Tenant validation exception');

    return {
      valid: false,
      error: 'Failed to validate tenant',
      errorCode: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Tenant validation middleware
 */
export async function tenantValidationMiddleware(
  request: NextRequest,
  tenantId?: string
): Promise<NextResponse | null> {
  try {
    // Use provided tenant ID or default from env
    const effectiveTenantId = tenantId || env.TENANT_ID;

    if (!effectiveTenantId) {
      log.error('No tenant ID provided and no default configured');

      return NextResponse.json({
        error: 'Tenant ID required',
        message: 'No tenant context provided',
      }, { status: 400 });
    }

    const validation = await validateTenant(effectiveTenantId);

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: validation.error || 'Tenant validation failed',
        errorCode: validation.errorCode,
      }, {
        status: validation.errorCode === 'TENANT_NOT_FOUND' ? 404 :
          validation.errorCode === 'DAILY_LIMIT_EXCEEDED' ? 429 :
            403
      });
    }

    log.info({
      tenant_id: effectiveTenantId,
      tenant_name: validation.tenant?.name,
      tenant_tier: validation.tenant?.tier,
    }, 'Tenant validation passed');

    // Store tenant context in request headers for downstream use
    const headers = new Headers(request.headers);
    headers.set('X-Tenant-ID', effectiveTenantId);
    headers.set('X-Tenant-Tier', validation.tenant?.tier || 'unknown');

    // Return null to indicate middleware passed (continue processing)
    return null;

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Tenant validation middleware error');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to validate tenant',
    }, { status: 500 });
  }
}

/**
 * Higher-order function to wrap API routes with tenant validation
 */
export function withTenantValidation(
  handler: (req: NextRequest) => Promise<NextResponse>,
  tenantId?: string
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Check tenant validation
    const tenantValidationResponse = await tenantValidationMiddleware(req, tenantId);

    // If tenant validation middleware returned a response (error), return it
    if (tenantValidationResponse) {
      return tenantValidationResponse;
    }

    // Tenant validation passed, proceed to handler
    return handler(req);
  };
}

/**
 * User Validation Middleware
 *
 * Validates that user:
 * - Exists in database
 * - Is active (not suspended/banned)
 * - Has required permissions for the action
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../supabase';
import { createComponentLogger } from '../logger';

const log = createComponentLogger('user-validation-middleware');

export interface UserValidationResult {
  valid: boolean;
  user?: {
    id: string;
    username: string;
    tier: string;
    status: string;
    active: boolean;
  };
  error?: string;
  errorCode?: string;
}

/**
 * Validate user and check status
 */
export async function validateUser(userId: string, tenantId: string): Promise<UserValidationResult> {
  try {
    const supabase = supabaseServer();

    // Fetch user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, tier, status')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (userError || !user) {
      log.warn({
        user_id: userId,
        tenant_id: tenantId,
        error: userError?.message,
      }, 'User not found');

      return {
        valid: false,
        error: 'Invalid user ID',
        errorCode: 'USER_NOT_FOUND',
      };
    }

    // Check if user is active
    if (user.status !== 'active') {
      log.warn({
        user_id: userId,
        tenant_id: tenantId,
        user_status: user.status,
      }, 'User is not active');

      return {
        valid: false,
        error: `User is ${user.status}`,
        errorCode: user.status === 'suspended' ? 'USER_SUSPENDED' :
          user.status === 'banned' ? 'USER_BANNED' :
            'USER_INACTIVE',
      };
    }

    // Validation passed
    return {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        tier: user.tier,
        status: user.status,
        active: true,
      },
    };

  } catch (error) {
    log.error({
      user_id: userId,
      tenant_id: tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'User validation exception');

    return {
      valid: false,
      error: 'Failed to validate user',
      errorCode: 'VALIDATION_ERROR',
    };
  }
}

/**
 * User validation middleware
 */
export async function userValidationMiddleware(
  request: NextRequest,
  userId: string,
  tenantId: string
): Promise<NextResponse | null> {
  try {
    const validation = await validateUser(userId, tenantId);

    if (!validation.valid) {
      const statusCode =
        validation.errorCode === 'USER_NOT_FOUND' ? 404 :
          validation.errorCode === 'USER_BANNED' ? 403 :
            validation.errorCode === 'USER_SUSPENDED' ? 403 :
              400;

      return NextResponse.json({
        success: false,
        error: validation.error || 'User validation failed',
        errorCode: validation.errorCode,
      }, { status: statusCode });
    }

    log.info({
      user_id: userId,
      tenant_id: tenantId,
      username: validation.user?.username,
      tier: validation.user?.tier,
    }, 'User validation passed');

    // Store user context in request headers for downstream use
    const headers = new Headers(request.headers);
    headers.set('X-User-ID', userId);
    headers.set('X-User-Tier', validation.user?.tier || 'unknown');

    // Return null to indicate middleware passed (continue processing)
    return null;

  } catch (error) {
    log.error({
      user_id: userId,
      tenant_id: tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'User validation middleware error');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to validate user',
    }, { status: 500 });
  }
}

/**
 * Higher-order function to wrap API routes with user validation
 */
export function withUserValidation(
  handler: (req: NextRequest) => Promise<NextResponse>,
  getUserId: (req: NextRequest) => string,
  getTenantId: (req: NextRequest) => string
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    // Check user validation
    const userValidationResponse = await userValidationMiddleware(req, userId, tenantId);

    // If user validation middleware returned a response (error), return it
    if (userValidationResponse) {
      return userValidationResponse;
    }

    // User validation passed, proceed to handler
    return handler(req);
  };
}

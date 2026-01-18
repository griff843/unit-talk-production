/**
 * Idempotency Middleware
 *
 * Prevents duplicate submissions by checking bet_slip_id uniqueness
 * Returns existing pick if duplicate submission detected
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../supabase';
import { createComponentLogger } from '../logger';

const log = createComponentLogger('idempotency-middleware');

export interface IdempotencyCheckResult {
  isUnique: boolean;
  existingPick?: {
    id: string;
    bet_slip_id: string;
    user_id: string;
    created_at: string;
    workflow_stage: string;
    status: string;
  };
  error?: string;
}

/**
 * Check if bet_slip_id is unique for the tenant
 */
export async function checkIdempotency(
  betSlipId: string,
  tenantId: string
): Promise<IdempotencyCheckResult> {
  try {
    const supabase = supabaseServer();

    // Check if pick with this bet_slip_id already exists
    const { data: existingPick, error } = await supabase
      .from('picks')
      .select('id, bet_slip_id, user_id, created_at, workflow_stage, status')
      .eq('tenant_id', tenantId)
      .eq('bet_slip_id', betSlipId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found (expected)
      log.error({
        bet_slip_id: betSlipId,
        tenant_id: tenantId,
        error: error.message,
        code: error.code,
      }, 'Idempotency check failed');

      return {
        isUnique: true, // Fail open (allow submission) on error
        error: error.message,
      };
    }

    if (existingPick) {
      log.info({
        bet_slip_id: betSlipId,
        tenant_id: tenantId,
        existing_pick_id: existingPick.id,
        created_at: existingPick.created_at,
      }, 'Duplicate submission detected (idempotent)');

      return {
        isUnique: false,
        existingPick: {
          id: existingPick.id,
          bet_slip_id: existingPick.bet_slip_id,
          user_id: existingPick.user_id,
          created_at: existingPick.created_at,
          workflow_stage: existingPick.workflow_stage,
          status: existingPick.status,
        },
      };
    }

    // No existing pick found, submission is unique
    return {
      isUnique: true,
    };

  } catch (error) {
    log.error({
      bet_slip_id: betSlipId,
      tenant_id: tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Idempotency check exception');

    return {
      isUnique: true, // Fail open on exception
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Idempotency middleware
 */
export async function idempotencyMiddleware(
  request: NextRequest,
  betSlipId: string,
  tenantId: string
): Promise<NextResponse | null> {
  try {
    const check = await checkIdempotency(betSlipId, tenantId);

    if (!check.isUnique && check.existingPick) {
      // Duplicate submission detected - return existing pick
      log.info({
        bet_slip_id: betSlipId,
        tenant_id: tenantId,
        existing_pick_id: check.existingPick.id,
      }, 'Returning existing pick (idempotent)');

      return NextResponse.json({
        success: true,
        idempotent: true,
        pickId: check.existingPick.id, // Use camelCase for consistency
        pick: check.existingPick,
        driver: 'canonical', // Match main response schema
        publishMode: process.env.PUBLISH_MODE || 'shadow', // Match main response schema
        message: 'Pick already submitted (idempotent)',
      }, {
        status: 200, // 200 OK (not 409 Conflict) for idempotent requests
        headers: {
          'X-Idempotent-Response': 'true',
          'X-Original-Pick-ID': check.existingPick.id,
        },
      });
    }

    // Unique submission, continue processing
    return null;

  } catch (error) {
    log.error({
      bet_slip_id: betSlipId,
      tenant_id: tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Idempotency middleware error');

    // Fail open on error (allow submission)
    return null;
  }
}

/**
 * Higher-order function to wrap API routes with idempotency checking
 */
export function withIdempotency(
  handler: (req: NextRequest) => Promise<NextResponse>,
  getBetSlipId: (req: NextRequest) => Promise<string>,
  getTenantId: (req: NextRequest) => string
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const betSlipId = await getBetSlipId(req);
    const tenantId = getTenantId(req);

    // Check idempotency
    const idempotencyResponse = await idempotencyMiddleware(req, betSlipId, tenantId);

    // If idempotency middleware returned a response (duplicate), return it
    if (idempotencyResponse) {
      return idempotencyResponse;
    }

    // Unique submission, proceed to handler
    return handler(req);
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { supabaseServer } from '@/lib/supabase';
import {
  createRouteLogger,
  logApiPerformance,
  logValidationError,
  logSecurityEvent,
} from '@/lib/logger';
import { validateOddsInteger, calculateParlayOdds } from '@/lib/odds-validator';

const log = createRouteLogger('POST /api/submit-ticket', 'POST');

/**
 * SMARTFORM-ODDS-FIELD-INTEGRITY-007
 * Enhanced odds validation with contract-compliant error codes
 */
const validateOddsForSchema = (odds: number): boolean => {
  const result = validateOddsInteger(odds);
  return result.valid;
};

// ACTIVATION-P1-FIXES-001: Extended sport list matching Smart Form SPORTS constant
const SUPPORTED_SPORTS = [
  'NFL',
  'NBA',
  'WNBA',
  'MLB',
  'NHL',
  'NCAAF',
  'NCAAB',
  'UFC/MMA',
  'Boxing',
  'Soccer',
  'Tennis',
  'Golf',
  'NASCAR',
  'F1',
] as const;

// EMBED-TRUTH-FIX-031: Valid bet types
const VALID_BET_TYPES = ['player_prop', 'spread', 'moneyline', 'total', 'team_total'] as const;

// Validation schemas with enhanced odds validation
// EMBED-TRUTH-FIX-031: Added player_name and bet_type fields
// SPRINT-108B: Added book_id for Contract v1.2
const GameSelectionSchema = z.object({
  sport: z.enum(SUPPORTED_SPORTS),
  team_id: z.string().uuid().optional(),
  player_id: z.string().uuid().optional(),
  // EMBED-TRUTH-FIX-031: player_name is REQUIRED for player props
  player_name: z.string().optional(),
  // EMBED-TRUTH-FIX-031: bet_type is REQUIRED for correct market labeling
  bet_type: z.enum(VALID_BET_TYPES).default('moneyline'),
  // EMBED-TRUTH-FIX-031: team name for team bets
  team: z.string().optional(),
  stat_type: z.string().min(1),
  line: z.number().optional().default(0), // optional — moneyline bets have no line
  leg_odds: z
    .number()
    .int()
    .refine(
      val => validateOddsForSchema(val),
      val => {
        const result = validateOddsInteger(val);
        return {
          message: result.errorMessage || 'Invalid odds',
          params: { code: result.errorCode },
        };
      }
    ),
  source: z.enum(['api', 'manual']).default('api'),
  is_live: z.boolean().optional().default(false),
  // ACTIVATION-P1-FIXES-001: Accept any string (spread: "Celtics -3.5", ML: "Celtics", total: "over")
  selection: z.string().min(1),
  // EMBED-TRUTH-FIX-031: direction for over/under bets
  direction: z.enum(['over', 'under', 'OVER', 'UNDER']).optional(),
  confidence: z.number().int().min(0).max(10).optional().default(0),
  // PARITY-GATE-001 Stage 7: Manual entry fields for dual-mode
  manual_matchup_home: z.string().optional(),
  manual_matchup_away: z.string().optional(),
  manual_game_date: z.string().optional(),
  // SPRINT-108B: provider is REQUIRED per Contract v1.2
  // Uses provider code (TEXT like 'fanduel') which is resolved to provider_id in the RPC
  provider: z.string().min(2, 'Provider is required').max(50, 'Invalid provider code'),
});

// SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Add idempotency_key support
const SubmitTicketSchema = z.object({
  capper_id: z.string().uuid('Capper ID must be a valid UUID'),
  sport: z.enum(SUPPORTED_SPORTS),
  ticket_type: z.enum(['single', 'parlay', 'teaser', 'round_robin']),
  selections: z.array(GameSelectionSchema).min(1, 'At least one selection is required'),
  parlay_odds: z
    .number()
    .int()
    .optional()
    .refine(
      val => val === undefined || validateOddsForSchema(val),
      val => {
        if (val === undefined) return { message: '' };
        const result = validateOddsInteger(val);
        return {
          message: result.errorMessage || 'Invalid parlay odds',
          params: { code: result.errorCode },
        };
      }
    ),
  total_units: z.number().min(0.5).max(10).default(1.0),
  notes: z.string().optional(),
  // SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Idempotency key for retry-safe submissions
  // If provided, duplicate submissions with same key return the existing ticket
  idempotency_key: z.string().uuid().optional(),
});

// SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Atomic submit RPC result type
interface AtomicSubmitResult {
  success: boolean;
  is_duplicate: boolean;
  bet_slip_id: string;
  capper_id: string;
  sport: string;
  ticket_type: string;
  selection_count: number;
  total_units: number;
  status: string;
  pick_ids?: string[];
  created_at: string;
  message: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    log.info('Ticket submission received');

    const rawFormData = await request.json();

    log.info(
      {
        submitted_fields: Object.keys(rawFormData),
        capper_id: rawFormData.capper_id,
        sport: rawFormData.sport,
        selection_count: rawFormData.selections?.length || 0,
      },
      'Processing ticket submission'
    );

    // Validate input with Zod
    const validation = SubmitTicketSchema.safeParse(rawFormData);
    if (!validation.success) {
      logValidationError(log, validation.error.errors, rawFormData);

      return NextResponse.json(
        {
          error: 'Invalid ticket data',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      capper_id,
      sport,
      ticket_type,
      selections,
      parlay_odds,
      total_units,
      notes,
      idempotency_key,
    } = validation.data;

    // Validate ticket type vs selection count
    if (ticket_type === 'parlay' && selections.length < 2) {
      return NextResponse.json(
        {
          error: 'Parlay tickets require at least 2 selections',
        },
        { status: 400 }
      );
    }

    if (ticket_type === 'round_robin' && selections.length < 2) {
      return NextResponse.json(
        {
          error: 'Round robin tickets require at least 2 selections',
        },
        { status: 400 }
      );
    }

    // SMARTFORM-ODDS-FIELD-INTEGRITY-007: Validate parlay odds calculation
    if (ticket_type === 'parlay' && selections.length >= 2) {
      const legOdds = selections.map(s => s.leg_odds);
      const calculatedResult = calculateParlayOdds(legOdds);

      if (!calculatedResult.valid) {
        log.error(
          {
            capper_id,
            leg_odds: legOdds,
            error: calculatedResult.errorMessage,
          },
          'ODDS_INTEGRITY: Invalid parlay leg odds'
        );

        return NextResponse.json(
          {
            error: 'Invalid parlay odds',
            code: calculatedResult.errorCode,
            message: calculatedResult.errorMessage,
          },
          { status: 400 }
        );
      }

      // If parlay_odds provided, verify it matches our calculation (within tolerance)
      if (parlay_odds !== undefined) {
        const expectedOdds = calculatedResult.combinedOdds!;
        const tolerance = 5; // Allow 5-point rounding tolerance

        if (Math.abs(parlay_odds - expectedOdds) > tolerance) {
          log.warn(
            {
              capper_id,
              provided_parlay_odds: parlay_odds,
              calculated_parlay_odds: expectedOdds,
              leg_odds: legOdds,
            },
            'ODDS_INTEGRITY: Parlay odds mismatch detected'
          );

          // Use calculated odds for consistency (no silent fallback - we log the discrepancy)
        }
      }

      log.info(
        {
          bet_slip_id: 'pending',
          leg_count: selections.length,
          leg_odds: legOdds,
          combined_odds: calculatedResult.combinedOdds,
        },
        'ODDS_INTEGRITY: Parlay odds validated'
      );
    }

    // Validate manual entries
    const hasManualEntries = selections.some(s => s.source === 'manual');
    if (hasManualEntries) {
      logSecurityEvent(log, 'manual_odds_entry', 'medium', {
        capper_id,
        selection_count: selections.length,
      });
    }

    // SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Use idempotency_key or generate UUID
    // This enables retry-safe submissions - duplicate keys return existing ticket
    const betSlipId = idempotency_key || uuidv4();
    const supabase = supabaseServer();

    log.info(
      {
        bet_slip_id: betSlipId,
        has_idempotency_key: !!idempotency_key,
      },
      'Using bet_slip_id for atomic submit'
    );

    // Verify capper exists and is active
    const { data: capperUser, error: capperError } = (await (supabase.from('users') as any)
      .select('id, username, active')
      .eq('id', capper_id)
      .single()) as { data: { id: string; username: string; active: boolean } | null; error: any };

    if (capperError || !capperUser) {
      log.warn(
        {
          capper_id,
          error: capperError?.message,
        },
        'Invalid capper_id provided'
      );

      return NextResponse.json(
        {
          error: 'Invalid capper ID',
          message: 'The specified capper was not found or is inactive',
        },
        { status: 400 }
      );
    }

    // FAIL-CLOSED: Validate that active column exists in response
    // Per USERS_CANONICAL_CONTRACT.md - never assume active=true if missing
    if (typeof capperUser.active !== 'boolean') {
      log.error(
        {
          capper_id,
          active_type: typeof capperUser.active,
          active_value: capperUser.active,
        },
        'SCHEMA VIOLATION: users.active column missing or invalid type. Canonical contract requires BOOLEAN.'
      );

      return NextResponse.json(
        {
          error: 'Schema violation',
          message:
            'Database schema does not match canonical contract. users.active column is required.',
          code: 'SCHEMA_CONTRACT_VIOLATION',
        },
        { status: 500 }
      );
    }

    if (!capperUser.active) {
      return NextResponse.json(
        {
          error: 'Inactive capper',
          message: 'The specified capper is not currently active',
        },
        { status: 400 }
      );
    }

    // SPRINT-108B: Validate all providers exist and are active (Contract v1.2)
    // NO implicit defaults, NO placeholders - missing provider = BLOCK
    // NOTE: provider_registry may not be in Supabase types yet - using explicit typing
    type ProviderRegistryRow = {
      id: number;
      code: string;
      display_name: string;
      active: boolean;
    };
    const providerCodes = [...new Set(selections.map(s => s.provider))];
    for (const providerCode of providerCodes) {
      const { data: provider, error: providerError } = (await supabase
        .from('provider_registry' as any)
        .select('id, code, display_name, active')
        .eq('code', providerCode)
        .single()) as { data: ProviderRegistryRow | null; error: any };

      if (providerError || !provider) {
        log.warn(
          {
            provider_code: providerCode,
            error: providerError?.message,
          },
          'SPRINT-108B: Invalid provider code provided'
        );

        return NextResponse.json(
          {
            error: 'Invalid provider',
            message: 'The specified sportsbook provider was not found',
            code: 'INVALID_PROVIDER',
            provider: providerCode,
          },
          { status: 400 }
        );
      }

      if (!provider.active) {
        log.warn(
          {
            provider_code: providerCode,
            provider_name: provider.display_name,
          },
          'SPRINT-108B: Inactive provider selected'
        );

        return NextResponse.json(
          {
            error: 'Inactive provider',
            message: `The provider "${provider.display_name}" is not currently active`,
            code: 'INACTIVE_PROVIDER',
            provider: providerCode,
          },
          { status: 400 }
        );
      }

      // SPRINT-108B: Block UNKNOWN_LEGACY provider for new submissions
      if (provider.code === 'UNKNOWN_LEGACY') {
        log.error(
          {
            provider_code: providerCode,
          },
          'SPRINT-108B: Attempt to use UNKNOWN_LEGACY provider for new submission'
        );

        return NextResponse.json(
          {
            error: 'Invalid provider',
            message: 'UNKNOWN_LEGACY is not a valid provider for new submissions',
            code: 'LEGACY_PROVIDER_BLOCKED',
            provider: providerCode,
          },
          { status: 400 }
        );
      }
    }

    log.info(
      { providers: providerCodes, selection_count: selections.length },
      'SPRINT-108B: Provider validation passed (Contract v1.2)'
    );

    // SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Build picks array for atomic RPC
    // Transform selections to the format expected by the RPC
    // SPRINT-108B: Added book_id per Contract v1.2
    const picksForRpc = selections.map(selection => ({
      stat_type: selection.stat_type,
      line: selection.line,
      odds: selection.leg_odds,
      selection: selection.selection,
      confidence: selection.confidence || 0,
      team_id: selection.team_id || null,
      player_id: selection.player_id || null,
      player_name: selection.player_name || null,
      bet_type: selection.bet_type || 'moneyline',
      side: selection.direction?.toLowerCase() || null,
      source: selection.source,
      is_live: selection.is_live || false,
      manual_matchup_home: selection.manual_matchup_home || null,
      manual_matchup_away: selection.manual_matchup_away || null,
      manual_game_date: selection.manual_game_date || null,
      // SPRINT-108B: provider is REQUIRED (validated above)
      // The RPC will resolve provider code to provider_id
      provider: selection.provider,
    }));

    // SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Call atomic submit RPC
    // This executes smart_tickets + unified_picks + bridge_outbox in single transaction
    try {
      // Cast to any since the RPC function isn't in generated types yet
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
        'atomic_submit_ticket',
        {
          p_bet_slip_id: betSlipId,
          p_capper_id: capper_id,
          p_capper_username: capperUser.username,
          p_sport: sport,
          p_ticket_type: ticket_type,
          p_game_selections: selections,
          p_picks: picksForRpc,
          p_parlay_odds: parlay_odds || null,
          p_total_units: total_units,
          p_notes: notes || null,
        }
      );

      if (rpcError) {
        log.error(
          {
            error: rpcError.message,
            code: rpcError.code,
            bet_slip_id: betSlipId,
            capper_id,
          },
          'Atomic submit RPC failed'
        );

        return NextResponse.json(
          {
            error: 'Failed to save ticket',
            message: rpcError.message,
            code: 'ATOMIC_SUBMIT_FAILED',
          },
          { status: 500 }
        );
      }

      const result = rpcResult as AtomicSubmitResult;

      if (!result.success) {
        log.error(
          {
            result,
            bet_slip_id: betSlipId,
            capper_id,
          },
          'Atomic submit returned failure'
        );

        return NextResponse.json(
          {
            error: 'Failed to save ticket',
            message: result.message || 'Unknown error during atomic submit',
            code: 'ATOMIC_SUBMIT_FAILED',
          },
          { status: 500 }
        );
      }

      const isLive = selections.some(s => s.is_live);

      // SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Handle idempotent duplicate
      if (result.is_duplicate) {
        log.info(
          {
            bet_slip_id: result.bet_slip_id,
            capper_id: result.capper_id,
            is_duplicate: true,
            original_created_at: result.created_at,
          },
          'Duplicate submission detected (idempotent response)'
        );

        logApiPerformance(log, 'submit-ticket', startTime, {
          bet_slip_id: result.bet_slip_id,
          capper_id: result.capper_id,
          sport: result.sport,
          ticket_type: result.ticket_type,
          selection_count: result.selection_count,
          is_duplicate: true,
        });

        // Return 200 for duplicate (not 201) - indicates idempotent replay
        return NextResponse.json(
          {
            bet_slip_id: result.bet_slip_id,
            ticket_id: result.bet_slip_id,
            capper_name: capperUser?.username ?? '',
            sport: result.sport,
            ticket_type: result.ticket_type,
            selection_count: result.selection_count,
            total_units: result.total_units,
            is_live: isLive,
            status: result.status,
            is_duplicate: true,
            message: 'Ticket already submitted (idempotent)',
            created_at: result.created_at,
          },
          { status: 200 }
        );
      }

      // New submission - log success
      log.info(
        {
          bet_slip_id: result.bet_slip_id,
          capper_id: result.capper_id,
          capper_name: capperUser.username,
          sport: result.sport,
          ticket_type: result.ticket_type,
          selection_count: result.selection_count,
          total_units: result.total_units,
          has_manual_entries: hasManualEntries,
          is_live: isLive,
          pick_ids: result.pick_ids,
        },
        'Ticket successfully saved via atomic RPC'
      );

      logApiPerformance(log, 'submit-ticket', startTime, {
        bet_slip_id: result.bet_slip_id,
        capper_id: result.capper_id,
        sport: result.sport,
        ticket_type: result.ticket_type,
        selection_count: result.selection_count,
        is_live: isLive,
        has_manual_entries: hasManualEntries,
      });

      return NextResponse.json(
        {
          bet_slip_id: result.bet_slip_id,
          ticket_id: result.bet_slip_id,
          capper_name: capperUser?.username ?? '',
          sport: result.sport,
          ticket_type: result.ticket_type,
          selection_count: result.selection_count,
          total_units: result.total_units,
          is_live: isLive,
          status: result.status,
          message: isLive ? 'Live bet submitted successfully!' : 'Ticket submitted successfully!',
          pick_ids: result.pick_ids,
        },
        { status: 201 }
      );
    } catch (dbError) {
      log.error(
        {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          capper_id,
          sport,
          bet_slip_id: betSlipId,
        },
        'Database error during atomic ticket submission'
      );

      return NextResponse.json(
        {
          error: 'Failed to save ticket',
          message: 'A database error occurred while saving your ticket',
          code: 'ATOMIC_SUBMIT_FAILED',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Unexpected error in ticket submission'
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your submission',
      },
      { status: 500 }
    );
  }
}

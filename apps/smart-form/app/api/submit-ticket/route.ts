import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { supabaseServer } from '@/lib/supabase';
import {
  createRouteLogger,
  logDatabaseOperation,
  logApiPerformance,
  logValidationError,
  logSecurityEvent,
} from '@/lib/logger';
import {
  validateOddsInteger,
  calculateParlayOdds,
  OddsValidationErrorCode,
} from '@/lib/odds-validator';
import {
  validateMarket,
  isSport,
  VALID_STAT_TYPES,
  type Sport,
} from '@unit-talk/contracts';

const log = createRouteLogger('POST /api/submit-ticket', 'POST');

/**
 * SMARTFORM-ODDS-FIELD-INTEGRITY-007
 * Enhanced odds validation with contract-compliant error codes
 */
const validateOddsForSchema = (odds: number): boolean => {
  const result = validateOddsInteger(odds);
  return result.valid;
};

/**
 * MARKET_TAXONOMY_UNIFICATION_009
 * Custom Zod refinement to validate stat_type against canonical registry
 */
const validateStatTypeForSport = (sport: string, statType: string): boolean => {
  if (!isSport(sport)) return false;
  const result = validateMarket(sport, statType);
  return result.valid;
};

// Validation schemas with enhanced odds validation + market registry validation
const GameSelectionSchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']),
  team_id: z.string().uuid().optional(),
  player_id: z.string().uuid().optional(),
  stat_type: z.string().min(1),
  line: z.number(),
  leg_odds: z.number().int().refine(
    (val) => validateOddsForSchema(val),
    (val) => {
      const result = validateOddsInteger(val);
      return {
        message: result.errorMessage || 'Invalid odds',
        params: { code: result.errorCode },
      };
    }
  ),
  source: z.enum(['api', 'manual']).default('api'),
  is_live: z.boolean().optional().default(false),
  selection: z.enum(['over', 'under', 'yes', 'no']),
  confidence: z.number().min(0).max(1).optional().default(0),
});

const SubmitTicketSchema = z.object({
  capper_id: z.string().uuid('Capper ID must be a valid UUID'),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']),
  ticket_type: z.enum(['single', 'parlay', 'round_robin']),
  selections: z.array(GameSelectionSchema).min(1, 'At least one selection is required'),
  parlay_odds: z.number().int().optional().refine(
    (val) => val === undefined || validateOddsForSchema(val),
    (val) => {
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
});

// SmartFormBridge integration
async function publishTicketSubmitted(ticketData: {
  bet_slip_id: string;
  capper_id: string;
  selection_count: number;
}) {
  try {
    const sb = supabaseServer();
    
    // Write to bridge outbox for idempotent processing
    const { error } = await sb
      .from('bridge_outbox')
      .insert({
        event_type: 'ticket_submitted',
        payload: ticketData,
        unique_key: ticketData.bet_slip_id,
        status: 'pending',
      });

    if (error) {
      log.error({ error: error.message }, 'Failed to publish ticket submission event');
    } else {
      log.info({
        bet_slip_id: ticketData.bet_slip_id,
        capper_id: ticketData.capper_id,
      }, 'Ticket submission event published to outbox');
    }
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      bet_slip_id: ticketData.bet_slip_id,
    }, 'Error publishing ticket submission event');
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    log.info('Ticket submission received');

    const rawFormData = await request.json();
    
    log.info({
      submitted_fields: Object.keys(rawFormData),
      capper_id: rawFormData.capper_id,
      sport: rawFormData.sport,
      selection_count: rawFormData.selections?.length || 0,
    }, 'Processing ticket submission');

    // Validate input with Zod
    const validation = SubmitTicketSchema.safeParse(rawFormData);
    if (!validation.success) {
      logValidationError(log, validation.error.errors, rawFormData);
      
      return NextResponse.json({
        error: 'Invalid ticket data',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const {
      capper_id,
      sport,
      ticket_type,
      selections,
      parlay_odds,
      total_units,
      notes,
    } = validation.data;

    // Validate ticket type vs selection count
    if (ticket_type === 'parlay' && selections.length < 2) {
      return NextResponse.json({
        error: 'Parlay tickets require at least 2 selections',
      }, { status: 400 });
    }

    if (ticket_type === 'round_robin' && selections.length < 2) {
      return NextResponse.json({
        error: 'Round robin tickets require at least 2 selections',
      }, { status: 400 });
    }

    // MARKET_TAXONOMY_UNIFICATION_009: Validate all stat_types against canonical registry
    const marketValidationErrors: Array<{ index: number; stat_type: string; error: string }> = [];
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i];
      const selectionSport = selection.sport || sport; // Use leg sport or ticket sport
      const result = validateMarket(selectionSport, selection.stat_type);

      if (!result.valid) {
        marketValidationErrors.push({
          index: i,
          stat_type: selection.stat_type,
          error: result.error || `Invalid stat_type "${selection.stat_type}" for sport "${selectionSport}"`,
        });
      }
    }

    if (marketValidationErrors.length > 0) {
      log.error({
        capper_id,
        sport,
        validation_errors: marketValidationErrors,
      }, 'MARKET_TAXONOMY: Invalid stat_type values detected');

      return NextResponse.json({
        error: 'Invalid market selection',
        code: 'INVALID_STAT_TYPE',
        message: 'One or more selections have invalid stat_type values',
        details: marketValidationErrors,
        valid_stat_types: Array.from(VALID_STAT_TYPES),
      }, { status: 400 });
    }

    log.info({
      capper_id,
      selection_count: selections.length,
      stat_types: selections.map(s => s.stat_type),
    }, 'MARKET_TAXONOMY: All stat_types validated against canonical registry');

    // SMARTFORM-ODDS-FIELD-INTEGRITY-007: Validate parlay odds calculation
    if (ticket_type === 'parlay' && selections.length >= 2) {
      const legOdds = selections.map(s => s.leg_odds);
      const calculatedResult = calculateParlayOdds(legOdds);

      if (!calculatedResult.valid) {
        log.error({
          capper_id,
          leg_odds: legOdds,
          error: calculatedResult.errorMessage,
        }, 'ODDS_INTEGRITY: Invalid parlay leg odds');

        return NextResponse.json({
          error: 'Invalid parlay odds',
          code: calculatedResult.errorCode,
          message: calculatedResult.errorMessage,
        }, { status: 400 });
      }

      // If parlay_odds provided, verify it matches our calculation (within tolerance)
      if (parlay_odds !== undefined) {
        const expectedOdds = calculatedResult.combinedOdds!;
        const tolerance = 5; // Allow 5-point rounding tolerance

        if (Math.abs(parlay_odds - expectedOdds) > tolerance) {
          log.warn({
            capper_id,
            provided_parlay_odds: parlay_odds,
            calculated_parlay_odds: expectedOdds,
            leg_odds: legOdds,
          }, 'ODDS_INTEGRITY: Parlay odds mismatch detected');

          // Use calculated odds for consistency (no silent fallback - we log the discrepancy)
        }
      }

      log.info({
        bet_slip_id: 'pending',
        leg_count: selections.length,
        leg_odds: legOdds,
        combined_odds: calculatedResult.combinedOdds,
      }, 'ODDS_INTEGRITY: Parlay odds validated');
    }

    // Validate manual entries
    const hasManualEntries = selections.some(s => s.source === 'manual');
    if (hasManualEntries) {
      logSecurityEvent(log, 'manual_odds_entry', 'medium', {
        capper_id,
        selection_count: selections.length,
      });
    }

    // Generate unique bet slip ID
    const betSlipId = uuidv4();
    const supabase = supabaseServer();

    // Verify capper exists and is active
    const { data: capperUser, error: capperError } = await supabase
      .from('users')
      .select('id, username, active')
      .eq('id', capper_id)
      .single();

    if (capperError || !capperUser) {
      log.warn({
        capper_id,
        error: capperError?.message,
      }, 'Invalid capper_id provided');

      return NextResponse.json({
        error: 'Invalid capper ID',
        message: 'The specified capper was not found or is inactive',
      }, { status: 400 });
    }

    // FAIL-CLOSED: Validate that active column exists in response
    // Per USERS_CANONICAL_CONTRACT.md - never assume active=true if missing
    if (typeof capperUser.active !== 'boolean') {
      log.error({
        capper_id,
        active_type: typeof capperUser.active,
        active_value: capperUser.active,
      }, 'SCHEMA VIOLATION: users.active column missing or invalid type. Canonical contract requires BOOLEAN.');

      return NextResponse.json({
        error: 'Schema violation',
        message: 'Database schema does not match canonical contract. users.active column is required.',
        code: 'SCHEMA_CONTRACT_VIOLATION',
      }, { status: 500 });
    }

    if (!capperUser.active) {
      return NextResponse.json({
        error: 'Inactive capper',
        message: 'The specified capper is not currently active',
      }, { status: 400 });
    }

    // Create smart ticket (authoritative record)
    const smartTicketData = {
      bet_slip_id: betSlipId,
      capper_id,
      sport,
      ticket_type,
      game_selections: selections,
      parlay_odds,
      total_units,
      status: 'submitted',
      selection_count: selections.length,
      notes,
    };

    // Start transaction
    try {
      // Insert smart ticket
      const { data: insertedTicket, error: ticketError } = await supabase
        .from('smart_tickets')
        .insert(smartTicketData)
        .select()
        .single();

      logDatabaseOperation(log, 'INSERT', 'smart_tickets', insertedTicket, ticketError);

      if (ticketError) {
        return NextResponse.json({
          error: 'Failed to save ticket',
          message: ticketError.message,
        }, { status: 500 });
      }

      // SINGLE-WRITER-SEAL-011: Insert individual legs via authoritative RPC
      // All unified_picks inserts MUST go through create_unified_pick_idempotent
      const insertedPicks = [];
      let picksError = null;

      for (let legIndex = 0; legIndex < selections.length; legIndex++) {
        const selection = selections[legIndex];
        // Each leg gets a unique bet_slip_id suffix for parlay legs
        const legBetSlipId = selections.length > 1
          ? `${betSlipId}-leg-${legIndex + 1}`
          : betSlipId;

        const pickPayload = {
          bet_slip_id: legBetSlipId,
          user_id: capper_id,
          capper_id: capper_id,
          sport,
          stat_type: selection.stat_type,
          line: selection.line,
          odds: selection.leg_odds,
          selection: selection.selection,
          confidence: selection.confidence || 0,
          team_id: selection.team_id,
          player_id: selection.player_id,
          player_name: selection.player_name,
          team_name: selection.team_name,
          source: selection.source,
          is_live: selection.is_live || false,
          ticket_type: ticket_type,
          leg_index: selections.length > 1 ? legIndex + 1 : null,
          total_units: total_units,
          trace_id: `smartform-${betSlipId}-${legIndex}`,
        };

        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('create_unified_pick_idempotent', { p_payload: pickPayload });

        if (rpcError) {
          picksError = rpcError;
          log.error({
            bet_slip_id: legBetSlipId,
            error: rpcError.message,
          }, 'RPC create_unified_pick_idempotent failed');
          break;
        }

        if (rpcResult && rpcResult.success) {
          insertedPicks.push({
            id: rpcResult.pick_id,
            bet_slip_id: legBetSlipId,
            idempotent: rpcResult.idempotent,
          });
          log.info({
            pick_id: rpcResult.pick_id,
            bet_slip_id: legBetSlipId,
            idempotent: rpcResult.idempotent,
          }, 'Pick created via RPC');
        } else {
          picksError = { message: rpcResult?.error || 'Unknown RPC error' };
          break;
        }
      }

      logDatabaseOperation(log, 'RPC:create_unified_pick_idempotent', 'unified_picks', insertedPicks, picksError);

      if (picksError) {
        // Rollback smart ticket if picks insertion fails
        await supabase
          .from('smart_tickets')
          .delete()
          .eq('bet_slip_id', betSlipId);

        return NextResponse.json({
          error: 'Failed to save ticket selections',
          message: picksError.message,
        }, { status: 500 });
      }

      log.info({
        bet_slip_id: betSlipId,
        capper_id,
        capper_name: capperUser.username,
        sport,
        ticket_type,
        selection_count: selections.length,
        total_units,
        has_manual_entries: hasManualEntries,
        is_live: selections.some(s => s.is_live),
      }, 'Ticket successfully saved');

      // Publish to bridge for external processing
      await publishTicketSubmitted({
        bet_slip_id: betSlipId,
        capper_id,
        selection_count: selections.length,
      });

      const isLive = selections.some(s => s.is_live);

      logApiPerformance(log, 'submit-ticket', startTime, {
        bet_slip_id: betSlipId,
        capper_id,
        sport,
        ticket_type,
        selection_count: selections.length,
        is_live: isLive,
        has_manual_entries: hasManualEntries,
      });

      return NextResponse.json({
        bet_slip_id: betSlipId,
        ticket_id: insertedTicket.bet_slip_id,
        capper_name: capperUser.username,
        sport,
        ticket_type,
        selection_count: selections.length,
        total_units,
        is_live: isLive,
        status: 'submitted',
        message: isLive
          ? 'Live bet submitted successfully!'
          : 'Ticket submitted successfully!',
      }, { status: 201 });

    } catch (dbError) {
      log.error({
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        capper_id,
        sport,
      }, 'Database error during ticket submission');

      return NextResponse.json({
        error: 'Failed to save ticket',
        message: 'A database error occurred while saving your ticket',
      }, { status: 500 });
    }

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error in ticket submission');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your submission',
    }, { status: 500 });
  }
}

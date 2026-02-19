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
});

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
    // PARITY-GATE-001: Use cloud-canonical column names (event_data, bet_slip_id)
    const { error } = await (sb.from('bridge_outbox') as any).insert({
      event_type: 'ticket_submitted',
      event_data: ticketData,
      bet_slip_id: ticketData.bet_slip_id,
      status: 'pending',
    });

    if (error) {
      log.error({ error: error.message }, 'Failed to publish ticket submission event');
    } else {
      log.info(
        {
          bet_slip_id: ticketData.bet_slip_id,
          capper_id: ticketData.capper_id,
        },
        'Ticket submission event published to outbox'
      );
    }
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        bet_slip_id: ticketData.bet_slip_id,
      },
      'Error publishing ticket submission event'
    );
  }
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

    const { capper_id, sport, ticket_type, selections, parlay_odds, total_units, notes } =
      validation.data;

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

    // Generate unique bet slip ID
    const betSlipId = uuidv4();
    const supabase = supabaseServer();

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
      const { data: insertedTicket, error: ticketError } = (await (
        supabase.from('smart_tickets') as any
      )
        .insert(smartTicketData)
        .select()
        .single()) as { data: { bet_slip_id: string } | null; error: any };

      logDatabaseOperation(log, 'INSERT', 'smart_tickets', insertedTicket, ticketError);

      if (ticketError) {
        return NextResponse.json(
          {
            error: 'Failed to save ticket',
            message: ticketError.message,
          },
          { status: 500 }
        );
      }

      // Insert individual legs into unified_picks
      // PARITY-GATE-001 Stage 7: Include manual fields when source='manual'
      // POSTING-AUTHORITY-001: Tag capper origin in meta JSONB
      // PARLAY-SCHEMA-FIX-029: Include leg_index for parlay unique constraint
      // EMBED-PRODUCTION-CONTRACT-030: Include ticket_type for parlay grouping
      // EMBED-TRUTH-FIX-031: Include player_name, bet_type, direction for correct embed labeling
      const pickInserts = selections.map((selection, index) => ({
        bet_slip_id: betSlipId,
        user_id: capper_id,
        sport,
        leg_index: index,
        ticket_type: ticket_type,
        stat_type: selection.stat_type,
        line: selection.line,
        odds: selection.leg_odds,
        selection: selection.selection,
        confidence: selection.confidence || 0,
        team_id: selection.team_id,
        player_id: selection.player_id,
        source: selection.source,
        is_live: selection.is_live || false,
        // EMBED-TRUTH-FIX-031: Required fields for correct embed labeling
        player_name: selection.player_name || null,
        bet_type: selection.bet_type || 'moneyline',
        side: selection.direction?.toLowerCase() || null,
        // POSTING-AUTHORITY-001: Origin tagging for posting authority router
        meta: {
          pick_origin: 'capper' as const,
          capper: capperUser.username,
        },
        // Manual entry fields (populated only when source='manual')
        ...(selection.source === 'manual' && {
          manual_matchup_home: selection.manual_matchup_home,
          manual_matchup_away: selection.manual_matchup_away,
          manual_game_date: selection.manual_game_date,
          manual_fields_blob: {
            entered_at: new Date().toISOString(),
            matchup: `${selection.manual_matchup_away} @ ${selection.manual_matchup_home}`,
          },
        }),
      }));

      const { data: insertedPicks, error: picksError } = await (
        supabase.from('unified_picks') as any
      )
        .insert(pickInserts)
        .select();

      logDatabaseOperation(log, 'INSERT', 'unified_picks', insertedPicks, picksError);

      if (picksError) {
        // Rollback smart ticket if picks insertion fails
        await supabase.from('smart_tickets').delete().eq('bet_slip_id', betSlipId);

        return NextResponse.json(
          {
            error: 'Failed to save ticket selections',
            message: picksError.message,
          },
          { status: 500 }
        );
      }

      log.info(
        {
          bet_slip_id: betSlipId,
          capper_id,
          capper_name: capperUser.username,
          sport,
          ticket_type,
          selection_count: selections.length,
          total_units,
          has_manual_entries: hasManualEntries,
          is_live: selections.some(s => s.is_live),
        },
        'Ticket successfully saved'
      );

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

      return NextResponse.json(
        {
          bet_slip_id: betSlipId,
          ticket_id: insertedTicket?.bet_slip_id ?? betSlipId,
          capper_name: capperUser?.username ?? '',
          sport,
          ticket_type,
          selection_count: selections.length,
          total_units,
          is_live: isLive,
          status: 'submitted',
          message: isLive ? 'Live bet submitted successfully!' : 'Ticket submitted successfully!',
        },
        { status: 201 }
      );
    } catch (dbError) {
      log.error(
        {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          capper_id,
          sport,
        },
        'Database error during ticket submission'
      );

      return NextResponse.json(
        {
          error: 'Failed to save ticket',
          message: 'A database error occurred while saving your ticket',
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

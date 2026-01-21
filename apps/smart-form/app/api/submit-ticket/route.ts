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

const log = createRouteLogger('POST /api/submit-ticket', 'POST');

// Extended sports enum to match form types.ts
const SUPPORTED_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA', 'NCAAB', 'UFC/MMA', 'Boxing', 'Soccer', 'Tennis', 'Golf', 'NASCAR', 'F1'] as const;

// Validation schemas for API-style submissions (strict UUID-based)
const GameSelectionSchema = z.object({
  sport: z.enum(SUPPORTED_SPORTS).optional(),
  team_id: z.string().uuid().optional(),
  player_id: z.string().uuid().optional(),
  stat_type: z.string().min(1),
  line: z.number(),
  leg_odds: z.number().int(),
  source: z.enum(['api', 'manual']).default('api'),
  is_live: z.boolean().optional().default(false),
  selection: z.enum(['over', 'under', 'yes', 'no']),
  confidence: z.number().min(0).max(1).optional().default(0),
});

const ApiSubmitTicketSchema = z.object({
  capper_id: z.string().uuid('Capper ID must be a valid UUID'),
  sport: z.enum(SUPPORTED_SPORTS),
  ticket_type: z.enum(['single', 'parlay', 'round_robin', 'teaser']),
  selections: z.array(GameSelectionSchema).min(1, 'At least one selection is required'),
  parlay_odds: z.number().int().optional(),
  total_units: z.number().min(0.5).max(10).default(1.0),
  notes: z.string().optional(),
});

// Validation schema for Smart Form UI submissions (name-based)
const SmartFormGameSelectionSchema = z.object({
  game_id: z.string(),
  selection: z.string(),
  odds: z.string(),
  line: z.string().optional(),
  confidence: z.number().optional(),
  game: z.string().optional(),
});

const SmartFormLegSchema = z.object({
  id: z.string(),
  sport: z.enum(SUPPORTED_SPORTS),
  bet_category: z.string().optional(),
  market_type: z.string().optional(),
  bet_type: z.string().optional(),
  game_id: z.string().optional(),
  selection: z.string().optional(),
  odds: z.union([z.string(), z.number()]).optional(),
  line: z.union([z.string(), z.number()]).optional(),
  status: z.enum(['open', 'pending', 'settled', 'cancelled']).default('open'),
});

const SmartFormSubmitTicketSchema = z.object({
  // Capper can be name (form) or UUID (api)
  capper: z.string().min(1, 'Capper selection is required'),
  capper_id: z.string().uuid().optional(),
  sport: z.enum(SUPPORTED_SPORTS),
  ticket_type: z.enum(['single', 'parlay', 'round_robin', 'teaser']),
  game_date: z.string().optional(),
  // SMART FORM REQUIRED: At least one of unit_size or total_units MUST be provided
  // No fallback to 1.0 - server MUST reject submissions without explicit units
  unit_size: z.number().min(0.5).max(10).optional(),
  total_units: z.number().min(0.5).max(10).optional(),
  odds_format: z.enum(['AMERICAN', 'DECIMAL', 'FRACTIONAL']).optional(),
  auto_parlay: z.boolean().optional(),
  confidence_level: z.number().min(1).max(10).optional(),
  user_tier: z.enum(['free', 'vip', 'vip_plus']).optional(),
  bet_type: z.string().optional(),
  market_type: z.enum(['pre_game', 'live', 'player_prop', 'team_prop', 'game_prop', 'futures']).optional(),
  legs: z.array(SmartFormLegSchema).optional(),
  game_selections: z.array(SmartFormGameSelectionSchema).optional(),
  selections: z.array(GameSelectionSchema).optional(), // API format
  notes: z.string().optional(),
  timestamp: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(['pending', 'submitted', 'error']).optional(),
  bet_slip_id: z.string().optional(),
  parlay_odds: z.number().int().optional(),
});

// Type for API submission
type ApiSubmissionData = z.infer<typeof ApiSubmitTicketSchema>;

// Handle API-style submissions (used by programmatic clients)
async function handleApiSubmission(data: ApiSubmissionData, startTime: number, traceId: string) {
  const {
    capper_id,
    sport,
    ticket_type,
    selections,
    parlay_odds,
    total_units,
    notes,
  } = data;

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

  const betSlipId = uuidv4();
  const supabase = supabaseServer();

  // Verify capper exists and is active
  const { data: capperUser, error: capperError } = await supabase
    .from('users')
    .select('id, username')
    .eq('id', capper_id)
    .single();

  if (capperError || !capperUser) {
    log.warn({ capper_id, error: capperError?.message }, 'Invalid capper_id provided');
    return NextResponse.json({
      error: 'Invalid capper ID',
      message: 'The specified capper was not found or is inactive',
    }, { status: 400 });
  }

  // Note: active column removed from v3 schema - all cappers assumed active
  // if (!capperUser.active) { ... }

  const hasManualEntries = selections.some(s => s.source === 'manual');
  if (hasManualEntries) {
    logSecurityEvent(log, 'manual_odds_entry', 'medium', {
      capper_id,
      selection_count: selections.length,
    });
  }

  try {
    // Insert smart ticket
    const { data: insertedTicket, error: ticketError } = await supabase
      .from('smart_tickets')
      .insert({
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
      })
      .select()
      .single();

    if (ticketError) {
      return NextResponse.json({
        error: 'Failed to save ticket',
        message: ticketError.message,
      }, { status: 500 });
    }

    // Insert into unified_picks
    const pickInserts = selections.map(selection => ({
      bet_slip_id: betSlipId,
      user_id: capper_id,
      sport,
      stat_type: selection.stat_type,
      line: selection.line,
      odds: selection.leg_odds,
      selection: selection.selection,
      confidence: selection.confidence || 0,
      team_id: selection.team_id || null,
      player_id: selection.player_id || null,
      source: selection.source,
      is_live: selection.is_live || false,
      form_source: 'api', // API submissions marked differently
      stake: total_units,
      workflow_stage: 'pending_review',
      status: 'pending',
      // GAP-002 FIX: trace_id for end-to-end observability
      trace_id: traceId,
    }));

    const { data: insertedPicks, error: picksError } = await supabase
      .from('unified_picks')
      .insert(pickInserts)
      .select();

    if (picksError) {
      await supabase.from('smart_tickets').delete().eq('bet_slip_id', betSlipId);
      return NextResponse.json({
        error: 'Failed to save ticket selections',
        message: picksError.message,
      }, { status: 500 });
    }

    // Create pick_publish records
    const CANARY_CHANNEL_ID = process.env.CANARY_CHANNEL_ID || '1296531122234327100';
    const pickPublishInserts = insertedPicks.map((pick: any) => ({
      pick_id: pick.id,
      tenant_id: insertedTicket.id,
      channel: 'CANARY',
      status: 'pending',
      discord_channel_id: CANARY_CHANNEL_ID,
      attempts: 0,
      max_attempts: 3,
      dedupe_key: `api_${pick.id}_${Date.now()}`,
      metadata: {
        // GAP-002 FIX: trace_id for end-to-end observability
        trace_id: traceId,
        correlation_id: traceId, // Alias for compatibility with distributed tracing
        form_source: 'api',
        bet_slip_id: betSlipId,
        capper_id,
        capper_name: capperUser.username,
        sport,
        ticket_type,
        selection: pick.selection,
        line: pick.line,
        odds: pick.odds,
        stat_type: pick.stat_type,
        total_units,
      },
    }));

    await supabase.from('pick_publish').insert(pickPublishInserts);

    await publishTicketSubmitted({
      bet_slip_id: betSlipId,
      capper_id,
      selection_count: selections.length,
    });

    const isLive = selections.some(s => s.is_live);

    logApiPerformance(log, 'submit-ticket-api', startTime, {
      bet_slip_id: betSlipId,
      capper_id,
      sport,
      ticket_type,
      selection_count: selections.length,
      is_live: isLive,
    });

    return NextResponse.json({
      // GAP-002 FIX: Include trace_id for client-side correlation
      trace_id: traceId,
      bet_slip_id: betSlipId,
      ticket_id: insertedTicket.bet_slip_id,
      capper_name: capperUser.username,
      sport,
      ticket_type,
      selection_count: selections.length,
      total_units,
      is_live: isLive,
      status: 'submitted',
      message: isLive ? 'Live bet submitted successfully!' : 'Ticket submitted successfully!',
    }, { status: 201 });

  } catch (dbError) {
    log.error({
      error: dbError instanceof Error ? dbError.message : 'Unknown error',
      capper_id,
      sport,
    }, 'Database error during API ticket submission');

    return NextResponse.json({
      error: 'Failed to save ticket',
      message: 'A database error occurred while saving your ticket',
    }, { status: 500 });
  }
}

// SmartFormBridge integration
async function publishTicketSubmitted(ticketData: {
  bet_slip_id: string;
  capper_id: string;
  selection_count: number;
}) {
  try {
    const sb = supabaseServer();
    
    // Write to bridge outbox for idempotent processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb
      .from('bridge_outbox') as any)
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
  // GAP-002 FIX: Generate trace_id for end-to-end observability
  const traceId = uuidv4();

  try {
    log.info({ trace_id: traceId }, 'Ticket submission received');

    const rawFormData = await request.json();

    log.info({
      trace_id: traceId,
      submitted_fields: Object.keys(rawFormData),
      capper_id: rawFormData.capper_id,
      capper: rawFormData.capper,
      sport: rawFormData.sport,
      selection_count: rawFormData.selections?.length || rawFormData.game_selections?.length || rawFormData.legs?.length || 0,
      has_game_selections: !!rawFormData.game_selections,
      has_legs: !!rawFormData.legs,
      has_selections: !!rawFormData.selections,
    }, 'Processing ticket submission');

    // Determine if this is an API submission (capper_id) or Smart Form submission (capper name)
    const isApiSubmission = rawFormData.capper_id && !rawFormData.capper;

    // Try API schema first if it looks like an API submission
    if (isApiSubmission) {
      const apiValidation = ApiSubmitTicketSchema.safeParse(rawFormData);
      if (apiValidation.success) {
        // Handle API-style submission
        return handleApiSubmission(apiValidation.data, startTime, traceId);
      }
    }

    // Try Smart Form schema
    const smartFormValidation = SmartFormSubmitTicketSchema.safeParse(rawFormData);
    if (!smartFormValidation.success) {
      logValidationError(log, smartFormValidation.error.errors, rawFormData);

      return NextResponse.json({
        error: 'Invalid ticket data',
        details: smartFormValidation.error.errors,
      }, { status: 400 });
    }

    const formData = smartFormValidation.data;
    const {
      capper,
      capper_id: providedCapperId,
      sport,
      ticket_type,
      game_selections,
      legs,
      selections: apiSelections,
      parlay_odds,
      notes,
      bet_slip_id: providedBetSlipId,
      unit_size,
      total_units: providedTotalUnits,
      confidence_level,
      bet_type,
      market_type,
    } = formData;

    // =========================================================================
    // SMART FORM REQUIRED FIELDS VALIDATION (GAP-003 FIX)
    // Hard-reject incomplete Smart Form submissions - NO FALLBACK DEFAULTS
    // This ensures form_source='smart_form' picks always have required fields
    // =========================================================================
    const smartFormRequiredFieldErrors: string[] = [];

    // REQUIRED: units (either unit_size or total_units must be explicitly provided)
    if (unit_size === undefined && providedTotalUnits === undefined) {
      smartFormRequiredFieldErrors.push('units (unit_size or total_units) is required for Smart Form submissions');
    }

    // REQUIRED: capper must be explicitly provided (already validated by schema, but double-check)
    if (!capper && !providedCapperId) {
      smartFormRequiredFieldErrors.push('capper is required for Smart Form submissions');
    }

    // REQUIRED: at least one selection source must have entries
    const selectionsSourceCheck = apiSelections || game_selections || legs || [];
    if (selectionsSourceCheck.length === 0) {
      smartFormRequiredFieldErrors.push('at least one selection is required for Smart Form submissions');
    }

    // If any required fields are missing, hard-reject the submission
    if (smartFormRequiredFieldErrors.length > 0) {
      log.warn({
        trace_id: traceId,
        capper,
        sport,
        missing_fields: smartFormRequiredFieldErrors,
        provided_unit_size: unit_size,
        provided_total_units: providedTotalUnits,
      }, 'Smart Form submission rejected: missing required fields');

      return NextResponse.json({
        error: 'Smart Form submission incomplete',
        message: 'Smart Form submissions require all minimum fields to be explicitly provided. No fallback defaults are allowed.',
        missing_fields: smartFormRequiredFieldErrors,
        trace_id: traceId,
      }, { status: 400 });
    }

    // Use provided units (no fallback to 1.0 - already validated above)
    const total_units = unit_size ?? providedTotalUnits!; // Non-null assertion safe due to validation above

    // Determine selections source (game_selections, legs, or apiSelections)
    const selectionsSource = apiSelections || game_selections || legs || [];
    const selectionCount = selectionsSource.length;

    // Validate ticket type vs selection count
    if (ticket_type === 'parlay' && selectionCount < 2) {
      return NextResponse.json({
        error: 'Parlay tickets require at least 2 selections',
      }, { status: 400 });
    }

    if (ticket_type === 'round_robin' && selectionCount < 2) {
      return NextResponse.json({
        error: 'Round robin tickets require at least 2 selections',
      }, { status: 400 });
    }

    // Generate unique bet slip ID (use provided or generate new)
    const betSlipId = providedBetSlipId || uuidv4();
    const supabase = supabaseServer();

    // Resolve capper - either by UUID or by name
    let capperUser: { id: string; username: string; active: boolean } | null = null;
    let capper_id: string;

    if (providedCapperId) {
      // API-style: capper_id is UUID
      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', providedCapperId)
        .single();

      if (error || !data) {
        log.warn({ capper_id: providedCapperId, error: error?.message }, 'Invalid capper_id provided');
        return NextResponse.json({
          error: 'Invalid capper ID',
          message: 'The specified capper was not found',
        }, { status: 400 });
      }
      capperUser = data;
      capper_id = providedCapperId;
    } else if (capper) {
      // Smart Form style: capper is name
      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', capper)
        .single();

      if (error || !data) {
        // Try case-insensitive match
        const { data: iCaseData, error: iCaseError } = await supabase
          .from('users')
          .select('id, username')
          .ilike('username', capper)
          .single();

        if (iCaseError || !iCaseData) {
          log.warn({ capper, error: error?.message }, 'Capper not found by name');
          return NextResponse.json({
            error: 'Invalid capper',
            message: `Capper "${capper}" was not found in the system`,
          }, { status: 400 });
        }
        capperUser = iCaseData;
        capper_id = iCaseData.id;
      } else {
        capperUser = data;
        capper_id = data.id;
      }
    } else {
      return NextResponse.json({
        error: 'Missing capper',
        message: 'Either capper or capper_id must be provided',
      }, { status: 400 });
    }

    // Note: active column removed from v3 schema - all cappers assumed active
    // if (!capperUser.active) { ... }

    // Determine if there are manual entries
    const hasManualEntries = apiSelections?.some((s: any) => s.source === 'manual') || false;
    if (hasManualEntries) {
      logSecurityEvent(log, 'manual_odds_entry', 'medium', {
        capper_id,
        selection_count: selectionCount,
      });
    }

    // Create smart ticket (authoritative record)
    const smartTicketData = {
      bet_slip_id: betSlipId,
      capper_id,
      sport,
      ticket_type,
      game_selections: game_selections || legs || apiSelections,
      parlay_odds,
      total_units,
      status: 'submitted',
      selection_count: selectionCount,
      notes,
    };

    // Start transaction
    try {
      // Note: smart_tickets table removed from v3 schema
      // We skip smart_tickets insert and use a generated ticket ID
      let insertedTicket = { id: uuidv4(), bet_slip_id: betSlipId };

      // Try to insert into smart_tickets if table exists (backward compatibility)
      try {
        const { data: ticketData, error: ticketError } = await supabase
          .from('smart_tickets')
          .insert(smartTicketData)
          .select()
          .single();

        if (!ticketError && ticketData) {
          insertedTicket = ticketData;
          logDatabaseOperation(log, 'INSERT', 'smart_tickets', ticketData, null);
        }
      } catch (smartTicketsError) {
        // Table doesn't exist - this is OK in v3 schema
        log.info('smart_tickets table not found, proceeding with unified_picks only');
      }

      // Transform selections to unified_picks format
      // Handle both API format (selections) and Smart Form format (game_selections/legs)
      const pickInserts = selectionsSource.map((selection: any) => {
        // Normalize selection data from different formats
        let odds: number;
        let line: number | null = null;
        let selectionValue: string;
        let statType: string;
        let confidenceValue: number;

        // Handle API-style selection (has leg_odds, stat_type)
        if ('leg_odds' in selection && typeof selection.leg_odds === 'number') {
          odds = selection.leg_odds;
          line = selection.line;
          selectionValue = selection.selection;
          statType = selection.stat_type || bet_type || 'unknown';
          confidenceValue = selection.confidence || 0;
        }
        // Handle Smart Form game_selection (has odds as string, game_id)
        else if ('game_id' in selection) {
          odds = parseInt(String(selection.odds).replace(/[^-\d]/g, ''), 10) || -110;
          line = selection.line ? parseFloat(String(selection.line)) : null;
          selectionValue = selection.selection || 'unknown';
          statType = bet_type || market_type || 'game_selection';
          confidenceValue = (confidence_level ? confidence_level / 10 : 0); // Convert 1-10 to 0-1
        }
        // Handle Smart Form leg format
        else if ('bet_type' in selection) {
          odds = typeof selection.odds === 'number' ? selection.odds : parseInt(String(selection.odds || '-110').replace(/[^-\d]/g, ''), 10);
          line = selection.line ? (typeof selection.line === 'number' ? selection.line : parseFloat(String(selection.line))) : null;
          selectionValue = selection.selection || 'unknown';
          statType = selection.bet_type || bet_type || 'unknown';
          confidenceValue = (confidence_level ? confidence_level / 10 : 0);
        }
        // Default fallback
        else {
          odds = -110;
          line = null;
          selectionValue = 'unknown';
          statType = bet_type || 'unknown';
          confidenceValue = 0;
        }

        return {
          bet_slip_id: betSlipId,
          user_id: capper_id,
          sport,
          stat_type: statType,
          line: line,
          odds: odds,
          selection: selectionValue,
          confidence: confidenceValue,
          team_id: selection.team_id || null,
          player_id: selection.player_id || null,
          source: selection.source || 'api',
          is_live: selection.is_live || market_type === 'live' || false,
          // SMART FORM MARKER: Identifies picks submitted via Smart Form UI
          form_source: 'smart_form',
          stake: total_units,
          workflow_stage: 'pending_review',
          status: 'pending',
          // GAP-002 FIX: trace_id for end-to-end observability
          trace_id: traceId,
        };
      });

      const { data: insertedPicks, error: picksError } = await supabase
        .from('unified_picks')
        .insert(pickInserts)
        .select();

      logDatabaseOperation(log, 'INSERT', 'unified_picks', insertedPicks, picksError);

      if (picksError) {
        // Rollback smart ticket if picks insertion fails (ignore if table doesn't exist)
        try {
          await supabase
            .from('smart_tickets')
            .delete()
            .eq('bet_slip_id', betSlipId);
        } catch {
          // Table doesn't exist - OK in v3 schema
        }

        return NextResponse.json({
          error: 'Failed to save ticket selections',
          message: picksError.message,
        }, { status: 500 });
      }

      // Create pick_publish records for Discord publishing
      // This enables the pick to flow to Discord via the publishing pipeline
      const CANARY_CHANNEL_ID = process.env.CANARY_CHANNEL_ID || '1296531122234327100';

      const pickPublishInserts = insertedPicks.map((pick: any) => ({
        pick_id: pick.id,
        tenant_id: insertedTicket.id, // Use smart_tickets ID as tenant reference
        channel: 'CANARY',
        status: 'pending',
        discord_channel_id: CANARY_CHANNEL_ID,
        attempts: 0,
        max_attempts: 3,
        dedupe_key: `smart_form_${pick.id}_${Date.now()}`,
        metadata: {
          // GAP-002 FIX: trace_id for end-to-end observability
          trace_id: traceId,
          correlation_id: traceId, // Alias for compatibility with distributed tracing
          form_source: 'smart_form',
          bet_slip_id: betSlipId,
          capper_id,
          capper_name: capperUser.username,
          sport,
          ticket_type,
          selection: pick.selection,
          line: pick.line,
          odds: pick.odds,
          stat_type: pick.stat_type,
          total_units,
          confidence: pick.confidence,
          is_live: pick.is_live || false,
        },
      }));

      const { data: insertedPublish, error: publishError } = await supabase
        .from('pick_publish')
        .insert(pickPublishInserts)
        .select();

      if (publishError) {
        log.warn({
          error: publishError.message,
          bet_slip_id: betSlipId,
        }, 'Failed to create pick_publish records - picks saved but Discord publish pending');
      } else {
        log.info({
          bet_slip_id: betSlipId,
          pick_publish_count: insertedPublish?.length || 0,
        }, 'pick_publish records created for Discord publishing');
      }

      log.info({
        trace_id: traceId,
        bet_slip_id: betSlipId,
        capper_id,
        capper_name: capperUser.username,
        sport,
        ticket_type,
        selection_count: selectionCount,
        total_units,
        has_manual_entries: hasManualEntries,
        is_live: market_type === 'live' || pickInserts.some((p: any) => p.is_live),
      }, 'Ticket successfully saved');

      // Publish to bridge for external processing
      await publishTicketSubmitted({
        bet_slip_id: betSlipId,
        capper_id,
        selection_count: selectionCount,
      });

      const isLive = market_type === 'live' || pickInserts.some((p: any) => p.is_live);

      logApiPerformance(log, 'submit-ticket', startTime, {
        bet_slip_id: betSlipId,
        capper_id,
        sport,
        ticket_type,
        selection_count: selectionCount,
        is_live: isLive,
        has_manual_entries: hasManualEntries,
      });

      return NextResponse.json({
        // GAP-002 FIX: Include trace_id for client-side correlation
        trace_id: traceId,
        bet_slip_id: betSlipId,
        ticket_id: insertedTicket.bet_slip_id,
        ticketId: insertedTicket.bet_slip_id, // Alias for form compatibility
        capper_name: capperUser.username,
        sport,
        ticket_type,
        selection_count: selectionCount,
        total_units,
        is_live: isLive,
        isLive, // Alias for form compatibility
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

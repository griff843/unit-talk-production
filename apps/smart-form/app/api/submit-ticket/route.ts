import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { supabaseServer } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import {
  createRouteLogger,
  logDatabaseOperation,
  logApiPerformance,
  logValidationError,
  logSecurityEvent,
} from '@/lib/logger';

const log = createRouteLogger('POST /api/submit-ticket', 'POST');

// Validation schemas
const GameSelectionSchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']),
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

const SubmitTicketSchema = z.object({
  capper_id: z.union([
    z.string().uuid('Capper ID must be a valid UUID'),
    z.number().int().positive('Capper ID must be a positive integer'),
    z.string().regex(/^\d+$/, 'Capper ID must be a valid integer or UUID').transform(val => parseInt(val))
  ]),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']),
  ticket_type: z.enum(['single', 'parlay', 'round_robin']),
  selections: z.array(GameSelectionSchema).min(1, 'At least one selection is required'),
  parlay_odds: z.number().int().optional(),
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
    const outboxEntry = {
      event_type: 'ticket_submitted',
      payload: ticketData as any, // Type assertion for Supabase JSON field
      unique_key: ticketData.bet_slip_id,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      next_attempt_at: new Date(Date.now() + 5000).toISOString(),
    };

    const { error } = await sb
      .from('bridge_outbox')
      .insert(outboxEntry as any);

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

    // Verify capper exists (note: 'active' column doesn't exist in current schema)
    const { data: capperUser, error: capperError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', capper_id.toString())
      .neq('username', 'System') // System user is not a valid capper
      .single() as { data: any | null, error: any };

    if (capperError || !capperUser) {
      log.warn({
        capper_id,
        error: capperError?.message,
      }, 'Invalid capper_id provided');

      return NextResponse.json({
        error: 'Invalid capper ID',
        message: 'The specified capper was not found',
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

    // Start transaction - Use bridge outbox pattern for reliable processing
    try {
      log.info({ bet_slip_id: betSlipId }, 'Publishing ticket to bridge outbox');

      // Publish to bridge outbox for idempotent processing
      await publishTicketSubmitted({
        bet_slip_id: betSlipId,
        capper_id: capper_id.toString(),
        selection_count: selections.length,
      });

      log.info({
        bet_slip_id: betSlipId,
        capper_id,
        selection_count: selections.length
      }, 'Ticket published to bridge outbox successfully');

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
        ticket_id: betSlipId,
        capper_name: capperUser.username,
        sport,
        ticket_type,
        selection_count: selections.length,
        total_units,
        is_live: isLive,
        status: 'submitted',
        processing_status: 'queued_for_processing',
        message: isLive
          ? 'Live bet submitted successfully and queued for processing!'
          : 'Ticket submitted successfully and queued for processing!',
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

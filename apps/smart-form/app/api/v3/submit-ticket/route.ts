import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger } from '@/lib/logger';

/**
 * SPRINT-CANONICAL-SURFACE-ALIGNMENT-114
 *
 * V3 ticket submission via bridge_outbox → unified_picks.
 *
 * This route replaces the direct atomic_submit_ticket_v2 RPC call
 * to ensure V3 submissions flow through the canonical BridgeWorker
 * pipeline that creates unified_picks entries.
 *
 * Flow:
 * 1. V3 form calls this API route
 * 2. This route writes to bridge_outbox (event_type: 'ticket_submitted')
 * 3. BridgeWorker processes the event and creates unified_picks via lifecycleInsert
 * 4. Command Center and settlement work on unified_picks
 */

const log = createRouteLogger('POST /api/v3/submit-ticket', 'POST');

// V3 Leg payload schema - flexible to handle both catalog and manual entry
const LegSchema = z
  .object({
    event_id: z.string().uuid().optional().nullable(),
    market_type_id: z.number().optional().nullable(),
    segment_type_id: z.number().optional().nullable(),
    selection: z.string().optional().nullable(),
    provider_offer_id: z.string().uuid().optional().nullable(),
    participant_id: z.string().optional().nullable(),
    line: z.number().optional().nullable(),
    odds: z.number().optional().nullable(),
    provider: z.string().optional().nullable(),
    override: z
      .object({
        line: z.number().optional(),
        odds: z.number().optional(),
      })
      .optional()
      .nullable(),
    // Manual entry fields
    sport: z.string().optional().nullable(),
    bet_type: z.string().optional().nullable(),
    matchup: z.string().optional().nullable(),
    home_team: z.string().optional().nullable(),
    away_team: z.string().optional().nullable(),
    player_name: z.string().optional().nullable(),
    // Additional fields that may be passed
    id: z.string().optional(),
    event_display: z.string().optional().nullable(),
    market_display: z.string().optional().nullable(),
    participant_display: z.string().optional().nullable(),
    isManual: z.boolean().optional(),
  })
  .passthrough();

// V3 submission schema
const V3SubmitSchema = z.object({
  bet_slip_id: z.string().min(1),
  user_id: z.string().uuid(),
  ticket_type: z.enum(['single', 'parlay']),
  total_stake: z.number().min(0),
  legs: z.array(LegSchema).min(1),
  meta: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate input
    const validation = V3SubmitSchema.safeParse(body);
    if (!validation.success) {
      log.warn({ errors: validation.error.errors }, 'Validation failed');
      return NextResponse.json(
        {
          status: 'error',
          error_details: validation.error.errors.map((e, idx) => ({
            leg_index: idx,
            errors: [e.message],
          })),
        },
        { status: 400 }
      );
    }

    const { bet_slip_id, user_id, ticket_type, total_stake, legs, meta } = validation.data;

    log.info(
      {
        bet_slip_id,
        ticket_type,
        leg_count: legs.length,
      },
      'V3 ticket submission received'
    );

    const supabase = supabaseServer();

    // Check for existing submission (idempotency)
    const { data: existing } = await (supabase.from('bridge_outbox') as any)
      .select('id, status')
      .eq('bet_slip_id', bet_slip_id)
      .limit(1);

    if (existing && existing.length > 0) {
      log.info({ bet_slip_id, status: existing[0].status }, 'Duplicate submission detected');

      // Return success for idempotent duplicate
      return NextResponse.json({
        status: 'exists',
        ticket_id: bet_slip_id,
        leg_ids: null,
        error_details: null,
      });
    }

    // Build event_data for bridge_outbox
    // Include all leg details so BridgeWorker can create unified_picks
    const firstLeg = legs[0];
    const eventData = {
      bet_slip_id,
      user_id,
      ticket_type,
      total_stake,
      legs,
      meta: meta || {},
      source: 'smart_form_v3',
      // Extract first leg data for single picks (BridgeWorker uses this)
      sport: firstLeg.sport || meta?.sport || 'NBA',
      stat_type: firstLeg.bet_type || meta?.market_type || 'moneyline',
      selection: firstLeg.selection,
      player_name: firstLeg.player_name || null,
      odds: firstLeg.override?.odds || firstLeg.odds || -110,
      line: firstLeg.override?.line || firstLeg.line || null,
      unit_size: total_stake,
      // Matchup data for display
      home_team: firstLeg.home_team || null,
      away_team: firstLeg.away_team || null,
      matchup: firstLeg.matchup || null,
    };

    // Insert into bridge_outbox
    const { error: insertError } = await (supabase.from('bridge_outbox') as any).insert({
      event_type: 'ticket_submitted',
      event_data: eventData,
      bet_slip_id,
      status: 'pending',
    });

    if (insertError) {
      // Check for duplicate key error
      if (insertError.code === '23505') {
        log.info({ bet_slip_id }, 'Duplicate detected via constraint');
        return NextResponse.json({
          status: 'exists',
          ticket_id: bet_slip_id,
          leg_ids: null,
          error_details: null,
        });
      }

      log.error(
        { error: insertError.message, code: insertError.code },
        'Failed to insert bridge_outbox'
      );
      throw new Error(`Bridge outbox insert failed: ${insertError.message}`);
    }

    const processingTime = Date.now() - startTime;
    log.info(
      {
        bet_slip_id,
        ticket_type,
        leg_count: legs.length,
        processingTimeMs: processingTime,
      },
      'V3 ticket submitted to bridge_outbox successfully'
    );

    // Return success - ticket is now in the bridge_outbox queue
    // BridgeWorker will process it and create unified_picks entry
    return NextResponse.json(
      {
        status: 'inserted',
        ticket_id: bet_slip_id,
        leg_ids: legs.map(() => bet_slip_id), // BridgeWorker assigns real IDs
        error_details: null,
      },
      { status: 201 }
    );
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'V3 submission error'
    );

    return NextResponse.json(
      {
        status: 'error',
        ticket_id: null,
        leg_ids: null,
        error_details: [
          {
            leg_index: 0,
            errors: [error instanceof Error ? error.message : 'Internal server error'],
          },
        ],
      },
      { status: 500 }
    );
  }
}

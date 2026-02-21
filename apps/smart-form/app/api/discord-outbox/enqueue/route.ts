import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('POST /api/discord-outbox/enqueue', 'POST');

/**
 * SPRINT-DISCORD-OUTBOX-ROUTING-CLAIM-092
 *
 * Server-side API endpoint for enqueuing Discord outbox.
 * Resolves channel ID from env var (DEFAULT_DISCORD_TICKET_CHANNEL_ID)
 * and calls enqueue_ticket_discord_outbox_v2 RPC with fail-closed routing.
 */

interface EnqueueRequest {
  ticket_id: string;
  bet_slip_id: string;
}

interface EnqueueResult {
  success: boolean;
  outbox_id: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EnqueueRequest;

    if (!body.ticket_id || !body.bet_slip_id) {
      return NextResponse.json(
        { error: 'ticket_id and bet_slip_id are required' },
        { status: 400 }
      );
    }

    // SPRINT-092: Resolve channel from env var (server-side)
    const channelId = process.env.DEFAULT_DISCORD_TICKET_CHANNEL_ID;

    if (!channelId) {
      log.warn(
        { ticket_id: body.ticket_id },
        'DEFAULT_DISCORD_TICKET_CHANNEL_ID not set - enqueue will fail-closed'
      );
    }

    const supabase = supabaseServer();

    // Call v2 enqueue with channel_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('enqueue_ticket_discord_outbox_v2', {
      p_ticket_id: body.ticket_id,
      p_bet_slip_id: body.bet_slip_id,
      p_discord_channel_id: channelId || null,
    });

    if (error) {
      log.error(
        { error: error.message, ticket_id: body.ticket_id },
        'Failed to enqueue Discord outbox'
      );
      return NextResponse.json(
        { error: 'Failed to enqueue', details: error.message },
        { status: 500 }
      );
    }

    // RPC returns array with single row
    const result = (data as EnqueueResult[])?.[0];

    if (!result) {
      log.error({ ticket_id: body.ticket_id }, 'No result from enqueue RPC');
      return NextResponse.json({ error: 'No result from enqueue' }, { status: 500 });
    }

    log.info(
      {
        ticket_id: body.ticket_id,
        outbox_id: result.outbox_id,
        status: result.status,
        success: result.success,
        channel_configured: !!channelId,
      },
      `Discord outbox enqueue: ${result.status}`
    );

    return NextResponse.json(
      {
        success: result.success,
        outbox_id: result.outbox_id,
        status: result.status,
        error_code: result.error_code,
        error_message: result.error_message,
      },
      { status: result.success ? 200 : 422 }
    );
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      'Unexpected error in enqueue endpoint'
    );
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

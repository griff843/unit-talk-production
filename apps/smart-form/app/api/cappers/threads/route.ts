import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('GET /api/cappers/threads', 'GET');

/**
 * Capper Thread Auto-Hydration Endpoint
 *
 * Queries capper_threads or user_threads table by (userId, league)
 * to show target Discord thread information inline.
 *
 * Query params:
 * - userId: UUID of the capper
 * - league: Optional league filter
 *
 * Returns:
 * - picksThreadId: Discord thread ID for picks
 * - picksThreadName: Thread name
 * - picksThreadUrl: Discord thread URL
 * - qaThreadId: Discord thread ID for Q&A (if available)
 * - qaThreadName: Thread name
 * - qaThreadUrl: Discord thread URL
 */

// Removed unused ThreadInfo interface

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const league = searchParams.get('league');

    if (!userId) {
      return NextResponse.json({
        error: 'Missing required parameter: userId',
      }, { status: 400 });
    }

    log.info({ userId, league }, 'Fetching capper thread information');

    const supabase = supabaseServer();

    // Query user_threads table (if it exists)
    // This table structure is based on the CapperThreadResolver service
    const { data: threads, error } = await supabase
      .from('user_threads')
      .select('*')
      .eq('discord_id', userId);

    if (error) {
      // Table might not exist yet - return graceful fallback
      log.warn({ error: error.message, userId }, 'user_threads table not found or error');

      return NextResponse.json({
        success: true,
        userId,
        threads: [],
        warning: 'Thread mapping not yet configured',
        docsUrl: 'https://docs.unit-talk.com/capper-threads',
      });
    }

    if (!threads || threads.length === 0) {
      log.info({ userId }, 'No threads found for capper');

      return NextResponse.json({
        success: true,
        userId,
        threads: [],
        warning: `No Discord threads mapped for this capper yet`,
        docsUrl: 'https://docs.unit-talk.com/capper-threads',
      });
    }

    // Process and format thread information
    const picksThread = threads.find((t: any) => t.thread_type === 'picks');
    const qaThread = threads.find((t: any) => t.thread_type === 'qa');

    const guildId = process.env.DISCORD_GUILD_ID || '1234567890';

    const response: any = {
      success: true,
      userId,
      threads: [],
    };

    if (picksThread) {
      response.picksThreadId = picksThread.thread_id;
      response.picksThreadName = picksThread.metadata?.name || 'Picks Thread';
      response.picksThreadUrl = `https://discord.com/channels/${guildId}/${picksThread.thread_id}`;
      response.threads.push({
        type: 'picks',
        threadId: picksThread.thread_id,
        name: picksThread.metadata?.name || 'Picks Thread',
        url: `https://discord.com/channels/${guildId}/${picksThread.thread_id}`,
      });
    }

    if (qaThread) {
      response.qaThreadId = qaThread.thread_id;
      response.qaThreadName = qaThread.metadata?.name || 'Q&A Thread';
      response.qaThreadUrl = `https://discord.com/channels/${guildId}/${qaThread.thread_id}`;
      response.threads.push({
        type: 'qa',
        threadId: qaThread.thread_id,
        name: qaThread.metadata?.name || 'Q&A Thread',
        url: `https://discord.com/channels/${guildId}/${qaThread.thread_id}`,
      });
    }

    log.info({
      userId,
      picksThread: !!picksThread,
      qaThread: !!qaThread,
    }, 'Thread information retrieved successfully');

    return NextResponse.json(response);

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to fetch capper thread information');

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch thread information',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

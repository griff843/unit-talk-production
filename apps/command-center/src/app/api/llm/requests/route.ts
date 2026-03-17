'use server';

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { createClient } from '@/lib/supabase';

/**
 * LLM Requests API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

interface LLMRequest {
  id: string;
  model: string;
  prompt: string;
  response?: string;
  tokens: number;
  cost: number;
  responseTime: number;
  status: 'pending' | 'completed' | 'error';
  timestamp: string;
  user: string;
  type: 'pick-analysis' | 'market-research' | 'user-query' | 'system';
}

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createClient();

    const { data: requests, error } = await supabase
      .from('llm_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[CC] LLM requests query failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database query failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Transform database records to match interface
    const transformedRequests: LLMRequest[] =
      requests?.map(request => ({
        id: request.id,
        model: request.model_name || 'Unknown Model',
        prompt: request.prompt || '',
        response: request.response || undefined,
        tokens: request.tokens_used || 0,
        cost: request.cost || 0,
        responseTime: request.response_time_ms || 0,
        status: request.status || 'completed',
        timestamp: request.created_at || new Date().toISOString(),
        user: request.user_id || 'system',
        type: 'system',
      })) || [];

    return NextResponse.json({
      success: true,
      data: transformedRequests,
      count: transformedRequests.length,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] LLM requests error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

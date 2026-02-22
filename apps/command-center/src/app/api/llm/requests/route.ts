'use server';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase';

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

// Mock data for demonstration - in production, this would come from request logs
const mockRequests: LLMRequest[] = [
  {
    id: 'req-001',
    model: 'GPT-4 Turbo',
    prompt: "Analyze the betting market for tonight's Lakers vs Warriors game...",
    response: 'Based on current market conditions and team performance...',
    tokens: 450,
    cost: 0.023,
    responseTime: 1150,
    status: 'completed',
    timestamp: new Date().toISOString(),
    user: 'system',
    type: 'pick-analysis',
  },
  {
    id: 'req-002',
    model: 'Claude 3 Sonnet',
    prompt: 'Generate market insights for NBA player props...',
    response: 'Player prop analysis reveals significant value...',
    tokens: 320,
    cost: 0.016,
    responseTime: 890,
    status: 'completed',
    timestamp: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
    user: 'grading-agent',
    type: 'market-research',
  },
  {
    id: 'req-003',
    model: 'GPT-3.5 Turbo',
    prompt: 'What are the key factors for NFL betting this week?',
    response: 'Key factors include weather conditions, injury reports...',
    tokens: 180,
    cost: 0.004,
    responseTime: 650,
    status: 'completed',
    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    user: 'user-001',
    type: 'user-query',
  },
  {
    id: 'req-004',
    model: 'GPT-4 Turbo',
    prompt: 'System performance analysis request...',
    tokens: 120,
    cost: 0.006,
    responseTime: 1200,
    status: 'pending',
    timestamp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    user: 'system',
    type: 'system',
  },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Try to get real LLM request logs from database
    const { data: requests, error } = await supabase
      .from('llm_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.log('LLM requests table not found, returning mock data');
      return NextResponse.json(mockRequests);
    }

    // Transform database records to match interface
    const transformedRequests =
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
        // Note: request_type not in production schema - defaulting to 'system'
        type: 'system',
      })) || [];

    return NextResponse.json(transformedRequests.length > 0 ? transformedRequests : mockRequests);
  } catch (error) {
    console.error('Error fetching LLM requests:', error);
    return NextResponse.json(mockRequests, { status: 200 });
  }
}

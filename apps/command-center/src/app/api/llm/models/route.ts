'use server';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase';

/**
 * LLM Models API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock data removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

interface LLMModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'local';
  status: 'active' | 'inactive' | 'error';
  tokensUsed: number;
  tokensLimit: number;
  requestsToday: number;
  avgResponseTime: number;
  cost: number;
  accuracy: number;
  lastUsed: string;
  configuration: {
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: models, error } = await supabase
      .from('llm_models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CC] LLM models query failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database query failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Transform database records to match interface
    const transformedModels: LLMModel[] =
      models?.map(model => ({
        id: model.id,
        name: model.name || 'Unknown',
        provider: model.provider || 'openai',
        status: model.status || 'active',
        tokensUsed: model.tokens_used || 0,
        tokensLimit: model.tokens_limit || 1000000,
        requestsToday: model.requests_today || 0,
        avgResponseTime: model.avg_response_time || 0,
        cost: model.cost || 0,
        accuracy: model.accuracy || 0,
        lastUsed: model.last_used || new Date().toISOString(),
        configuration: model.configuration || {
          temperature: 0.7,
          maxTokens: 4096,
          topP: 0.9,
          frequencyPenalty: 0.1,
        },
      })) || [];

    return NextResponse.json({
      success: true,
      data: transformedModels,
      count: transformedModels.length,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] LLM models error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

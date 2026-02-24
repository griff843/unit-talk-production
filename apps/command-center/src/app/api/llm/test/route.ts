'use server';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase';

/**
 * LLM Test API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock/simulation removed.
 * Fail-closed: If LLM integration not configured, return explicit error.
 */

interface TestRequest {
  modelId: string;
  prompt: string;
}

interface TestResponse {
  id: string;
  modelId: string;
  prompt: string;
  response: string;
  tokens: number;
  cost: number;
  responseTime: number;
  status: 'completed' | 'error';
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json();
    const { modelId, prompt } = body;

    if (!modelId || !prompt) {
      return NextResponse.json(
        { success: false, error: 'modelId and prompt are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check if the model exists and has credentials configured
    const { data: model, error: modelError } = await supabase
      .from('llm_models')
      .select('*')
      .eq('id', modelId)
      .single();

    if (modelError || !model) {
      console.error('[CC] LLM model not found:', modelId);
      return NextResponse.json(
        { success: false, error: `Model not found: ${modelId}` },
        { status: 404 }
      );
    }

    // Fail-closed: LLM integration not implemented
    // Real implementation would call OpenAI/Anthropic APIs here
    console.error('[CC] LLM test endpoint called but integration not configured');
    return NextResponse.json(
      {
        success: false,
        error:
          'LLM integration not configured. This endpoint requires actual LLM API credentials to be set up.',
        modelId,
        model: model.name,
        provider: model.provider,
      },
      { status: 501 }
    );

    // NOTE: When LLM integration is implemented, the above error should be
    // replaced with actual API calls. Example structure:
    //
    // const startTime = Date.now();
    // const llmResponse = await callLLMProvider(model.provider, modelId, prompt);
    // const responseTime = Date.now() - startTime;
    //
    // const testResult: TestResponse = {
    //   id: `test-${Date.now()}`,
    //   modelId,
    //   prompt,
    //   response: llmResponse.text,
    //   tokens: llmResponse.usage.totalTokens,
    //   cost: calculateCost(model, llmResponse.usage),
    //   responseTime,
    //   status: 'completed',
    //   timestamp: new Date().toISOString(),
    // };
    //
    // await supabase.from('llm_requests').insert({ ... });
    // return NextResponse.json({ success: true, data: testResult });
  } catch (error) {
    console.error('[CC] LLM test error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

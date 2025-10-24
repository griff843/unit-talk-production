'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

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
      return NextResponse.json({ error: 'modelId and prompt are required' }, { status: 400 });
    }

    const startTime = Date.now();

    // Simulate LLM API call - in production, this would call actual LLM APIs
    const mockResponse = await simulateLLMCall(modelId, prompt);

    const responseTime = Date.now() - startTime;

    // Calculate estimated cost based on model and tokens
    const estimatedTokens = prompt.length / 4 + mockResponse.length / 4; // Rough estimation
    const costPerToken = getCostPerToken(modelId);
    const estimatedCost = (estimatedTokens * costPerToken) / 1000;

    const testResult: TestResponse = {
      id: `test-${Date.now()}`,
      modelId,
      prompt,
      response: mockResponse,
      tokens: Math.round(estimatedTokens),
      cost: Number(estimatedCost.toFixed(4)),
      responseTime,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    // Try to save test result to database
    try {
      const supabase = createClient();
      await supabase.from('llm_requests').insert({
        id: testResult.id,
        model_name: modelId,
        prompt: prompt,
        response: mockResponse,
        tokens_used: testResult.tokens,
        cost: testResult.cost,
        response_time_ms: responseTime,
        status: 'completed',
        request_type: 'system',
        user_id: 'test-user',
        created_at: testResult.timestamp,
      });
    } catch (dbError) {
      console.log('Could not save test result to database:', dbError);
      // Continue anyway - this is just for logging
    }

    return NextResponse.json(testResult);
  } catch (error) {
    console.error('Error testing LLM model:', error);

    return NextResponse.json(
      {
        id: `error-${Date.now()}`,
        modelId: 'unknown',
        prompt: '',
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        tokens: 0,
        cost: 0,
        responseTime: 0,
        status: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

async function simulateLLMCall(modelId: string, prompt: string): Promise<string> {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

  const modelResponses: Record<string, string> = {
    'gpt-4-turbo': `GPT-4 Turbo Response: Based on your prompt "${prompt.substring(0, 50)}...", here's a comprehensive analysis. This model excels at complex reasoning and provides detailed, nuanced responses suitable for sophisticated betting analysis and market research.`,

    'claude-3-sonnet': `Claude 3 Sonnet Response: Analyzing "${prompt.substring(0, 50)}..." - I can provide highly accurate and contextual insights. This model is optimized for analytical tasks and maintains excellent performance across various sports betting scenarios.`,

    'gpt-3.5-turbo': `GPT-3.5 Turbo Response: For "${prompt.substring(0, 50)}..." - This is a quick and efficient response. While faster and more cost-effective, this model still provides solid analysis for standard betting queries and user interactions.`,

    default: `Test Response: Successfully processed prompt "${prompt.substring(0, 50)}...". Model ${modelId} is responding normally with appropriate latency and token usage.`,
  };

  return modelResponses[modelId] || modelResponses.default;
}

function getCostPerToken(modelId: string): number {
  const costs: Record<string, number> = {
    'gpt-4-turbo': 0.00003, // $0.03 per 1K tokens
    'claude-3-sonnet': 0.000015, // $0.015 per 1K tokens
    'gpt-3.5-turbo': 0.000002, // $0.002 per 1K tokens
    default: 0.00001,
  };

  return costs[modelId] || costs.default;
}

import axios from 'axios';
import { Provider, FetchResult } from './types';
import { Logger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

interface FetchInput {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  timestamp: string;
}

const ENDPOINTS = {
  SportsGameOdds: '/v1/odds',
  DraftEdge: '/api/props'
};

export async function fetchFromProvider(
  input: FetchInput,
  supabase: SupabaseClient
): Promise<FetchResult> {
  const logger = new Logger('FetchFromProvider');
  const startTime = Date.now();

  try {
    const { provider, baseUrl, apiKey, timestamp } = input;
    const endpoint = ENDPOINTS[provider];

    if (!endpoint) throw new Error(`Unknown provider endpoint: ${provider}`);

    const response = await axios({
      method: 'GET',
      url: `${baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Request-Timestamp': timestamp
      },
      timeout: 30000
    });

    await supabase.from('feed_raw_responses').insert({
      provider,
      timestamp,
      status: response.status,
      data: response.data,
      latency_ms: Date.now() - startTime
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid response format');
    }

    return {
      success: true,
      data: response.data,
      latencyMs: Date.now() - startTime,
      timestamp
    };

  } catch (error: any) {
    logger.error('Provider fetch failed', {
      provider: input.provider,
      error: error.message,
      timestamp: input.timestamp
    });

    await supabase.from('feed_errors').insert({
      provider: input.provider,
      timestamp: input.timestamp,
      error: error.message,
      details: error.response?.data
    });

    return {
      success: false,
      error: error.message,
      latencyMs: Date.now() - startTime,
      timestamp: input.timestamp
    };
  }
}

// Activity wrapper
export const fetchFromProviderActivity = async (
  input: FetchInput
): Promise<FetchResult> => {
  const supabase = new SupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  return await fetchFromProvider(input, supabase);
};

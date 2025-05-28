import { Provider } from '../types';

export interface FetchProviderInput {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  timestamp: string;
}

export interface FetchResult {
  success: boolean;
  data?: any[];
  error?: string;
  latencyMs: number;
  timestamp: string;
}

export async function fetchFromProviderActivity(input: FetchProviderInput): Promise<FetchResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${input.baseUrl}/api/v1/odds`, {
      headers: {
        'Authorization': `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data.odds || [],
      latencyMs: Date.now() - startTime,
      timestamp: input.timestamp
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      latencyMs: Date.now() - startTime,
      timestamp: input.timestamp
    };
  }
} 
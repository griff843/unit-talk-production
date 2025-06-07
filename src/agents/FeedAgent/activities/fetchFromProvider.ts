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
  statusCode?: number;
  responseText?: string;
}

export async function fetchFromProviderActivity(input: FetchProviderInput): Promise<FetchResult> {
  const { provider, baseUrl, apiKey, timestamp } = input;
  const startTime = Date.now();

  let url = `${baseUrl}/api/v1/odds`;

  // Future: Add provider-specific handling here if needed

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const latencyMs = Date.now() - startTime;
    let responseBody: string | undefined;
    let odds: any[] = [];

    // Always try to grab response text for logging/debugging
    try {
      responseBody = await response.text();
    } catch (e) {
      responseBody = undefined;
    }

    // Parse JSON, but handle non-JSON responses gracefully
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const json = JSON.parse(responseBody ?? '{}');
        odds = Array.isArray(json.odds) ? json.odds : [];
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse JSON for ${provider}: ${e instanceof Error ? e.message : String(e)}`,
          latencyMs,
          timestamp,
          statusCode: response.status,
          responseText: responseBody
        };
      }
    } else {
      // Not JSON; log raw response
      return {
        success: false,
        error: `Non-JSON response received from ${provider}`,
        latencyMs,
        timestamp,
        statusCode: response.status,
        responseText: responseBody
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error from ${provider}: ${response.status}`,
        latencyMs,
        timestamp,
        statusCode: response.status,
        responseText: responseBody
      };
    }

    return {
      success: true,
      data: odds,
      latencyMs,
      timestamp,
      statusCode: response.status
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      latencyMs: Date.now() - startTime,
      timestamp
    };
  }
}

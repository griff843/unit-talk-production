import { proxyActivities } from '@temporalio/workflow';

import { RawProp } from '../../../types/rawProps';
import { fetchRawProps } from '../../IngestionAgent/fetchRawProps';
import { fetchUnifiedData, fetchUnifiedSettlement } from '../dataSourceRouter';

// Activity function for fetching data from providers
export async function fetchFromProviderActivity(provider: string): Promise<RawProp[]> {
  try {
    // Create a basic provider config for the activity
    const providerConfig = {
      name: provider,
      enabled: true,
      url: 'https://api.example.com',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      apiKey: 'mock-key',
      headers: {},
      rateLimit: {
        requests: 100,
        window: 60000
      }
    };

    const result = await fetchRawProps(providerConfig);

    // Ensure all RawProp objects have required id field
    const propsWithIds = result.map(prop => ({
      ...prop,
      id: prop.id || crypto.randomUUID()
    }));

    return propsWithIds;
  } catch (error) {
    console.error(`Failed to fetch from provider ${provider}:`, error);
    throw error;
  }
}

// New unified data ingestion activity
export async function ingestUnifiedData(params: {
  league: string;
  batchSize: number;
  timeout: number;
  includeSettlement?: boolean;
}): Promise<{ success: boolean; count: number; source: string; error?: string }> {
  try {
    const response = await fetchUnifiedData({
      sport: params.league,
      marketType: 'player-props'
    });

    // Optionally fetch settlement data
    if (params.includeSettlement) {
      const settlementResponse = await fetchUnifiedSettlement(params.league, 1);
      console.log(`[FeedAgent] Settlement data: ${settlementResponse.data.length} games`);
    }

    return {
      success: true,
      count: response.data.length,
      source: response.source
    };
  } catch (error) {
    console.error(`[FeedAgent] Unified ingestion failed for ${params.league}:`, error);
    return {
      success: false,
      count: 0,
      source: 'none',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export the activity for Temporal workflows
export const activities = proxyActivities({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
  }
});

// Feed activity for schedule workflows
export async function fetchFeed(params: { league: string; isPeakTime?: boolean; timestamp?: string }): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    console.log(`[FeedAgent] Fetching ${params.league} feed data (peak time: ${params.isPeakTime || false})`);
    
    // Fetch unified data for the league
    const response = await fetchUnifiedData({
      sport: params.league,
      marketType: 'player-props'
    });
    
    return {
      success: true,
      message: `Successfully fetched ${response.data.length} items for ${params.league}`,
      data: {
        league: params.league,
        count: response.data.length,
        source: response.source,
        isPeakTime: params.isPeakTime || false,
        timestamp: params.timestamp || new Date().toISOString()
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[FeedAgent] Failed to fetch feed for ${params.league}:`, errorMessage);
    
    return {
      success: false,
      message: `Failed to fetch feed for ${params.league}: ${errorMessage}`
    };
  }
}

// Re-export the activity function for direct import
export { fetchFromProviderActivity as default };
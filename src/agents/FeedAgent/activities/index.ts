import { proxyActivities } from '@temporalio/workflow';
import { fetchRawProps } from '../../IngestionAgent/fetchRawProps';
import { RawProp } from '../../IngestionAgent/types';

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

// Export the activity for Temporal workflows
export const activities = proxyActivities({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
  }
});

// Re-export the activity function for direct import
export { fetchFromProviderActivity as default };
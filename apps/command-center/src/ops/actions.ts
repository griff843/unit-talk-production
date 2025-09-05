'use server';

import { headers } from 'next/headers';

interface RuntimeConfig {
  mode: 'production' | 'shadow' | 'maintenance';
  bot_publish: boolean;
  smartform_writes: boolean;
  ingestion_enabled: boolean;
  promoter_enabled: boolean;
  alerts_enabled: boolean;
}

/**
 * Fetches the current runtime mode configuration from the API
 */
export async function getRuntimeMode(): Promise<RuntimeConfig | null> {
  try {
    const opsKey = process.env['OPS_API_KEY'];
    if (!opsKey) {
      console.error('[RuntimeMode] OPS_API_KEY not configured');
      return null;
    }

    const apiUrl = process.env['API_URL'] || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/ops/runtime-mode`, {
      method: 'GET',
      headers: {
        'x-ops-key': opsKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[RuntimeMode] Failed to fetch: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[RuntimeMode] Error fetching runtime mode:', error);
    return null;
  }
}

/**
 * Updates the runtime mode configuration
 */
export async function updateRuntimeMode(config: RuntimeConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const opsKey = process.env['OPS_API_KEY'];
    if (!opsKey) {
      return { success: false, error: 'OPS_API_KEY not configured' };
    }

    const apiUrl = process.env['API_URL'] || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/ops/runtime-mode`, {
      method: 'PATCH',
      headers: {
        'x-ops-key': opsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to update: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[RuntimeMode] Error updating runtime mode:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
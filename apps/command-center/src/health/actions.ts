'use server';

import { revalidatePath } from 'next/cache';

interface ProbeResult {
  ok: boolean;
  timestamp: string;
  probes?: Array<{
    name: string;
    ok: boolean;
    duration: number;
    output?: string;
    error?: string;
  }>;
  summary?: string;
  error?: string;
}

/**
 * Run all health probes via the API
 */
export async function runHealthProbes(): Promise<ProbeResult> {
  try {
    const opsKey = process.env.OPS_API_KEY;
    if (!opsKey) {
      return {
        ok: false,
        timestamp: new Date().toISOString(),
        error: 'OPS_API_KEY not configured'
      };
    }

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/ops/probes/health`, {
      method: 'POST',
      headers: {
        'x-ops-key': opsKey,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        timestamp: new Date().toISOString(),
        error: `API returned ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    
    // Revalidate the health page to show updated data
    revalidatePath('/health');
    
    return result;
  } catch (error) {
    console.error('[Health] Failed to run probes:', error);
    return {
      ok: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to run health probes'
    };
  }
}
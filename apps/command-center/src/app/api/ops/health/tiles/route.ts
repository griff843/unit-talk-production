import { NextRequest, NextResponse } from 'next/server';
import { isConfigured, createNotConfiguredResponse } from '@/server/env';
import { getCanonicalHealthTiles } from '@/server/health';

/**
 * GET /api/ops/health/tiles - Canonical health tiles endpoint
 * This is the source of truth for all health monitoring data
 */

export async function GET(request: NextRequest) {
  try {
    // Check if system is properly configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    // Get canonical health tiles data
    const healthTiles = await getCanonicalHealthTiles();

    // Return canonical format with ISO timestamp
    return NextResponse.json(healthTiles, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
      },
    });

  } catch (error) {
    console.error('Health tiles GET error:', error);
    
    // Never throw - return safe fallback data
    const fallbackTiles = await getCanonicalHealthTiles();
    return NextResponse.json(fallbackTiles, { status: 200 });
  }
}
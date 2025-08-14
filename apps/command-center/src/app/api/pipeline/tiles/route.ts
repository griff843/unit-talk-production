import { NextRequest, NextResponse } from 'next/server'
import { getCanonicalHealthTiles, convertToLegacyFormat } from '@/server/health'

/**
 * GET /api/pipeline/tiles - Legacy health tiles endpoint
 * @deprecated Use /api/ops/health/tiles by 2025-09-30
 * TODO: Remove after cutover date
 */
export async function GET(request: NextRequest) {
  try {
    // Get canonical health tiles
    const canonicalTiles = await getCanonicalHealthTiles();
    
    // Convert to legacy format for backward compatibility
    const legacyTiles = convertToLegacyFormat(canonicalTiles);
    
    // Include canonical fields alongside legacy ones for migration
    const response = {
      // Legacy fields for backward compatibility
      ...legacyTiles,
      // Always include canonical fields to ease migration
      ...canonicalTiles,
    };

    return NextResponse.json(response, {
      headers: {
        'X-Deprecation': 'Use /api/ops/health/tiles by 2025-09-30',
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
      },
    });

  } catch (error) {
    console.error('Legacy health tiles GET error:', error);
    
    // Never throw - return safe fallback data
    const fallbackTiles = await getCanonicalHealthTiles();
    const legacyFallback = convertToLegacyFormat(fallbackTiles);
    
    return NextResponse.json({ 
      ...legacyFallback, 
      ...fallbackTiles 
    }, {
      status: 200,
      headers: {
        'X-Deprecation': 'Use /api/ops/health/tiles by 2025-09-30',
      },
    });
  }
}
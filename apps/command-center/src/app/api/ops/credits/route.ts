import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/ops/credits
 *
 * Fetches credit usage summary from Supabase RPC
 * Returns aggregated credit usage by provider for Command Center
 */
export async function GET(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          data: [],
          error: {
            code: 'ENV_MISSING',
            message: 'Supabase configuration missing',
            available: false
          },
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Try to call the RPC function
    const { data, error } = await supabase.rpc('get_credit_usage_summary');

    if (error) {
      console.error('Credit usage RPC error:', error);

      // Return empty data with error info for client handling
      return NextResponse.json({
        data: [],
        error: {
          code: error.code,
          message: error.message,
          available: false
        },
        timestamp: new Date().toISOString()
      });
    }

    // Success - return the data
    return NextResponse.json({
      data: data || [],
      error: null,
      timestamp: new Date().toISOString(),
      summary: {
        totalProviders: (data || []).length,
        totalCredits: (data || []).reduce((sum: number, row: any) => sum + (row.credits || 0), 0),
        totalCalls: (data || []).reduce((sum: number, row: any) => sum + (row.calls || 0), 0)
      }
    });

  } catch (err: any) {
    console.error('Credits API error:', err);

    return NextResponse.json(
      {
        data: [],
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message,
          available: false
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ops/credits/flush
 *
 * Triggers immediate credit logger flush for testing
 * Should only be available in non-production environments
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development/staging
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'Flush endpoint not available in production',
          timestamp: new Date().toISOString()
        },
        { status: 403 }
      );
    }

    // This would need to be adapted for the Command Center context
    // since it doesn't have direct access to the API service
    return NextResponse.json({
      message: 'Credit flush endpoint not implemented in Command Center',
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Credit flush error:', err);

    return NextResponse.json(
      {
        error: 'Failed to flush credits',
        message: err.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /ops/credits
 *
 * Fetches credit usage summary from Supabase RPC
 * Returns aggregated credit usage by provider
 */
export async function getCreditsHandler(req: Request, res: Response): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      res.status(500).json({
        error: 'Supabase configuration missing',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Try to call the RPC function
    const { data, error } = await supabase.rpc('get_credit_usage_summary');

    if (error) {
      console.error('Credit usage RPC error:', error);

      // Return empty data with error info for client handling
      res.status(200).json({
        data: [],
        error: {
          code: error.code,
          message: error.message,
          available: false
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Success - return the data
    res.status(200).json({
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

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /ops/credits/flush
 *
 * Triggers immediate credit logger flush for testing
 * Should only be available in non-production environments
 */
export async function flushCreditsHandler(req: Request, res: Response): Promise<void> {
  try {
    // Only allow in development/staging
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        error: 'Flush endpoint not available in production',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Import and flush credit logger
    const { creditLogger } = await import('../../services/creditLogger.js');
    await creditLogger.flush();

    res.status(200).json({
      message: 'Credit logger flushed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Credit flush error:', err);

    res.status(500).json({
      error: 'Failed to flush credits',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
}
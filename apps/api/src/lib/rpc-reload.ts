/**
 * RPC-based PostgREST Reload Service
 *
 * Dashboard-free PostgREST schema reload using SECURITY DEFINER RPC.
 * Replaces direct pg_notify with RPC call for better security and auditability.
 *
 * Charter Compliance:
 * - Canonical-first: Required for PICK_DRIVER=canonical self-healing
 * - Dashboard-free: No manual intervention needed
 * - Secure: Uses SECURITY DEFINER RPC, no direct superuser access
 * - Auditable: All reloads logged to schema_reload_log table
 *
 * Date: 2025-10-29
 * Version: 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
// @ts-ignore - Import from outside rootDir (shared utility)
import { rootLogger as logger } from '../../../shared/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RpcReloadResult {
  success: boolean;
  reloadedAt: string;
  reloadId: string;
  error?: string;
  triggeredBy: string;
  reason?: string;
}

export interface RpcReloadOptions {
  triggeredBy?: string;
  reason?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface PgrStReloadRpcResponse {
  success: boolean;
  reloaded_at: string;
  reload_id: string;
}

// ============================================================================
// RPC RELOAD SERVICE
// ============================================================================

export class RpcReloadService {
  private supabase: SupabaseClient;
  private static instance: RpcReloadService | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for RpcReloadService');
    }

    this.supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RpcReloadService {
    if (!RpcReloadService.instance) {
      RpcReloadService.instance = new RpcReloadService();
    }
    return RpcReloadService.instance;
  }

  /**
   * Call pgrst_reload RPC to trigger PostgREST schema reload
   */
  async reload(options: RpcReloadOptions = {}): Promise<RpcReloadResult> {
    const {
      triggeredBy = 'api',
      reason = null,
      maxRetries = 3,
      retryDelayMs = 1000,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Calling pgrst_reload RPC', {
          triggeredBy,
          reason,
          attempt,
          maxRetries,
        });

        // Call SECURITY DEFINER RPC
        const { data, error } = await this.supabase.rpc('pgrst_reload', {
          p_triggered_by: triggeredBy,
          p_reason: reason,
        });

        if (error) {
          throw new Error(`RPC call failed: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error('RPC returned no data');
        }

        const result = data[0] as PgrStReloadRpcResponse;

        if (!result.success) {
          throw new Error('RPC returned success=false');
        }

        logger.info('PostgREST schema reload successful (RPC)', {
          reloadId: result.reload_id,
          reloadedAt: result.reloaded_at,
          triggeredBy,
          reason,
          attempt,
        });

        return {
          success: true,
          reloadedAt: result.reloaded_at,
          reloadId: result.reload_id,
          triggeredBy,
          reason: reason || undefined,
        };
      } catch (error) {
        lastError = error as Error;

        logger.warn('PostgREST reload RPC attempt failed', {
          attempt,
          maxRetries,
          error: lastError.message,
          triggeredBy,
          reason,
        });

        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        }
      }
    }

    // All attempts failed
    logger.error('PostgREST reload RPC failed after all attempts', {
      maxRetries,
      error: lastError?.message,
      triggeredBy,
      reason,
    });

    return {
      success: false,
      reloadedAt: new Date().toISOString(),
      reloadId: 'failed',
      error: lastError?.message || 'Unknown error',
      triggeredBy,
      reason: reason || undefined,
    };
  }

  /**
   * Get recent reload history from log table
   */
  async getReloadHistory(limit = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('schema_reload_log')
        .select('*')
        .order('reloaded_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch reload history', { error: error.message });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to fetch reload history', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get reload success rate (last N reloads)
   */
  async getSuccessRate(limit = 100): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('schema_reload_log')
        .select('success')
        .order('reloaded_at', { ascending: false })
        .limit(limit);

      if (error || !data || data.length === 0) {
        return 0;
      }

      const successCount = data.filter((row) => row.success).length;
      return (successCount / data.length) * 100;
    } catch (error) {
      logger.error('Failed to calculate success rate', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Trigger PostgREST reload via RPC (convenience function)
 */
export async function rpcReload(options: RpcReloadOptions = {}): Promise<RpcReloadResult> {
  const service = RpcReloadService.getInstance();
  return service.reload(options);
}

/**
 * Get reload history (convenience function)
 */
export async function getReloadHistory(limit = 10): Promise<any[]> {
  const service = RpcReloadService.getInstance();
  return service.getReloadHistory(limit);
}

/**
 * Get reload success rate (convenience function)
 */
export async function getReloadSuccessRate(limit = 100): Promise<number> {
  const service = RpcReloadService.getInstance();
  return service.getSuccessRate(limit);
}

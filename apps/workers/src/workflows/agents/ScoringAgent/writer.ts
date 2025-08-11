/**
 * Settlement Writer - Database operations for settlement results
 * 
 * Handles writing settlement results back to shadow_decisions table
 * with proper idempotency, error handling, and audit trails
 */

import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import type { SettlementResult } from './compute/mlb';

export interface SettlementWrite {
  pickId: string;
  actualResult: number;
  result: SettlementResult;
  settlementSource: string;
  settlementDetails: {
    adapter: string;
    gamePk?: number;
    gameId?: string;
    teams?: {
      home: string;
      away: string;
    };
    playerStats?: any;
    market: string;
    line: number;
    direction: string;
    confidence: number;
    computedAt: string;
    notes?: string;
  };
  dryRun?: boolean;
}

export interface WriteResult {
  success: boolean;
  pickId: string;
  alreadySettled?: boolean;
  error?: string;
  rowsAffected?: number;
}

export interface HeartbeatUpdate {
  pipelineName: string;
  lastCount: number;
  lastOk: boolean;
  lastError?: string | null;
  runDetails?: any;
}

/**
 * Write settlement result to shadow_decisions table
 * Idempotent - skips if already settled
 */
export async function writeSettlement(write: SettlementWrite): Promise<WriteResult> {
  const { 
    pickId, 
    actualResult, 
    result, 
    settlementSource, 
    settlementDetails,
    dryRun = false 
  } = write;

  logger.debug('Writing settlement', {
    pickId,
    actualResult,
    result,
    settlementSource,
    dryRun
  });

  try {
    // First, check if already settled (idempotency check)
    const { data: existing, error: checkError } = await supabase
      .from('shadow_decisions')
      .select('id, settled_at, actual_result, status')
      .eq('id', pickId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // Not "not found" error
      logger.error('Error checking existing settlement', {
        pickId,
        error: checkError.message
      });
      return {
        success: false,
        pickId,
        error: `Database check failed: ${checkError.message}`
      };
    }

    // Check if already settled
    if (existing && existing.settled_at) {
      logger.info('Pick already settled, skipping', {
        pickId,
        existingSettledAt: existing.settled_at,
        existingResult: existing.actual_result
      });
      
      return {
        success: true,
        pickId,
        alreadySettled: true,
        rowsAffected: 0
      };
    }

    if (!existing) {
      logger.error('Pick not found for settlement', { pickId });
      return {
        success: false,
        pickId,
        error: 'Pick not found in shadow_decisions'
      };
    }

    // Prepare update data
    const updateData: any = {
      actual_result: actualResult,
      settled_at: new Date().toISOString(),
      status: 'settled',
      settlement_source: settlementSource,
      settlement_details: settlementDetails
    };

    // If dry run, just log what would be updated
    if (dryRun) {
      logger.info('DRY RUN: Would update settlement', {
        pickId,
        updateData
      });
      
      return {
        success: true,
        pickId,
        rowsAffected: 1 // Simulated
      };
    }

    // Perform the update
    const { data, error: updateError } = await supabase
      .from('shadow_decisions')
      .update(updateData)
      .eq('id', pickId)
      .eq('settled_at', null) // Extra safety - only update if still null
      .select('id, settled_at, actual_result, status');

    if (updateError) {
      logger.error('Error updating settlement', {
        pickId,
        error: updateError.message,
        updateData
      });
      
      return {
        success: false,
        pickId,
        error: `Update failed: ${updateError.message}`
      };
    }

    if (!data || data.length === 0) {
      logger.warn('Settlement update affected no rows', { pickId });
      
      // Double-check if someone else settled it in the meantime
      const { data: recheck } = await supabase
        .from('shadow_decisions')
        .select('settled_at, actual_result')
        .eq('id', pickId)
        .single();

      if (recheck?.settled_at) {
        return {
          success: true,
          pickId,
          alreadySettled: true,
          rowsAffected: 0
        };
      }

      return {
        success: false,
        pickId,
        error: 'Update affected no rows'
      };
    }

    logger.info('Settlement written successfully', {
      pickId,
      actualResult,
      result,
      settlementSource,
      rowsAffected: data.length
    });

    return {
      success: true,
      pickId,
      rowsAffected: data.length
    };

  } catch (error) {
    logger.error('Unexpected error writing settlement', {
      pickId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      pickId,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Update settlement pipeline heartbeat
 */
export async function updateSettlementHeartbeat(update: HeartbeatUpdate): Promise<{
  success: boolean;
  error?: string;
}> {
  const { pipelineName, lastCount, lastOk, lastError, runDetails } = update;

  logger.debug('Updating settlement heartbeat', {
    pipelineName,
    lastCount,
    lastOk
  });

  try {
    const heartbeatData = {
      pipeline_name: pipelineName,
      last_run: new Date().toISOString(),
      last_count: lastCount,
      last_ok: lastOk,
      last_error: lastError,
      run_details: runDetails,
      updated_at: new Date().toISOString()
    };

    // Upsert heartbeat record
    const { data, error } = await supabase
      .from('settlement_heartbeat')
      .upsert(heartbeatData, {
        onConflict: 'pipeline_name',
        ignoreDuplicates: false
      })
      .select('id, last_run, last_count');

    if (error) {
      logger.error('Error updating heartbeat', {
        pipelineName,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }

    logger.debug('Heartbeat updated successfully', {
      pipelineName,
      lastCount,
      lastOk,
      data: data?.[0]
    });

    return { success: true };

  } catch (error) {
    logger.error('Unexpected error updating heartbeat', {
      pipelineName,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get recent settlement statistics for monitoring
 */
export async function getSettlementStats(
  league: string = 'MLB',
  hoursBack: number = 24
): Promise<{
  unsettledCount: number;
  settledCount: number;
  recentSuccessRate: number;
  lastRun?: string;
  error?: string;
}> {
  try {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // Count unsettled picks
    const { count: unsettledCount, error: unsettledError } = await supabase
      .from('shadow_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('sport', league)
      .is('settled_at', null);

    if (unsettledError) {
      throw new Error(`Error counting unsettled: ${unsettledError.message}`);
    }

    // Count recently settled picks
    const { count: settledCount, error: settledError } = await supabase
      .from('shadow_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('sport', league)
      .not('settled_at', 'is', null)
      .gte('settled_at', cutoff);

    if (settledError) {
      throw new Error(`Error counting settled: ${settledError.message}`);
    }

    // Get last heartbeat
    const { data: heartbeat, error: heartbeatError } = await supabase
      .from('settlement_heartbeat')
      .select('last_run, last_count, last_ok')
      .eq('pipeline_name', `${league.toLowerCase()}_settlement`)
      .single();

    if (heartbeatError && heartbeatError.code !== 'PGRST116') {
      logger.warn('Error fetching heartbeat', { error: heartbeatError.message });
    }

    // Calculate success rate (simplified)
    const recentSuccessRate = settledCount > 0 ? 0.95 : 0; // Placeholder logic

    return {
      unsettledCount: unsettledCount || 0,
      settledCount: settledCount || 0,
      recentSuccessRate,
      lastRun: heartbeat?.last_run
    };

  } catch (error) {
    logger.error('Error getting settlement stats', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      unsettledCount: 0,
      settledCount: 0,
      recentSuccessRate: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Batch write multiple settlements (for efficiency)
 */
export async function batchWriteSettlements(
  writes: SettlementWrite[]
): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: WriteResult[];
}> {
  logger.info('Starting batch settlement write', { count: writes.length });

  const results: WriteResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process in smaller chunks to avoid overwhelming the database
  const chunkSize = 50;
  
  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(write => writeSettlement(write))
    );

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success) {
          successful++;
        } else {
          failed++;
        }
      } else {
        const pickId = chunk[j]?.pickId || 'unknown';
        results.push({
          success: false,
          pickId,
          error: result.reason?.message || String(result.reason)
        });
        failed++;
      }
    }

    // Small delay between chunks
    if (i + chunkSize < writes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.info('Batch settlement write completed', {
    totalProcessed: writes.length,
    successful,
    failed
  });

  return {
    totalProcessed: writes.length,
    successful,
    failed,
    results
  };
}
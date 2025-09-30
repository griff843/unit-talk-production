import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from './supabaseClient';

/**
 * Single-Writer Promoter Guard
 *
 * Ensures exactly one process can promote picks to avoid race conditions.
 * Uses database-level locking and idempotent promotion hashing.
 */
export class SingleWriterPromoterGuard {
  private supabase: SupabaseClient;
  private readonly lockTable = 'runtime_config';
  private readonly lockKey = 'promoter_lock';
  private readonly lockTimeout = 30000; // 30 seconds
  private currentLockId: string | null = null;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || supabaseClient;
  }

  /**
   * Acquire exclusive promotion lock
   */
  async acquireLock(processId: string, orgId: string = '00000000-0000-0000-0000-000000000000'): Promise<boolean> {
    try {
      const lockValue = {
        processId,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.lockTimeout
      };

      // Try to insert new lock or update expired lock
      const { data, error } = await this.supabase
        .from(this.lockTable)
        .upsert({
          key: this.lockKey,
          value: lockValue,
          org_id: orgId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        // If upsert failed, check if lock is expired
        const { data: existingLock } = await this.supabase
          .from(this.lockTable)
          .select('value')
          .eq('key', this.lockKey)
          .eq('org_id', orgId)
          .single();

        if (existingLock?.value?.expiresAt < Date.now()) {
          // Lock expired, try to claim it
          const { error: updateError } = await this.supabase
            .from(this.lockTable)
            .update({
              value: lockValue,
              updated_at: new Date().toISOString()
            })
            .eq('key', this.lockKey)
            .eq('org_id', orgId);

          if (!updateError) {
            this.currentLockId = processId;
            return true;
          }
        }
        return false;
      }

      this.currentLockId = processId;
      return true;
    } catch (error) {
      console.error('Failed to acquire promoter lock:', error);
      return false;
    }
  }

  /**
   * Release promotion lock
   */
  async releaseLock(processId: string, orgId: string = '00000000-0000-0000-0000-000000000000'): Promise<boolean> {
    try {
      // Only release if we own the lock
      const { data: currentLock } = await this.supabase
        .from(this.lockTable)
        .select('value')
        .eq('key', this.lockKey)
        .eq('org_id', orgId)
        .single();

      if (currentLock?.value?.processId !== processId) {
        console.warn(`Cannot release lock owned by different process: ${currentLock?.value?.processId}`);
        return false;
      }

      const { error } = await this.supabase
        .from(this.lockTable)
        .delete()
        .eq('key', this.lockKey)
        .eq('org_id', orgId);

      if (!error) {
        this.currentLockId = null;
        return true;
      }

      console.error('Failed to release promoter lock:', error);
      return false;
    } catch (error) {
      console.error('Error releasing promoter lock:', error);
      return false;
    }
  }

  /**
   * Check if lock is currently held by this process
   */
  hasLock(processId: string): boolean {
    return this.currentLockId === processId;
  }

  /**
   * Promote picks with single-writer guarantee
   */
  async promotePicksWithGuard(
    processId: string,
    pickIds: string[],
    promotionData: {
      promoted_by: string;
      promoted_at: string;
      stage: string;
    },
    orgId: string = '00000000-0000-0000-0000-000000000000'
  ): Promise<{ success: boolean; promoted: number; skipped: number; errors: string[] }> {

    const lockAcquired = await this.acquireLock(processId, orgId);
    if (!lockAcquired) {
      return {
        success: false,
        promoted: 0,
        skipped: pickIds.length,
        errors: ['Failed to acquire exclusive promotion lock']
      };
    }

    let promoted = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      for (const pickId of pickIds) {
        try {
          // Generate idempotent promotion hash
          const promotionHash = `${pickId}-${promotionData.promoted_at}-${promotionData.promoted_by}`;

          // Check if already promoted with this hash
          const { data: existing } = await this.supabase
            .from('unified_picks')
            .select('id, promoted_hash, stage')
            .eq('id', pickId)
            .eq('org_id', orgId)
            .single();

          if (existing?.promoted_hash === promotionHash) {
            skipped++;
            continue; // Already promoted with same hash
          }

          if (existing?.stage === 'promoted' && existing.promoted_hash) {
            skipped++;
            continue; // Already promoted by different process
          }

          // Perform atomic promotion update
          const { error: updateError } = await this.supabase
            .from('unified_picks')
            .update({
              ...promotionData,
              promoted_hash: promotionHash,
              published: true
            })
            .eq('id', pickId)
            .eq('org_id', orgId)
            .is('promoted_hash', null); // Only update if not already promoted

          if (updateError) {
            errors.push(`Pick ${pickId}: ${updateError.message}`);
          } else {
            promoted++;
          }
        } catch (error) {
          errors.push(`Pick ${pickId}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        promoted,
        skipped,
        errors
      };

    } finally {
      // Always release lock
      await this.releaseLock(processId, orgId);
    }
  }

  /**
   * Force clean expired locks (maintenance function)
   */
  async cleanExpiredLocks(orgId: string = '00000000-0000-0000-0000-000000000000'): Promise<number> {
    try {
      const now = Date.now();

      const { data: locks } = await this.supabase
        .from(this.lockTable)
        .select('key, value')
        .eq('org_id', orgId)
        .like('key', '%_lock');

      let cleaned = 0;

      for (const lock of locks || []) {
        if (lock.value?.expiresAt && lock.value.expiresAt < now) {
          const { error } = await this.supabase
            .from(this.lockTable)
            .delete()
            .eq('key', lock.key)
            .eq('org_id', orgId);

          if (!error) cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Error cleaning expired locks:', error);
      return 0;
    }
  }

  /**
   * Get current lock status
   */
  async getLockStatus(orgId: string = '00000000-0000-0000-0000-000000000000'): Promise<{
    locked: boolean;
    processId?: string;
    timestamp?: number;
    expiresAt?: number;
    expired?: boolean;
  }> {
    try {
      const { data: lock } = await this.supabase
        .from(this.lockTable)
        .select('value')
        .eq('key', this.lockKey)
        .eq('org_id', orgId)
        .single();

      if (!lock?.value) {
        return { locked: false };
      }

      const now = Date.now();
      const expired = lock.value.expiresAt < now;

      return {
        locked: !expired,
        processId: lock.value.processId,
        timestamp: lock.value.timestamp,
        expiresAt: lock.value.expiresAt,
        expired
      };
    } catch (error) {
      return { locked: false };
    }
  }
}
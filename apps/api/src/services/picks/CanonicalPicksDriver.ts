import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { rpcReload } from '../../lib/rpc-reload';
import { directInsertPick, type CanonicalPick } from '../../lib/canonical-direct-writer';
import type { IPicksDriver, PickSubmissionInput, PickData, PublishOptions, PublishData } from './types';

/**
 * CanonicalPicksDriver - Modern driver for picks + pick_publish tables
 *
 * This driver implements the canonical architecture with:
 * - picks table for core pick data
 * - pick_publish table for outbox pattern
 * - Full idempotency support
 * - Tenant isolation with RLS
 */
export class CanonicalPicksDriver implements IPicksDriver {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  /**
   * Insert pick into canonical picks table with full idempotency
   */
  async insertPick(input: PickSubmissionInput): Promise<PickData> {
    try {
      // Set tenant context for RLS
      await this.setTenantContext(input.tenantId, input.userId);

      // Generate idempotency key if not provided
      const idempotencyKey = input.idempotencyKey || this.generateIdempotencyKey(input);

      // Check for existing pick with same idempotency key
      const existing = await this.getPickByIdempotencyKey(idempotencyKey, input.tenantId);
      if (existing) {
        logger.info('Returning existing pick due to idempotency key match', {
          idempotencyKey,
          pickId: existing.id,
        });
        return existing;
      }

      // Check for duplicate bet_slip_id
      if (input.betSlipId) {
        const existingByBetSlip = await this.getPickByBetSlipId(input.betSlipId, input.tenantId);
        if (existingByBetSlip) {
          logger.info('Returning existing pick due to bet_slip_id match', {
            betSlipId: input.betSlipId,
            pickId: existingByBetSlip.id,
          });
          return existingByBetSlip;
        }
      }

      // Prepare pick data for canonical schema
      const pickData = {
        tenant_id: input.tenantId,
        user_id: input.userId,
        prop_id: input.playerId || null, // Will be resolved later if needed

        // Pick details
        selection: input.side,
        odds: input.odds || -110,
        stake: input.stake || 1.0,
        confidence: input.userScore || null,

        // Workflow
        workflow_stage: 'draft', // Start in draft, will be promoted
        status: 'pending',

        // Idempotency
        idempotency_key: idempotencyKey,
        bet_slip_id: input.betSlipId || null,

        // Metadata
        metadata: {
          ...input.metadata,
          league: input.league,
          player_name: input.playerName,
          market_type: input.marketType,
          line: input.line,
          game_id: input.gameId,
          game_date: input.gameDate,
          stake_text: input.stakeText,
          driver: 'canonical',
          created_via: 'smart_form_api',
        },
      };

      // Insert into picks table with schema cache retry logic
      let data: any;
      let error: any;
      let retryAttempted = false;

      try {
        // First attempt
        const result = await this.supabase
          .from('picks')
          .insert(pickData)
          .select('*')
          .single();

        data = result.data;
        error = result.error;
      } catch (firstError) {
        error = firstError;
      }

      // Check if error is due to stale PostgREST schema cache (PGRST205, visibility errors)
      if (error && /(column|relation).+does not exist|PGRST204|PGRST205/i.test(error.message)) {
        logger.warn('PostgREST visibility error detected, attempting RPC reload and retry', {
          error: error.message,
          errorCode: error.code,
          pickId: pickData.bet_slip_id,
          tenantId: input.tenantId,
        });

        try {
          // Step 1: Trigger RPC-based schema reload (dashboard-free)
          const reloadResult = await rpcReload({
            triggeredBy: 'canonical-insert-error',
            reason: `PGRST visibility error: ${error.message}`,
            maxRetries: 3,
          });

          retryAttempted = true;

          if (reloadResult.success) {
            logger.info('PostgREST RPC reload successful, waiting for cache refresh...', {
              reloadId: reloadResult.reloadId,
              tenantId: input.tenantId,
            });

            // Wait for PostgREST to process reload (2 seconds)
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Step 2: Retry insert via REST once
            const retryResult = await this.supabase
              .from('picks')
              .insert(pickData)
              .select('*')
              .single();

            data = retryResult.data;
            error = retryResult.error;

            if (!error) {
              logger.info('Pick insert succeeded after RPC reload + retry (REST)', {
                event: 'rpc_reload_retry_success',
                attempt: 1,
                pickId: data.id,
                reloadId: reloadResult.reloadId,
                tenantId: input.tenantId,
              });
            } else {
              logger.warn('Pick insert still failing after RPC reload + retry, falling back to direct SQL', {
                event: 'rpc_reload_retry_failed',
                attempt: 1,
                error: error.message,
                tenantId: input.tenantId,
              });

              // Step 3: Fallback to direct SQL (bypass PostgREST entirely)
              const directWritePick: CanonicalPick = {
                tenant_id: pickData.tenant_id,
                user_id: pickData.user_id,
                prop_id: pickData.prop_id,
                selection: pickData.selection,
                odds: pickData.odds,
                stake: pickData.stake,
                confidence: pickData.confidence,
                workflow_stage: pickData.workflow_stage,
                status: pickData.status,
                idempotency_key: pickData.idempotency_key,
                bet_slip_id: pickData.bet_slip_id,
                metadata: pickData.metadata,
              };

              const directResult = await directInsertPick(directWritePick);

              if (directResult.success && directResult.id) {
                logger.info('Pick insert succeeded via direct SQL fallback', {
                  event: 'direct_sql_fallback_success',
                  pickId: directResult.id,
                  tenantId: input.tenantId,
                  reloadId: reloadResult.reloadId,
                });

                // Fetch the inserted pick to return consistent data format
                const { data: fallbackPick, error: fallbackError } = await this.supabase
                  .from('picks')
                  .select('*')
                  .eq('id', directResult.id)
                  .single();

                if (!fallbackError && fallbackPick) {
                  data = fallbackPick;
                  error = null;
                } else {
                  // If we can't fetch via REST, construct data manually
                  data = {
                    id: directResult.id,
                    ...pickData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  error = null;
                }
              } else {
                logger.error('Direct SQL fallback also failed', {
                  event: 'direct_sql_fallback_failed',
                  error: directResult.error,
                  tenantId: input.tenantId,
                });
                // Keep original error for throwing below
              }
            }
          } else {
            logger.error('PostgREST RPC reload failed', {
              event: 'rpc_reload_failed',
              error: reloadResult.error,
              tenantId: input.tenantId,
            });
            // Keep original error for throwing below
          }
        } catch (reloadError) {
          logger.error('Failed during RPC reload or direct SQL fallback', {
            event: 'fallback_chain_error',
            reloadError: reloadError instanceof Error ? reloadError.message : String(reloadError),
            originalError: error.message,
            tenantId: input.tenantId,
          });
          // Keep original error for throwing below
        }
      }

      if (error) {
        throw new Error(`Failed to insert into picks: ${error.message}`);
      }

      logger.info('Pick inserted into canonical picks table successfully', {
        pickId: data.id,
        tenantId: input.tenantId,
        userId: input.userId,
        idempotencyKey,
      });

      return this.transformToPickData(data);
    } catch (error) {
      logger.error('Error inserting pick into canonical picks', {
        error: error instanceof Error ? error.message : String(error),
        input,
      });
      throw error;
    }
  }

  /**
   * Get pick by ID from canonical picks table
   */
  async getPickById(pickId: string, tenantId: string): Promise<PickData | null> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching pick from canonical picks', { pickId, error: error.message });
      return null;
    }

    if (!data) {
      return null;
    }

    return this.transformToPickData(data);
  }

  /**
   * Get pick by idempotency key
   */
  async getPickByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<PickData | null> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('picks')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.transformToPickData(data);
  }

  /**
   * Get pick by bet_slip_id
   */
  private async getPickByBetSlipId(betSlipId: string, tenantId: string): Promise<PickData | null> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('picks')
      .select('*')
      .eq('bet_slip_id', betSlipId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.transformToPickData(data);
  }

  /**
   * Create publish record in pick_publish table (outbox pattern)
   */
  async createPublishRecord(pickId: string, tenantId: string, options: PublishOptions): Promise<PublishData> {
    await this.setTenantContext(tenantId);

    const publishData = {
      pick_id: pickId,
      tenant_id: tenantId,
      channel: options.channel,
      status: 'pending' as const,
      thread_id: options.threadId || null,
      scheduled_for: options.scheduledFor?.toISOString() || null,
      metadata: options.metadata || {},
    };

    // Insert with schema cache retry logic
    let data: any;
    let error: any;

    try {
      const result = await this.supabase
        .from('pick_publish')
        .insert(publishData)
        .select('*')
        .single();

      data = result.data;
      error = result.error;
    } catch (firstError) {
      error = firstError;
    }

    // Retry on stale schema cache
    if (error && /(column|relation).+does not exist|PGRST204|PGRST205/i.test(error.message)) {
      logger.warn('PostgREST visibility error on pick_publish, attempting RPC reload and retry', {
        error: error.message,
        errorCode: error.code,
        pickId,
        tenantId,
      });

      try {
        // Trigger RPC-based schema reload
        const reloadResult = await rpcReload({
          triggeredBy: 'pick-publish-insert-error',
          reason: `PGRST visibility error on pick_publish: ${error.message}`,
          maxRetries: 3,
        });

        if (reloadResult.success) {
          logger.info('PostgREST RPC reload successful for pick_publish, waiting for cache refresh...', {
            reloadId: reloadResult.reloadId,
            pickId,
          });

          // Wait for PostgREST to process reload
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const retryResult = await this.supabase
            .from('pick_publish')
            .insert(publishData)
            .select('*')
            .single();

          data = retryResult.data;
          error = retryResult.error;

          if (!error) {
            logger.info('Publish record insert succeeded after RPC reload + retry', {
              event: 'rpc_reload_retry_success',
              attempt: 1,
              publishId: data.id,
              reloadId: reloadResult.reloadId,
            });
          }
        }
      } catch (reloadError) {
        logger.error('Failed during RPC reload or retry for pick_publish', {
          event: 'pick_publish_reload_error',
          attempt: 1,
          success: false,
          error: reloadError instanceof Error ? reloadError.message : String(reloadError),
        });
      }
    }

    if (error) {
      throw new Error(`Failed to create publish record: ${error.message}`);
    }

    logger.info('Publish record created successfully', {
      publishId: data.id,
      pickId,
      channel: options.channel,
    });

    return {
      id: data.id,
      pickId: data.pick_id,
      channel: data.channel,
      status: data.status,
      threadId: data.thread_id,
      externalMessageId: data.external_message_id,
      attempts: data.attempts,
      sentAt: data.sent_at,
      createdAt: data.created_at,
    };
  }

  /**
   * Update publish record status
   */
  async updatePublishStatus(
    publishId: string,
    status: PublishData['status'],
    metadata?: Record<string, any>
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (metadata) {
      updateData.metadata = metadata;
    }

    // Set external_message_id if provided in metadata
    if (metadata?.externalMessageId) {
      updateData.external_message_id = metadata.externalMessageId;
    }

    // Set error message if failed
    if (status === 'failed' && metadata?.error) {
      updateData.last_error = metadata.error;
      updateData.next_retry_at = this.calculateNextRetry(metadata.attempts || 0);
    }

    const { error } = await this.supabase
      .from('pick_publish')
      .update(updateData)
      .eq('id', publishId);

    if (error) {
      throw new Error(`Failed to update publish status: ${error.message}`);
    }

    logger.info('Publish status updated successfully', { publishId, status });
  }

  /**
   * Check if canonical tables exist (runtime DDL check)
   */
  async checkTablesExist(): Promise<boolean> {
    try {
      // Check picks table
      const { error: picksError } = await this.supabase
        .from('picks')
        .select('id')
        .limit(1);

      if (picksError) {
        logger.warn('Canonical picks table not found', { error: picksError.message });
        return false;
      }

      // Check pick_publish table
      const { error: publishError } = await this.supabase
        .from('pick_publish')
        .select('id')
        .limit(1);

      if (publishError) {
        logger.warn('pick_publish table not found', { error: publishError.message });
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set tenant context for RLS policies
   */
  private async setTenantContext(tenantId: string, userId?: string): Promise<void> {
    try {
      await this.supabase.rpc('set_tenant_context', {
        p_tenant_id: tenantId,
        p_user_id: userId || null,
      });
    } catch (error) {
      logger.warn('Failed to set tenant context', {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
    }
  }

  /**
   * Generate idempotency key from pick details
   */
  private generateIdempotencyKey(input: PickSubmissionInput): string {
    const date = input.gameDate || new Date().toISOString().split('T')[0];
    const uniqueString = `${input.tenantId}-${input.userId}-${input.playerId || input.playerName}-${input.marketType}-${input.line}-${input.side}-${date}`;
    return createHash('sha256').update(uniqueString).digest('hex');
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(attempts: number): string {
    const delays = [60, 300, 900]; // 1min, 5min, 15min
    const delaySeconds = delays[Math.min(attempts, delays.length - 1)];
    const nextRetry = new Date(Date.now() + delaySeconds * 1000);
    return nextRetry.toISOString();
  }

  /**
   * Transform canonical picks row to PickData
   */
  private transformToPickData(row: any): PickData {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      pickId: row.id,
      propId: row.prop_id,
      selection: row.selection,
      odds: row.odds,
      stake: row.stake,
      confidence: row.confidence,
      workflowStage: row.workflow_stage,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      betSlipId: row.bet_slip_id,
      createdAt: row.created_at,
      metadata: row.metadata,
    };
  }
}

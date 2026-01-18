import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { transformAndInsert } from '../../lib/unified-schema-shim';
import type { IPicksDriver, PickSubmissionInput, PickData, PublishOptions, PublishData } from './types';

/**
 * UnifiedPicksDriver - Legacy driver for unified_picks table
 *
 * This driver maintains compatibility with the existing unified_picks schema
 * while the system transitions to the canonical picks architecture.
 */
export class UnifiedPicksDriver implements IPicksDriver {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  /**
   * Insert pick into unified_picks table
   */
  async insertPick(input: PickSubmissionInput): Promise<PickData> {
    try {
      // Transform to unified_picks schema
      // Map to actual v3.0.0 unified_picks schema columns
      // Only set columns that exist in the schema
      const pickData: Record<string, any> = {
        // Required fields
        user_id: input.userId,
        sport: input.league,
        player_name: input.playerName || 'Unknown Player',
        stat_type: input.marketType,
        line: input.line,
        odds: input.odds || -110,

        // Pick direction/selection
        direction: input.side.toLowerCase(), // 'over' or 'under'

        // Stake and confidence
        unit_size: input.stake || 1.0,
        confidence_score: input.userScore ? input.userScore * 10 : 75, // Convert 1-10 to 10-100

        // Status fields
        play_status: 'pending',

        // Metadata - store additional fields as JSONB
        metadata: {
          player_name: input.playerName,
          market_type: input.marketType,
          game_date: input.gameDate,
          game_id: input.gameId,
          bet_slip_id: input.betSlipId,
          tenant_id: input.tenantId,
          idempotency_key: input.idempotencyKey,
          user_score: input.userScore,
          driver: 'unified',
          created_via: 'smart_form_api',
          ...input.metadata,
        },
      };

      // Add optional fields only if they exist in metadata
      // These fields are not part of the core PickSubmissionInput type
      // but may be passed via metadata for advanced use cases
      const extended = input as any;
      if (extended.propId) pickData.raw_prop_id = extended.propId;
      if (extended.tier) pickData.tier = extended.tier;
      if (extended.score) pickData.score = extended.score;
      if (extended.professionalScore) pickData.professional_score = extended.professionalScore;
      if (extended.deviggedEdge) pickData.devigged_edge = extended.deviggedEdge;
      if (extended.kellyFraction) pickData.kelly_fraction = extended.kellyFraction;
      if (extended.clvTrackingId) pickData.clv_tracking_id = extended.clvTrackingId;
      if (extended.deviggedWinProb) pickData.devigged_win_prob = extended.deviggedWinProb;
      if (extended.clvPct) pickData.clv_pct = extended.clvPct;
      if (extended.risk) pickData.risk = extended.risk;
      if (extended.gradingStatus) pickData.grading_status = extended.gradingStatus;
      if (extended.stage) pickData.stage = extended.stage;
      if (extended.isInstant !== undefined) pickData.is_instant = extended.isInstant;
      if (extended.groupKey) pickData.group_key = extended.groupKey;

      // Check for existing pick with same idempotency key
      if (input.idempotencyKey) {
        const existing = await this.getPickByIdempotencyKey(input.idempotencyKey, input.tenantId);
        if (existing) {
          logger.info('Returning existing pick due to idempotency key match', {
            idempotencyKey: input.idempotencyKey,
            pickId: existing.id,
          });
          return existing;
        }
      }

      // Check for duplicate bet_slip_id (disabled - column may not exist in all schemas)
      // if (input.betSlipId) {
      //   const { data: existing } = await this.supabase
      //     .from('unified_picks')
      //     .select('*')
      //     .eq('bet_slip_id', input.betSlipId)
      //     .maybeSingle();

      //   if (existing) {
      //     logger.info('Returning existing pick due to bet_slip_id match', {
      //       betSlipId: input.betSlipId,
      //       pickId: existing.id,
      //     });
      //     return this.transformToPickData(existing, input.tenantId);
      //   }
      // }

      // Insert into unified_picks with schema shim
      const result = await transformAndInsert(
        pickData,
        this.supabase,
        'unified_picks',
        {
          tenantId: input.tenantId,
          userId: input.userId,
          betSlipId: input.betSlipId,
        }
      );

      if (!result.success || !result.data) {
        throw new Error(
          `Failed to insert into unified_picks: ${result.error?.message || 'Unknown error'}`
        );
      }

      logger.info('Pick inserted into unified_picks successfully', {
        pickId: result.data.id,
        tenantId: input.tenantId,
        userId: input.userId,
        reloadAttempted: result.reloadAttempted,
        retryCount: result.retryCount,
      });

      return this.transformToPickData(result.data, input.tenantId);
    } catch (error) {
      logger.error('Error inserting pick into unified_picks', {
        error: error instanceof Error ? error.message : String(error),
        input,
      });
      throw error;
    }
  }

  /**
   * Get pick by ID from unified_picks
   */
  async getPickById(pickId: string, tenantId: string): Promise<PickData | null> {
    const { data, error } = await this.supabase
      .from('unified_picks')
      .select('*')
      .eq('id', pickId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching pick from unified_picks', { pickId, error: error.message });
      return null;
    }

    if (!data) {
      return null;
    }

    return this.transformToPickData(data, tenantId);
  }

  /**
   * Get pick by idempotency key
   */
  async getPickByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<PickData | null> {
    const { data, error } = await this.supabase
      .from('unified_picks')
      .select('*')
      .eq('metadata->>idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.transformToPickData(data, tenantId);
  }

  /**
   * Check if unified_picks table exists
   */
  async checkTablesExist(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('unified_picks')
        .select('id')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Transform unified_picks row to PickData
   */
  private transformToPickData(row: any, tenantId: string): PickData {
    return {
      id: row.id,
      tenantId: tenantId,
      userId: row.capper || row.metadata?.user_id || 'unknown',
      selection: row.direction,
      odds: row.odds || -110,
      stake: row.unit_size || 1.0,
      confidence: row.confidence_score ? Math.round(row.confidence_score / 10) : undefined,
      status: row.play_status || 'pending',
      idempotencyKey: row.metadata?.idempotency_key,
      betSlipId: row.bet_slip_id,
      createdAt: row.created_at,
      metadata: row.metadata,
    };
  }

  /**
   * Not implemented for unified driver (legacy doesn't support outbox)
   */
  async createPublishRecord(_pickId: string, _tenantId: string, _options: PublishOptions): Promise<PublishData> {
    throw new Error('UnifiedPicksDriver does not support publish records - use direct publishing');
  }

  /**
   * Not implemented for unified driver
   */
  async updatePublishStatus(_publishId: string, _status: PublishData['status']): Promise<void> {
    throw new Error('UnifiedPicksDriver does not support publish status updates');
  }
}

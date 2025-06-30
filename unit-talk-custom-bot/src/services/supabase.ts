import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase-complete';
import { UserProfile, UserTier } from '../types/index';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import {
  databaseService,
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
  UserPicksRow
} from './database';

/**
 * Legacy Supabase service - now uses the new strictly typed DatabaseService
 * This maintains backward compatibility while providing strict typing
 * @deprecated Use DatabaseService directly for new code
 */
export class SupabaseService {
  public client: SupabaseClient<Database>;

  constructor() {
    if (!botConfig.supabase?.url || !botConfig.supabase?.serviceRoleKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.client = createClient<Database>(
      botConfig.supabase.url,
      botConfig.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  // ==================== USER PROFILE OPERATIONS ====================

  /**
   * @deprecated Use databaseService.getUserProfile() instead
   */
  async getUserProfile(discordId: string): Promise<UserProfile | null> {
    try {
      const profile = await databaseService.getUserProfile(discordId);
      return profile ? this.mapUserProfileRowToLegacy(profile) : null;
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.createUserProfile() instead
   */
  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const insertData: UserProfileInsert = {
        discord_id: profile.discord_id!,
        username: profile.username || null,
        discriminator: profile.discriminator || null,
        avatar: profile.avatar_url || null,
        tier: profile.tier || 'member',
        subscription_tier: this.mapTierToSubscription(profile.tier || 'member'),
        metadata: {}
      };

      const result = await databaseService.createUserProfile(insertData);
      return result ? this.mapUserProfileRowToLegacy(result) : null;
    } catch (error) {
      logger.error('Error creating user profile:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.updateUserProfile() instead
   */
  async updateUserProfile(discordId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const updateData: UserProfileUpdate = {};
      
      // Map legacy fields to new schema
      if (updates.tier !== undefined) updateData.tier = updates.tier;
      if (updates.username !== undefined) updateData.username = updates.username;
      if (updates.avatar_url !== undefined) updateData.avatar = updates.avatar_url;
      if (updates.discriminator !== undefined) updateData.discriminator = updates.discriminator;
      if (updates.last_active !== undefined) {
        updateData.last_active = typeof updates.last_active === 'string'
          ? updates.last_active
          : updates.last_active.toISOString();
      }

      const result = await databaseService.updateUserProfile(discordId, updateData);
      return result ? this.mapUserProfileRowToLegacy(result) : null;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.getUserPicks() instead
   */
  async getUserPicks(discordId: string, limit = 10): Promise<any[]> {
    try {
      const picks = await databaseService.getUserPicks(discordId, { limit });
      return picks.map(pick => this.mapUserPickRowToLegacy(pick));
    } catch (error) {
      logger.error('Error fetching user picks:', error);
      return [];
    }
  }

  /**
   * @deprecated Use databaseService.createUserPick() instead
   */
  async createPick(pick: Partial<any>): Promise<any | null> {
    try {
      // Try to create as final pick first (legacy behavior)
      const finalPickResult = await databaseService.createFinalPick({
        capper_id: pick.capper_id || pick.user_id || '',
        player_id: pick.player_id || '',
        game_id: pick.game_id || '',
        stat_type: pick.stat_type || '',
        line: pick.line || 0,
        odds: pick.odds || 0,
        stake: pick.stake || 0,
        payout: pick.payout || 0,
        result: pick.result || 'pending',
        actual_value: pick.actual_value || 0,
        tier: pick.tier || 'member',
        ticket_type: pick.ticket_type || 'single',
        sport: pick.sport || '',
        league: pick.league || '',
        confidence: pick.confidence || 0,
        analysis: pick.analysis || null,
        metadata: pick.metadata || null
      });

      return finalPickResult;
    } catch (error) {
      logger.error('Error creating pick:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.updateFinalPick() instead
   */
  async updatePick(pickId: string, updates: Partial<any>): Promise<any | null> {
    try {
      const result = await databaseService.updateFinalPick(pickId, updates);
      return result;
    } catch (error) {
      logger.error('Error updating pick:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.getFinalPicks() instead
   */
  async getPick(pickId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('final_picks')
        .select('*')
        .eq('id', pickId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting pick:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.trackUserActivity() instead
   */
  async trackUserActivity(discordId: string, activityType: string, metadata?: Record<string, any>): Promise<void> {
    try {
      await databaseService.trackUserActivity(discordId, activityType, metadata);
    } catch (error) {
      logger.error('Error tracking user activity:', error);
    }
  }

  /**
   * @deprecated Use databaseService.getUserPickStats() instead
   */
  async incrementUserStats(discordId: string, statType: 'messages' | 'reactions', increment = 1): Promise<void> {
    try {
      const profile = await databaseService.getUserProfile(discordId);
      if (!profile) return;

      // Legacy behavior - just track activity
      await databaseService.trackUserActivity(discordId, statType, { increment });
    } catch (error) {
      logger.error('Error incrementing user stats:', error);
    }
  }

  /**
   * @deprecated Use databaseService.getUserTier() instead
   */
  async getUserTier(discordId: string): Promise<UserTier> {
    try {
      return await databaseService.getUserTier(discordId);
    } catch (error) {
      logger.error('Error getting user tier:', error);
      return 'member';
    }
  }

  /**
   * @deprecated Use databaseService.updateUserProfile() instead
   */
  async updateUserActivity(discordId: string, activityData: Record<string, any>): Promise<void> {
    try {
      await databaseService.updateUserProfile(discordId, {
        last_active: new Date().toISOString(),
        metadata: activityData
      });
    } catch (error) {
      logger.error('Error updating user activity:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use databaseService.upsertUserCooldown() instead
   */
  async upsertUserCooldown(userId: string, action: string, expiresAt: Date): Promise<void> {
    try {
      await databaseService.upsertUserCooldown({
        user_id: userId,
        discord_id: userId,
        command_type: action,
        expires_at: expiresAt.toISOString()
      });
    } catch (error) {
      logger.error('Error upserting user cooldown:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use databaseService.upsertUserProfile() instead
   */
  async createOrUpdateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<any> {
    try {
      const insertData: UserProfileInsert = {
        discord_id: userId,
        username: profile.username || null,
        discriminator: profile.discriminator || null,
        avatar: profile.avatar_url || null,
        tier: profile.tier || 'member',
        subscription_tier: this.mapTierToSubscription(profile.tier || 'member'),
        metadata: profile.metadata || {}
      };

      const result = await databaseService.upsertUserProfile(insertData);
      return result ? this.mapUserProfileRowToLegacy(result) : null;
    } catch (error) {
      logger.error('Error creating/updating user profile:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use databaseService.updateUserTier() instead
   */
  async updateUserTier(userId: string, tier: UserTier): Promise<void> {
    try {
      await databaseService.updateUserTier(userId, tier);
    } catch (error) {
      logger.error('Error updating user tier:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use databaseService.updateUserProfile() instead
   */
  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      await databaseService.updateUserProfile(userId, {
        metadata: { isActive }
      });
    } catch (error) {
      logger.error('Error updating user status:', error);
      throw error;
    }
  }

  // ==================== MAPPING FUNCTIONS ====================

  /**
   * Map new UserProfileRow to legacy UserProfile interface
   */
  private mapUserProfileRowToLegacy(profile: UserProfileRow): UserProfile {
    return {
      id: profile.id,
      discord_id: profile.discord_id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar_url: profile.avatar,
      tier: profile.tier,
      subscription_tier: profile.subscription_tier,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      last_active: profile.last_active,
      metadata: profile.metadata,
      // Legacy fields that might be expected
      total_picks: 0,
      winning_picks: 0,
      losing_picks: 0,
      pending_picks: 0,
      total_units: 0,
      units_won: 0,
      units_lost: 0,
      win_rate: 0,
      roi: 0,
      streak: 0,
      best_streak: 0,
      worst_streak: 0,
      average_odds: 0,
      total_profit: 0
    };
  }

  /**
   * Map UserPicksRow to legacy pick format
   */
  private mapUserPickRowToLegacy(pick: UserPicksRow): any {
    return {
      id: pick.id,
      user_id: pick.user_id,
      discord_id: pick.discord_id,
      game_id: pick.game_id,
      thread_id: pick.thread_id,
      pick_type: pick.pick_type,
      player_name: pick.player_name,
      stat_type: pick.stat_type,
      line: pick.line,
      over_under: pick.over_under,
      odds: pick.odds,
      stake: pick.stake,
      confidence: pick.confidence,
      reasoning: pick.reasoning,
      result: pick.result,
      actual_value: pick.actual_value,
      profit_loss: pick.profit_loss,
      created_at: pick.created_at,
      updated_at: pick.updated_at,
      metadata: pick.metadata
    };
  }

  /**
   * Map tier to subscription tier
   */
  private mapTierToSubscription(tier: UserTier): 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS' {
    switch (tier) {
      case 'vip_plus':
        return 'VIP_PLUS';
      case 'vip':
        return 'VIP';
      case 'staff':
      case 'admin':
      case 'owner':
        return 'VIP_PLUS';
      default:
        return 'FREE';
    }
  }

  // ==================== DIRECT ACCESS TO NEW SERVICE ====================

  /**
   * Get direct access to the new DatabaseService
   * Use this for new code that wants strict typing
   */
  get database(): typeof databaseService {
    return databaseService;
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();
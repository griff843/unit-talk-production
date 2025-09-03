import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Temporarily relax Database typing during schema sync to avoid "never" overload errors
// import { Database } from '../db/types/supabase-complete';
import { UserProfile, UserTier } from '../types/index';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import {
  toISOString,
  toDate,
  getHours,
  getMinutes,
  getFullYear,
  getMonth,
  getDate,
} from '../utils/dateUtils';
import {
  databaseService,
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
  UserPicksRow,
} from './database';

interface Pick {
  user_id: string;
  sport: string;
  pick_type: string;
  team_name: string;
  odds: number;
  units: number;
  confidence: number;
  status?: string;
  result_type?: string;
  profit_loss?: number;
  notes?: string;
}

interface PickAnalytics {
  total_picks: number;
  won_picks: number;
  lost_picks: number;
  pushed_picks: number;
  total_units_risked: number;
  total_units_won: number;
  total_units_lost: number;
  roi: number;
  win_rate: number;
  average_odds: number;
}

/**
 * Legacy Supabase service - now uses the new strictly typed DatabaseService
 * This maintains backward compatibility while providing strict typing
 * @deprecated Use DatabaseService directly for new code
 */
export class SupabaseService {
  public client: SupabaseClient;

  constructor() {
    if (!botConfig.supabase?.url || !botConfig.supabase?.serviceRoleKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.client = createClient(
      botConfig.supabase.url,
      botConfig.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  public isInitialized(): boolean {
    return true; // This method is not directly related to the new DatabaseService, so it remains as is.
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
        metadata: {},
      };

      const result = await databaseService.createUserProfile(insertData);
      return result ? this.mapUserProfileRowToLegacy(result) : null;
    } catch (error) {
      logger.error('Error creating user profile:', {
        error,
        profile,
      });
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.updateUserProfile() instead
   */
  async updateUserProfile(
    discordId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    try {
      const updateData: UserProfileUpdate = {};

      // Map legacy fields to new schema
      if (updates.tier !== undefined) updateData.tier = updates.tier;
      if (updates.username !== undefined) updateData.username = updates.username;
      if (updates.avatar_url !== undefined) updateData.avatar = updates.avatar_url;
      if (updates.discriminator !== undefined) updateData.discriminator = updates.discriminator;
      if (updates.last_active !== undefined) {
        updateData.last_active =
          typeof updates.last_active === 'string'
            ? updates.last_active
            : typeof updates.last_active === 'string'
              ? updates.last_active
              : new Date(updates.last_active).toISOString();
      }

      const result = await databaseService.updateUserProfile(discordId, updateData);
      return result ? this.mapUserProfileRowToLegacy(result) : null;
    } catch (error) {
      logger.error('Error updating user profile:', {
        error,
        discordId,
        updates,
      });
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
      const finalPickResult = await databaseService.createUnifiedPick({
        capper_id: pick.capper_id || pick.user_id || '',
        player_id: pick.player_id || '',
        game_id: pick.gameId || '',
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
        metadata: pick.metadata || null,
      });

      return finalPickResult;
    } catch (error) {
      logger.error('Error creating pick:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.updateUnifiedPick() instead
   */
  async updatePick(pickId: string, updates: Partial<any>): Promise<any | null> {
    try {
      const result = await databaseService.updateUnifiedPick(pickId, updates);
      return result;
    } catch (error) {
      logger.error('Error updating pick:', error);
      return null;
    }
  }

  /**
   * @deprecated Use databaseService.getUnifiedPicks() instead
   */
  async getPick(pickId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('unified_picks')
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
  async trackUserActivity(
    discordId: string,
    activityType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await databaseService.trackUserActivity(discordId, activityType, metadata);
    } catch (error) {
      logger.error('Error tracking user activity:', error);
    }
  }

  /**
   * @deprecated Use databaseService.getUserPickStats() instead
   */
  async incrementUserStats(
    discordId: string,
    statType: 'messages' | 'reactions',
    increment = 1
  ): Promise<void> {
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
        last_active: toISOString(new Date()),
        metadata: activityData,
      });
    } catch (error) {
      logger.error('Error updating user activity:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use databaseService.upsertUserCooldown() instead
   */
  async upsertUserCooldown(userId: string, action: string, expiresAt: string): Promise<void> {
    try {
      await databaseService.upsertUserCooldown({
        user_id: userId,
        discord_id: userId,
        command_type: action,
        expires_at: expiresAt,
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
        metadata: profile.metadata || {},
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
        metadata: { isActive },
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
      total_profit: 0,
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
      metadata: pick.metadata,
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

  // Portfolio System Methods

  async submitPick(pick: Pick): Promise<boolean> {
    try {
      const { error } = await this.client.from('picks').insert([pick]);

      if (error) throw error;
      logger.info(`Pick submitted for user ${pick.user_id}`);
      return true;
    } catch (error) {
      logger.error('Error submitting pick:', error);
      return false;
    }
  }

  async updatePickStatus(pickId: string, status: string, profitLoss?: number): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('picks')
        .update({
          status,
          profit_loss: profitLoss,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickId);

      if (error) throw error;
      logger.info(`Pick ${pickId} status updated to ${status}`);
      return true;
    } catch (error) {
      logger.error('Error updating pick status:', error);
      return false;
    }
  }

  async getPickHistory(userId: string, limit: number = 10): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('picks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching pick history:', error);
      return [];
    }
  }

  async getPickAnalytics(userId: string): Promise<PickAnalytics | null> {
    try {
      const { data, error } = await this.client
        .from('pick_analytics')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching pick analytics:', error);
      return null;
    }
  }

  async getEdgeTrackerTrends(userId: string): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('pick_trends')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      logger.error('Error fetching edge tracker trends:', error);
      return null;
    }
  }

  // Alert System Methods

  async saveAlertPreferences(userId: string, preferences: any): Promise<boolean> {
    try {
      const { error } = await this.client.from('alert_preferences').upsert({
        user_id: userId,
        preferences,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      logger.info(`Alert preferences saved for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error saving alert preferences:', error);
      return false;
    }
  }

  async resetAlertPreferences(userId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('alert_preferences').delete().eq('user_id', userId);

      if (error) throw error;
      logger.info(`Alert preferences reset for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error resetting alert preferences:', error);
      return false;
    }
  }

  // Analytics Methods

  async getAnalyticsData(type: string): Promise<any> {
    try {
      let query;
      switch (type) {
        case 'performance':
          query = this.client.from('user_pick_stats').select('*');
          break;
        case 'trends':
          query = this.client.from('pick_trends').select('*');
          break;
        default:
          throw new Error(`Unknown analytics type: ${type}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching analytics data:', error);
      return null;
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();

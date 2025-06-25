import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../src/db/types/supabase';
import { UserProfile, UserTier } from '../types/index';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

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

  async getUserProfile(discordId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw error;
      }

      return data as UserProfile;
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      return null;
    }
  }

  async createUserProfile(profile: Partial<UserProfile>): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert([profile])
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    } catch (error) {
      logger.error('Error creating user profile:', error);
      return null;
    }
  }

  async updateUserProfile(discordId: string, updates: Partial<UserProfile>): Promise<any | null> {
    try {
      const updateData: any = {};
      
      // Map the updates to the correct database fields
      if (updates.tier !== undefined) updateData.tier = updates.tier;
      if (updates.username !== undefined) updateData.username = updates.username;
      if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
      if (updates.total_picks !== undefined) updateData.total_picks = updates.total_picks;
      if (updates.winning_picks !== undefined) updateData.winning_picks = updates.winning_picks;
      if (updates.losing_picks !== undefined) updateData.losing_picks = updates.losing_picks;
      if (updates.pending_picks !== undefined) updateData.pending_picks = updates.pending_picks;
      if (updates.total_units !== undefined) updateData.total_units = updates.total_units;
      if (updates.units_won !== undefined) updateData.units_won = updates.units_won;
      if (updates.units_lost !== undefined) updateData.units_lost = updates.units_lost;
      if (updates.win_rate !== undefined) updateData.win_rate = updates.win_rate;
      if (updates.roi !== undefined) updateData.roi = updates.roi;
      if (updates.streak !== undefined) updateData.streak = updates.streak;
      if (updates.best_streak !== undefined) updateData.best_streak = updates.best_streak;
      if (updates.worst_streak !== undefined) updateData.worst_streak = updates.worst_streak;
      if (updates.average_odds !== undefined) updateData.average_odds = updates.average_odds;
      if (updates.total_profit !== undefined) updateData.total_profit = updates.total_profit;
      if (updates.last_active !== undefined) updateData.last_active = updates.last_active;
      if (updates.created_at !== undefined) updateData.created_at = updates.created_at;
      if (updates.updated_at !== undefined) updateData.updated_at = updates.updated_at;

      const { data, error } = await this.client
        .from('user_profiles')
        .update(updateData)
        .eq('discord_id', discordId)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return null;
    }
  }

  async getUserPicks(discordId: string, limit = 10): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('final_picks')
        .select('*')
        .eq('capper_id', discordId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching user picks:', error);
      return [];
    }
  }

  async createPick(pick: Partial<any>): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('final_picks')
        .insert([pick])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating pick:', error);
      return null;
    }
  }

  async updatePick(pickId: string, updates: Partial<any>): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('final_picks')
        .update(updates)
        .eq('id', pickId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating pick:', error);
      return null;
    }
  }

  async trackUserActivity(discordId: string, activityType: string, metadata?: Record<string, any>): Promise<void> {
    try {
      // Insert activity record
      await this.client
        .from('analytics_events')
        .insert({
          type: 'activity',
          user_id: discordId,
          action: activityType,
          metadata: metadata || {},
          timestamp: new Date().toISOString()
        });

      // Update user's last_active timestamp
      await this.updateUserProfile(discordId, {
        last_active: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error tracking user activity:', error);
    }
  }

  async incrementUserStats(discordId: string, statType: 'messages' | 'reactions', increment = 1): Promise<void> {
    try {
      const profile = await this.getUserProfile(discordId);
      if (!profile) return;

      const updates: Partial<UserProfile> = {};
      if (statType === 'messages') {
        updates.total_picks = (profile.total_picks || 0) + increment;
      }

      if (Object.keys(updates).length > 0) {
        await this.updateUserProfile(discordId, updates);
      }
    } catch (error) {
      logger.error('Error incrementing user stats:', error);
    }
  }

  async getUserTier(discordId: string): Promise<UserTier> {
    try {
      const profile = await this.getUserProfile(discordId);
      return profile?.tier || 'member';
    } catch (error) {
      logger.error('Error getting user tier:', error);
      return 'member';
    }
  }

  async updateUserActivity(discordId: string, activityData: Record<string, any>): Promise<void> {
    try {
      await this.client
        .from('user_profiles')
        .update({
          last_active: new Date(),
          activity_score: activityData['activityScore'] || 0,
          updated_at: new Date()
        })
        .eq('discord_id', discordId);
    } catch (error) {
      logger.error('Error updating user activity:', error);
      throw error;
    }
  }

  /**
   * Upsert user cooldown
   */
  async upsertUserCooldown(userId: string, action: string, expiresAt: Date): Promise<void> {
    try {
      await this.client
        .from('user_cooldowns')
        .upsert({
          user_id: userId,
          action: action,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error upserting user cooldown:', error);
      throw error;
    }
  }

  /**
   * Create or update user profile
   */
  async createOrUpdateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .upsert({
          discord_id: userId,
          ...profile,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data as any;
    } catch (error) {
      logger.error('Error creating/updating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user tier
   */
  async updateUserTier(userId: string, tier: UserTier): Promise<void> {
    try {
      const { error } = await this.client
        .from('user_profiles')
        .update({ tier, updated_at: new Date().toISOString() })
        .eq('discord_id', userId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating user tier:', error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await this.client
        .from('user_profiles')
        .update({ isActive, updated_at: new Date().toISOString() })
        .eq('discord_id', userId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating user status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();
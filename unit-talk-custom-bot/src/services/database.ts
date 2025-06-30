import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase-complete';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

// Type aliases for better readability
type Tables = Database['public']['Tables'];
type UserProfileRow = Tables['user_profiles']['Row'];
type UserProfileInsert = Tables['user_profiles']['Insert'];
type UserProfileUpdate = Tables['user_profiles']['Update'];
type UserPicksRow = Tables['user_picks']['Row'];
type UserPicksInsert = Tables['user_picks']['Insert'];
type UserPicksUpdate = Tables['user_picks']['Update'];
type FinalPicksRow = Tables['final_picks']['Row'];
type FinalPicksInsert = Tables['final_picks']['Insert'];
type FinalPicksUpdate = Tables['final_picks']['Update'];
type GameThreadsRow = Tables['game_threads']['Row'];
type GameThreadsInsert = Tables['game_threads']['Insert'];
type GameThreadsUpdate = Tables['game_threads']['Update'];
type UserCooldownsRow = Tables['user_cooldowns']['Row'];
type UserCooldownsInsert = Tables['user_cooldowns']['Insert'];

type AnalyticsEventsInsert = Tables['analytics_events']['Insert'];
type ThreadStatsRow = Tables['thread_stats']['Row'];
type ThreadStatsInsert = Tables['thread_stats']['Insert'];
type ThreadStatsUpdate = Tables['thread_stats']['Update'];
// Coaching Sessions types
type CoachingSessionsRow = Tables['coaching_sessions']['Row'];
type CoachingSessionsInsert = Tables['coaching_sessions']['Insert'];
type CoachingSessionsUpdate = Tables['coaching_sessions']['Update'];

/**
 * Capper types - temporarily using any until TypeScript recognizes the new database schema
 */
type CappersRow = any; // Tables['cappers']['Row'];
type CappersInsert = any; // Tables['cappers']['Insert'];
type CappersUpdate = any; // Tables['cappers']['Update'];
type CapperEvaluationsRow = any; // Tables['capper_evaluations']['Row'];
type CapperEvaluationsInsert = any; // Tables['capper_evaluations']['Insert'];
type CapperEvaluationsUpdate = any; // Tables['capper_evaluations']['Update'];

import { UserTier } from '../types/index';

/**
 * Strictly typed database service using complete Supabase types
 */
export class DatabaseService {
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
   * Get user profile by Discord ID with strict typing
   */
  async getUserProfile(discordId: string): Promise<UserProfileRow | null> {
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

      return data;
    } catch (error) {
      logger.error('Error fetching user profile:', { error, discordId });
      return null;
    }
  }

  /**
   * Create new user profile with strict typing
   */
  async createUserProfile(profile: UserProfileInsert): Promise<UserProfileRow | null> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert(profile)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating user profile:', { error, profile });
      return null;
    }
  }

  /**
   * Update user profile with strict typing
   */
  async updateUserProfile(discordId: string, updates: UserProfileUpdate): Promise<UserProfileRow | null> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('discord_id', discordId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating user profile:', { error, discordId, updates });
      return null;
    }
  }

  /**
   * Create or update user profile (upsert) with strict typing
   */
  async upsertUserProfile(profile: UserProfileInsert): Promise<UserProfileRow | null> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .upsert({
          ...profile,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error upserting user profile:', { error, profile });
      return null;
    }
  }

  /**
   * Get user tier with strict typing
   */
  async getUserTier(discordId: string): Promise<UserTier> {
    try {
      const profile = await this.getUserProfile(discordId);
      return profile?.tier || 'member';
    } catch (error) {
      logger.error('Error getting user tier:', { error, discordId });
      return 'member';
    }
  }

  /**
   * Update user tier with strict typing
   */
  async updateUserTier(discordId: string, tier: UserTier): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('user_profiles')
        .update({ 
          tier, 
          updated_at: new Date().toISOString() 
        })
        .eq('discord_id', discordId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating user tier:', { error, discordId, tier });
      return false;
    }
  }

  // ==================== USER PICKS OPERATIONS ====================

  /**
   * Get user picks with strict typing and pagination
   */
  async getUserPicks(
    discordId: string, 
    options: {
      limit?: number;
      offset?: number;
      result?: UserPicksRow['result'];
      orderBy?: 'created_at' | 'updated_at';
      ascending?: boolean;
    } = {}
  ): Promise<UserPicksRow[]> {
    try {
      const { 
        limit = 10, 
        offset = 0, 
        result, 
        orderBy = 'created_at', 
        ascending = false 
      } = options;

      let query = this.client
        .from('user_picks')
        .select('*')
        .eq('discord_id', discordId)
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      if (result) {
        query = query.eq('result', result);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching user picks:', { error, discordId, options });
      return [];
    }
  }

  /**
   * Create user pick with strict typing
   */
  async createUserPick(pick: UserPicksInsert): Promise<UserPicksRow | null> {
    try {
      const { data, error } = await this.client
        .from('user_picks')
        .insert({
          ...pick,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating user pick:', { error, pick });
      return null;
    }
  }

  /**
   * Update user pick with strict typing
   */
  async updateUserPick(pickId: string, updates: UserPicksUpdate): Promise<UserPicksRow | null> {
    try {
      const { data, error } = await this.client
        .from('user_picks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', pickId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating user pick:', { error, pickId, updates });
      return null;
    }
  }

  /**
   * Get user pick statistics with strict typing
   */
  async getUserPickStats(discordId: string): Promise<{
    totalPicks: number;
    winningPicks: number;
    losingPicks: number;
    pendingPicks: number;
    pushPicks: number;
    winRate: number;
    totalProfit: number;
    averageStake: number;
    averageOdds: number;
  }> {
    try {
      const picks = await this.getUserPicks(discordId, { limit: 1000 });
      
      const stats = picks.reduce((acc, pick) => {
        acc.totalPicks++;
        
        switch (pick.result) {
          case 'win':
            acc.winningPicks++;
            acc.totalProfit += pick.profit_loss || 0;
            break;
          case 'loss':
            acc.losingPicks++;
            acc.totalProfit += pick.profit_loss || 0;
            break;
          case 'push':
            acc.pushPicks++;
            break;
          case 'pending':
            acc.pendingPicks++;
            break;
        }
        
        acc.totalStake += pick.stake;
        if (pick.odds) {
          acc.totalOdds += pick.odds;
          acc.oddsCount++;
        }
        
        return acc;
      }, {
        totalPicks: 0,
        winningPicks: 0,
        losingPicks: 0,
        pendingPicks: 0,
        pushPicks: 0,
        totalProfit: 0,
        totalStake: 0,
        totalOdds: 0,
        oddsCount: 0
      });

      const settledPicks = stats.winningPicks + stats.losingPicks;
      
      return {
        totalPicks: stats.totalPicks,
        winningPicks: stats.winningPicks,
        losingPicks: stats.losingPicks,
        pendingPicks: stats.pendingPicks,
        pushPicks: stats.pushPicks,
        winRate: settledPicks > 0 ? stats.winningPicks / settledPicks : 0,
        totalProfit: stats.totalProfit,
        averageStake: stats.totalPicks > 0 ? stats.totalStake / stats.totalPicks : 0,
        averageOdds: stats.oddsCount > 0 ? stats.totalOdds / stats.oddsCount : 0
      };
    } catch (error) {
      logger.error('Error calculating user pick stats:', { error, discordId });
      return {
        totalPicks: 0,
        winningPicks: 0,
        losingPicks: 0,
        pendingPicks: 0,
        pushPicks: 0,
        winRate: 0,
        totalProfit: 0,
        averageStake: 0,
        averageOdds: 0
      };
    }
  }

  // ==================== FINAL PICKS OPERATIONS ====================

  /**
   * Get final picks with strict typing
   */
  async getFinalPicks(
    options: {
      capperId?: string;
      limit?: number;
      offset?: number;
      tier?: string;
      sport?: string;
      result?: FinalPicksRow['result'];
    } = {}
  ): Promise<FinalPicksRow[]> {
    try {
      const { capperId, limit = 10, offset = 0, tier, sport, result } = options;

      let query = this.client
        .from('final_picks')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (capperId) query = query.eq('capper_id', capperId);
      if (tier) query = query.eq('tier', tier);
      if (sport) query = query.eq('sport', sport);
      if (result) query = query.eq('result', result);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching final picks:', { error, options });
      return [];
    }
  }

  /**
   * Create final pick with strict typing
   */
  async createFinalPick(pick: FinalPicksInsert): Promise<FinalPicksRow | null> {
    try {
      const { data, error } = await this.client
        .from('final_picks')
        .insert({
          ...pick,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating final pick:', { error, pick });
      return null;
    }
  }

  /**
   * Update final pick with strict typing
   */
  async updateFinalPick(pickId: string, updates: FinalPicksUpdate): Promise<FinalPicksRow | null> {
    try {
      const { data, error } = await this.client
        .from('final_picks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', pickId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating final pick:', { error, pickId, updates });
      return null;
    }
  }

  // ==================== GAME THREADS OPERATIONS ====================

  /**
   * Get game threads with strict typing
   */
  async getGameThreads(
    options: {
      isActive?: boolean;
      sport?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<GameThreadsRow[]> {
    try {
      const { isActive, sport, limit = 10, offset = 0 } = options;

      let query = this.client
        .from('game_threads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (isActive !== undefined) query = query.eq('is_active', isActive);
      if (sport) query = query.eq('sport', sport);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching game threads:', { error, options });
      return [];
    }
  }

  /**
   * Create game thread with strict typing
   */
  async createGameThread(thread: GameThreadsInsert): Promise<GameThreadsRow | null> {
    try {
      const { data, error } = await this.client
        .from('game_threads')
        .insert({
          ...thread,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating game thread:', { error, thread });
      return null;
    }
  }

  /**
   * Update game thread with strict typing
   */
  async updateGameThread(threadId: string, updates: GameThreadsUpdate): Promise<GameThreadsRow | null> {
    try {
      const { data, error } = await this.client
        .from('game_threads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('thread_id', threadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating game thread:', { error, threadId, updates });
      return null;
    }
  }

  // ==================== USER COOLDOWNS OPERATIONS ====================

  /**
   * Get user cooldown with strict typing
   */
  async getUserCooldown(userId: string, commandType: string): Promise<UserCooldownsRow | null> {
    try {
      const { data, error } = await this.client
        .from('user_cooldowns')
        .select('*')
        .eq('user_id', userId)
        .eq('command_type', commandType)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No cooldown found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching user cooldown:', { error, userId, commandType });
      return null;
    }
  }

  /**
   * Upsert user cooldown with strict typing
   */
  async upsertUserCooldown(cooldown: UserCooldownsInsert): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('user_cooldowns')
        .upsert({
          ...cooldown,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error upserting user cooldown:', { error, cooldown });
      return false;
    }
  }

  /**
   * Check if user is on cooldown
   */
  async isUserOnCooldown(userId: string, commandType: string): Promise<boolean> {
    try {
      const cooldown = await this.getUserCooldown(userId, commandType);
      if (!cooldown) return false;

      const expiresAt = new Date(cooldown.expires_at);
      return expiresAt > new Date();
    } catch (error) {
      logger.error('Error checking user cooldown:', { error, userId, commandType });
      return false;
    }
  }

  // ==================== ANALYTICS OPERATIONS ====================

  /**
   * Track analytics event with strict typing
   */
  async trackAnalyticsEvent(event: AnalyticsEventsInsert): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('analytics_events')
        .insert({
          ...event,
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error tracking analytics event:', { error, event });
      return false;
    }
  }

  /**
   * Track user activity with strict typing
   */
  async trackUserActivity(
    discordId: string,
    activityType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Track the analytics event
      await this.trackAnalyticsEvent({
        user_id: discordId,
        guild_id: botConfig.discord?.guildId || 'unknown',
        event_type: activityType,
        event_data: metadata || {},
        timestamp: new Date().toISOString()
      });

      // Update user's last_active timestamp
      await this.updateUserProfile(discordId, {
        last_active: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error tracking user activity:', { error, discordId, activityType, metadata });
    }
  }

  // ==================== THREAD STATS OPERATIONS ====================

  /**
   * Get thread stats with strict typing
   */
  async getThreadStats(threadId: string): Promise<ThreadStatsRow | null> {
    try {
      const { data, error } = await this.client
        .from('thread_stats')
        .select('*')
        .eq('thread_id', threadId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Stats not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching thread stats:', { error, threadId });
      return null;
    }
  }

  /**
   * Update thread stats with strict typing
   */
  async updateThreadStats(threadId: string, updates: ThreadStatsUpdate): Promise<ThreadStatsRow | null> {
    try {
      const { data, error } = await this.client
        .from('thread_stats')
        .upsert({
          thread_id: threadId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating thread stats:', { error, threadId, updates });
      return null;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('user_profiles')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database connection info
   */
  getConnectionInfo(): { url: string; connected: boolean } {
    return {
      url: botConfig.supabase?.url || 'Not configured',
      connected: !!this.client
    };
  }

  // ==================== CAPPER OPERATIONS ====================

  /**
   * Get capper by Discord ID
   */
  async getCapperByDiscordId(discordId: string): Promise<CappersRow | null> {
    try {
      const { data, error } = await this.client
        .from('cappers')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Capper not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching capper by Discord ID:', { error, discordId });
      return null;
    }
  }

  /**
   * Create new capper profile
   */
  async createCapper(capper: CappersInsert): Promise<CappersRow | null> {
    try {
      const { data, error } = await this.client
        .from('cappers')
        .insert(capper)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating capper:', { error, capper });
      return null;
    }
  }

  /**
   * Update capper profile
   */
  async updateCapper(capperId: string, updates: CappersUpdate): Promise<CappersRow | null> {
    try {
      const { data, error } = await this.client
        .from('cappers')
        .update(updates)
        .eq('id', capperId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating capper:', { error, capperId, updates });
      return null;
    }
  }

  /**
   * Get all active cappers with stats
   */
  async getActiveCappers(): Promise<CappersRow[]> {
    try {
      const { data, error } = await this.client
        .from('cappers')
        .select('*')
        .eq('status', 'active')
        .order('roi', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching active cappers:', { error });
      return [];
    }
  }

  /**
   * Get capper evaluations
   */
  async getCapperEvaluations(capperId: string, limit: number = 50): Promise<CapperEvaluationsRow[]> {
    try {
      const { data, error } = await this.client
        .from('capper_evaluations')
        .select('*')
        .eq('capper_id', capperId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching capper evaluations:', { error, capperId });
      return [];
    }
  }

  /**
   * Create capper evaluation
   */
  async createCapperEvaluation(evaluation: CapperEvaluationsInsert): Promise<CapperEvaluationsRow | null> {
    try {
      const { data, error } = await this.client
        .from('capper_evaluations')
        .insert(evaluation)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating capper evaluation:', { error, evaluation });
      return null;
    }
  }

  /**
   * Check if user has capper permissions
   */
  async hasCapperPermissions(discordId: string): Promise<boolean> {
    try {
      const capper = await this.getCapperByDiscordId(discordId);
      return capper !== null && capper.status === 'active';
    } catch (error) {
      logger.error('Error checking capper permissions:', { error, discordId });
      return false;
    }
  }

  // ==========================================
  // COACHING SESSIONS OPERATIONS
  // ==========================================

  /**
   * Create a new coaching session
   */
  async createCoachingSession(session: CoachingSessionsInsert): Promise<CoachingSessionsRow | null> {
    try {
      const { data, error } = await this.client
        .from('coaching_sessions')
        .insert(session)
        .select()
        .single();

      if (error) {
        logger.error('Error creating coaching session:', { error, session });
        return null;
      }

      logger.info('Coaching session created successfully', {
        sessionId: data.id,
        userId: data.user_id,
        sessionType: data.session_type
      });
      return data;
    } catch (error) {
      logger.error('Error creating coaching session:', { error, session });
      return null;
    }
  }

  /**
   * Get coaching session by ID
   */
  async getCoachingSession(sessionId: string): Promise<CoachingSessionsRow | null> {
    try {
      const { data, error } = await this.client
        .from('coaching_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Session not found
        }
        logger.error('Error fetching coaching session:', { error, sessionId });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching coaching session:', { error, sessionId });
      return null;
    }
  }

  /**
   * Update coaching session
   */
  async updateCoachingSession(sessionId: string, updates: CoachingSessionsUpdate): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('coaching_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) {
        logger.error('Error updating coaching session:', { error, sessionId, updates });
        return false;
      }

      logger.info('Coaching session updated successfully', { sessionId });
      return true;
    } catch (error) {
      logger.error('Error updating coaching session:', { error, sessionId, updates });
      return false;
    }
  }

  /**
   * Get user's coaching sessions with filtering and pagination
   */
  async getUserCoachingSessions(
    discordId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      sessionType?: string;
      orderBy?: 'created_at' | 'scheduled_at' | 'completed_at';
      ascending?: boolean;
    } = {}
  ): Promise<CoachingSessionsRow[]> {
    try {
      const {
        limit = 10,
        offset = 0,
        status,
        sessionType,
        orderBy = 'created_at',
        ascending = false
      } = options;

      let query = this.client
        .from('coaching_sessions')
        .select('*')
        .eq('discord_id', discordId);

      if (status) {
        query = query.eq('status', status);
      }

      if (sessionType) {
        query = query.eq('session_type', sessionType);
      }

      query = query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching user coaching sessions:', { error, discordId, options });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error fetching user coaching sessions:', { error, discordId, options });
      return [];
    }
  }

  /**
   * Get active coaching session for user
   */
  async getActiveCoachingSession(discordId: string): Promise<CoachingSessionsRow | null> {
    try {
      const { data, error } = await this.client
        .from('coaching_sessions')
        .select('*')
        .eq('discord_id', discordId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No active session
        }
        logger.error('Error fetching active coaching session:', { error, discordId });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching active coaching session:', { error, discordId });
      return null;
    }
  }

  /**
   * Get coaching session statistics for user
   */
  async getCoachingSessionStats(discordId: string): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalQuestions: number;
    averageSessionDuration: number;
    lastSessionDate: string | null;
  }> {
    try {
      const { data, error } = await this.client
        .from('coaching_sessions')
        .select('status, duration_minutes, feedback, completed_at')
        .eq('discord_id', discordId);

      if (error) {
        logger.error('Error fetching coaching session stats:', { error, discordId });
        return {
          totalSessions: 0,
          completedSessions: 0,
          totalQuestions: 0,
          averageSessionDuration: 0,
          lastSessionDate: null
        };
      }

      const sessions = data || [];
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const totalQuestions = sessions.reduce((sum, session) => {
        const feedback = session.feedback as any;
        return sum + (feedback?.totalQuestions || 0);
      }, 0);

      const totalDuration = completedSessions.reduce((sum, session) => {
        return sum + (session.duration_minutes || 0);
      }, 0);

      const averageSessionDuration = completedSessions.length > 0
        ? Math.round(totalDuration / completedSessions.length)
        : 0;

      const lastSessionDate = sessions.length > 0
        ? sessions
            .filter(s => s.completed_at)
            .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]?.completed_at || null
        : null;

      return {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        totalQuestions,
        averageSessionDuration,
        lastSessionDate
      };
    } catch (error) {
      logger.error('Error fetching coaching session stats:', { error, discordId });
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalQuestions: 0,
        averageSessionDuration: 0,
        lastSessionDate: null
      };
    }
  }

  /**
   * Get daily usage count for a specific user and event type
   */
  async getUserDailyUsage(discordId: string, eventType: string, date: string): Promise<number> {
    try {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      const { data, error } = await this.client
        .from('analytics_events')
        .select('id')
        .eq('user_id', discordId)
        .eq('event_type', eventType)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      logger.error('Error getting user daily usage:', { error, discordId, eventType, date });
      return 0;
    }
  }
}


// Create and export singleton instance
export const databaseService = new DatabaseService();

// Export types for use in other files
export type {
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
  UserPicksRow,
  UserPicksInsert,
  UserPicksUpdate,
  FinalPicksRow,
  FinalPicksInsert,
  FinalPicksUpdate,
  GameThreadsRow,
  GameThreadsInsert,
  GameThreadsUpdate,
  UserCooldownsRow,
  UserCooldownsInsert,
  ThreadStatsRow,
  ThreadStatsInsert,
  ThreadStatsUpdate,
  CoachingSessionsRow,
  CoachingSessionsInsert,
  CoachingSessionsUpdate,
  CappersRow,
  CappersInsert,
  CappersUpdate,
  CapperEvaluationsRow,
  CapperEvaluationsInsert,
  CapperEvaluationsUpdate,
  UserTier
};
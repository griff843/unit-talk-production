/**
 * Example usage of the new DatabaseService with strict typing
 * 
 * This file demonstrates how to use the new DatabaseService instead of the legacy SupabaseService
 * for improved type safety and better developer experience.
 */

import { databaseService, UserTier } from '../services/database';
import { logger } from '../utils/logger';

/**
 * Example: User Profile Management
 */
class UserProfileManager {
  
  /**
   * Create a new user profile with strict typing
   */
  async createUser(discordId: string, username: string, tier: UserTier = 'member') {
    try {
      const profile = await databaseService.createUserProfile({
        discord_id: discordId,
        username: username,
        tier: tier,
        subscription_tier: this.mapTierToSubscription(tier),
        metadata: {
          created_via: 'bot',
          initial_tier: tier
        }
      });

      if (profile) {
        logger.info('User profile created successfully', { 
          userId: profile.id, 
          discordId: profile.discord_id,
          tier: profile.tier 
        });
        return profile;
      }

      throw new Error('Failed to create user profile');
    } catch (error) {
      logger.error('Error creating user profile:', { error, discordId, username, tier });
      throw error;
    }
  }

  /**
   * Get user with comprehensive error handling
   */
  async getUser(discordId: string) {
    try {
      const profile = await databaseService.getUserProfile(discordId);
      
      if (!profile) {
        logger.warn('User profile not found', { discordId });
        return null;
      }

      // Type-safe access to all profile properties
      return {
        id: profile.id,
        discordId: profile.discord_id,
        username: profile.username,
        tier: profile.tier, // Strongly typed as UserTier
        subscriptionTier: profile.subscription_tier,
        createdAt: new Date(profile.created_at),
        lastActive: new Date(profile.last_active),
        metadata: profile.metadata
      };
    } catch (error) {
      logger.error('Error fetching user profile:', { error, discordId });
      return null;
    }
  }

  /**
   * Update user tier with validation
   */
  async updateUserTier(discordId: string, newTier: UserTier) {
    try {
      const currentProfile = await databaseService.getUserProfile(discordId);
      
      if (!currentProfile) {
        throw new Error('User profile not found');
      }

      const success = await databaseService.updateUserTier(discordId, newTier);
      
      if (success) {
        // Track the tier change
        await databaseService.trackUserActivity(discordId, 'tier_updated', {
          old_tier: currentProfile.tier,
          new_tier: newTier,
          updated_by: 'system'
        });

        logger.info('User tier updated successfully', {
          discordId,
          oldTier: currentProfile.tier,
          newTier
        });
      }

      return success;
    } catch (error) {
      logger.error('Error updating user tier:', { error, discordId, newTier });
      return false;
    }
  }

  /**
   * Get user statistics with type safety
   */
  async getUserStats(discordId: string) {
    try {
      const [profile, pickStats] = await Promise.all([
        databaseService.getUserProfile(discordId),
        databaseService.getUserPickStats(discordId)
      ]);

      if (!profile) {
        return null;
      }

      return {
        profile: {
          tier: profile.tier,
          subscriptionTier: profile.subscription_tier,
          memberSince: new Date(profile.created_at),
          lastActive: new Date(profile.last_active)
        },
        picks: {
          total: pickStats.totalPicks,
          wins: pickStats.winningPicks,
          losses: pickStats.losingPicks,
          pending: pickStats.pendingPicks,
          winRate: Math.round(pickStats.winRate * 100),
          totalProfit: pickStats.totalProfit,
          averageStake: pickStats.averageStake
        }
      };
    } catch (error) {
      logger.error('Error fetching user stats:', { error, discordId });
      return null;
    }
  }

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
}

/**
 * Example: Pick Management
 */
class PickManager {
  
  /**
   * Create a user pick with full type safety
   */
  async createUserPick(discordId: string, pickData: {
    gameId?: string;
    threadId?: string;
    pickType: string;
    playerName?: string;
    statType?: string;
    line?: number;
    overUnder?: 'over' | 'under';
    odds?: number;
    stake: number;
    confidence?: number;
    reasoning?: string;
  }) {
    try {
      const pick = await databaseService.createUserPick({
        user_id: discordId,
        discord_id: discordId,
        game_id: pickData.gameId || null,
        thread_id: pickData.threadId || null,
        pick_type: pickData.pickType,
        player_name: pickData.playerName || null,
        stat_type: pickData.statType || null,
        line: pickData.line || null,
        over_under: pickData.overUnder || null,
        odds: pickData.odds || null,
        stake: pickData.stake,
        confidence: pickData.confidence || null,
        reasoning: pickData.reasoning || null,
        result: 'pending',
        metadata: {
          created_via: 'bot',
          timestamp: new Date().toISOString()
        }
      });

      if (pick) {
        // Track the pick creation
        await databaseService.trackUserActivity(discordId, 'pick_created', {
          pick_id: pick.id,
          pick_type: pick.pick_type,
          stake: pick.stake
        });

        logger.info('User pick created successfully', {
          pickId: pick.id,
          userId: discordId,
          pickType: pick.pick_type
        });
      }

      return pick;
    } catch (error) {
      logger.error('Error creating user pick:', { error, discordId, pickData });
      return null;
    }
  }

  /**
   * Get user picks with filtering and pagination
   */
  async getUserPicks(discordId: string, options: {
    limit?: number;
    offset?: number;
    result?: 'win' | 'loss' | 'push' | 'pending';
    includeStats?: boolean;
  } = {}) {
    try {
      const { limit = 10, offset = 0, result, includeStats = false } = options;

      const picks = await databaseService.getUserPicks(discordId, {
        limit,
        offset,
        result,
        orderBy: 'created_at',
        ascending: false
      });

      let stats: any = null;
      if (includeStats) {
        stats = await databaseService.getUserPickStats(discordId);
      }

      return {
        picks: picks.map(pick => ({
          id: pick.id,
          pickType: pick.pick_type,
          playerName: pick.player_name,
          statType: pick.stat_type,
          line: pick.line,
          overUnder: pick.over_under,
          odds: pick.odds,
          stake: pick.stake,
          confidence: pick.confidence,
          reasoning: pick.reasoning,
          result: pick.result,
          actualValue: pick.actual_value,
          profitLoss: pick.profit_loss,
          createdAt: new Date(pick.created_at),
          updatedAt: new Date(pick.updated_at)
        })),
        stats,
        pagination: {
          limit,
          offset,
          hasMore: picks.length === limit
        }
      };
    } catch (error) {
      logger.error('Error fetching user picks:', { error, discordId, options });
      return { picks: [], stats: null, pagination: { limit: 0, offset: 0, hasMore: false } };
    }
  }

  /**
   * Update pick result with validation
   */
  async updatePickResult(pickId: string, result: 'win' | 'loss' | 'push', actualValue?: number) {
    try {
      const updatedPick = await databaseService.updateUserPick(pickId, {
        result,
        actual_value: actualValue || null,
        profit_loss: this.calculateProfitLoss(result, actualValue)
      });

      if (updatedPick) {
        // Track the result update
        await databaseService.trackUserActivity(updatedPick.discord_id, 'pick_graded', {
          pick_id: pickId,
          result,
          actual_value: actualValue
        });

        logger.info('Pick result updated successfully', {
          pickId,
          result,
          actualValue
        });
      }

      return updatedPick;
    } catch (error) {
      logger.error('Error updating pick result:', { error, pickId, result, actualValue });
      return null;
    }
  }

  private calculateProfitLoss(result: 'win' | 'loss' | 'push', actualValue?: number): number {
    // Simplified calculation - implement your actual logic here
    switch (result) {
      case 'win':
        return actualValue || 1;
      case 'loss':
        return -(actualValue || 1);
      case 'push':
        return 0;
      default:
        return 0;
    }
  }
}

/**
 * Example: Cooldown Management
 */
class CooldownManager {
  
  /**
   * Check if user can perform an action
   */
  async canUserPerformAction(userId: string, commandType: string): Promise<boolean> {
    try {
      const isOnCooldown = await databaseService.isUserOnCooldown(userId, commandType);
      return !isOnCooldown;
    } catch (error) {
      logger.error('Error checking user cooldown:', { error, userId, commandType });
      return false; // Fail safe - deny action if we can't check
    }
  }

  /**
   * Set cooldown for user action
   */
  async setCooldown(userId: string, commandType: string, durationMinutes: number): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      
      const success = await databaseService.upsertUserCooldown({
        user_id: userId,
        discord_id: userId,
        command_type: commandType,
        expires_at: expiresAt.toISOString()
      });

      if (success) {
        logger.info('Cooldown set successfully', {
          userId,
          commandType,
          expiresAt: expiresAt.toISOString()
        });
      }

      return success;
    } catch (error) {
      logger.error('Error setting cooldown:', { error, userId, commandType, durationMinutes });
      return false;
    }
  }

  /**
   * Get remaining cooldown time
   */
  async getRemainingCooldown(userId: string, commandType: string): Promise<number> {
    try {
      const cooldown = await databaseService.getUserCooldown(userId, commandType);
      
      if (!cooldown) {
        return 0; // No cooldown
      }

      const expiresAt = new Date(cooldown.expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        return 0; // Cooldown expired
      }

      return Math.ceil((expiresAt.getTime() - now.getTime()) / 1000); // Return seconds remaining
    } catch (error) {
      logger.error('Error getting remaining cooldown:', { error, userId, commandType });
      return 0;
    }
  }
}

/**
 * Example usage in a Discord command handler
 */
export async function handlePickCommand(discordId: string, pickData: any) {
  const userManager = new UserProfileManager();
  const pickManager = new PickManager();
  const cooldownManager = new CooldownManager();

  try {
    // Check if user can create picks (cooldown check)
    const canCreatePick = await cooldownManager.canUserPerformAction(discordId, 'create_pick');
    if (!canCreatePick) {
      const remainingTime = await cooldownManager.getRemainingCooldown(discordId, 'create_pick');
      throw new Error(`You're on cooldown. Try again in ${remainingTime} seconds.`);
    }

    // Get or create user profile
    let user = await userManager.getUser(discordId);
    if (!user) {
      await userManager.createUser(discordId, pickData.username);
      user = await userManager.getUser(discordId);
    }

    // Check user tier permissions
    if (user?.tier === 'member' && pickData.stake > 100) {
      throw new Error('Members can only stake up to 100 units per pick.');
    }

    // Create the pick
    const pick = await pickManager.createUserPick(discordId, pickData);
    if (!pick) {
      throw new Error('Failed to create pick');
    }

    // Set cooldown (5 minutes for members, 1 minute for VIP+)
    const cooldownMinutes = user?.tier === 'member' ? 5 : 1;
    await cooldownManager.setCooldown(discordId, 'create_pick', cooldownMinutes);

    return {
      success: true,
      pick: {
        id: pick.id,
        pickType: pick.pick_type,
        stake: pick.stake,
        createdAt: pick.created_at
      },
      user: {
        tier: user?.tier,
        nextCooldown: cooldownMinutes * 60 // seconds
      }
    };

  } catch (error) {
    logger.error('Error handling pick command:', { error, discordId, pickData });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Export the managers for use in other files
export { UserProfileManager, PickManager, CooldownManager };
import { GuildMember, User } from 'discord.js';
import { UserTier, UserPermissions } from '../types';
import { botConfig } from '../config';
import { supabaseService } from './supabase';
import { logger } from '../utils/logger';

export class PermissionsService {
  
  /**
   * Get user's tier based on their Discord roles
   */
  getUserTier(member: GuildMember): UserTier {
    try {
      if (member.roles.cache.has(botConfig.roles.vipPlus)) {
        return 'vip_plus';
      }
      if (member.roles.cache.has(botConfig.roles.vip)) {
        return 'vip';
      }
      return 'member';
    } catch (error) {
      logger.error('Error getting user tier:', error);
      return 'member';
    }
  }

  /**
   * Check if user is an admin
   */
  isAdmin(member: GuildMember): boolean {
    try {
      return member.roles.cache.has(botConfig.roles.admin) ||
             member.permissions.has('Administrator');
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if user is a moderator
   */
  isModerator(member: GuildMember): boolean {
    try {
      return member.roles.cache.has(botConfig.roles.moderator) ||
             member.roles.cache.has(botConfig.roles.admin) ||
             member.permissions.has('Administrator');
    } catch (error) {
      logger.error('Error checking moderator status:', error);
      return false;
    }
  }

  /**
   * Check if user is staff
   */
  isStaff(member: GuildMember): boolean {
    try {
      return member.roles.cache.has(botConfig.roles.staff) ||
             this.isAdmin(member) ||
             this.isModerator(member);
    } catch (error) {
      logger.error('Error checking staff status:', error);
      return false;
    }
  }

  /**
   * Get comprehensive user permissions
   */
  async getUserPermissions(member: GuildMember): Promise<UserPermissions> {
    const tier = this.getUserTier(member);
    const isAdmin = this.isAdmin(member);
    const isModerator = this.isModerator(member);

    return {
      tier,
      roles: member.roles.cache.map(role => role.name),
      canAccessVIP: tier === 'vip' || tier === 'vip_plus' || isAdmin,
      canAccessVIPPlus: tier === 'vip_plus' || isAdmin,
      canSubmitPicks: true, // All users can submit picks
      canAccessCoaching: tier === 'vip' || tier === 'vip_plus' || isAdmin,
      canUseDMs: true, // All users can receive DMs
      canCreateThreads: tier === 'vip' || tier === 'vip_plus' || isAdmin || isModerator,
      canViewVIPContent: tier === 'vip' || tier === 'vip_plus' || tier === 'staff' || tier === 'admin' || tier === 'owner',
      canViewVipPlusContent: tier === 'vip_plus' || isAdmin,
      canUseAdminCommands: isAdmin,
      canUseModeratorCommands: isModerator || isAdmin,
      canUseCommand: true, // All users can use basic commands
      canViewAnalytics: isAdmin || tier === 'staff' || tier === 'owner',
      canEditConfig: isAdmin || tier === 'owner',
      isOwner: tier === 'owner',
      isAdmin,
      isModerator
    };
  }

  /**
   * Check if user can access a specific channel
   */
  async canAccessChannel(member: GuildMember, channelId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(member);
    
    // Admin can access everything
    if (permissions.isAdmin) return true;
    
    // Check specific channel permissions
    switch (channelId) {
      case botConfig.channels.vipPicks:
      case botConfig.channels.vipGeneral:
        return permissions.canAccessVIP;
        
      case botConfig.channels.vipPlusPicks:
      case botConfig.channels.vipPlusGeneral:
        return permissions.canAccessVIPPlus;
        
      case botConfig.channels.freePicks:
      case botConfig.channels.general:
      case botConfig.channels.announcements:
        return true; // Public channels
        
      default:
        return true; // Allow access to unknown channels by default
    }
  }

  /**
   * Check if user can use a specific command
   */
  async canUseCommand(member: GuildMember, commandName: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(member);
    
    // Admin commands
    const adminCommands = ['admin', 'ban', 'kick', 'purge', 'config'];
    if (adminCommands.includes(commandName)) {
      return permissions.isAdmin;
    }
    
    // Moderator commands
    const moderatorCommands = ['warn', 'mute', 'timeout', 'thread'];
    if (moderatorCommands.includes(commandName)) {
      return permissions.isModerator || permissions.isAdmin;
    }
    
    // VIP+ commands
    const vipPlusCommands = ['coaching', 'analysis'];
    if (vipPlusCommands.includes(commandName)) {
      return permissions.canAccessVIPPlus;
    }
    
    // VIP commands
    const vipCommands = ['picks', 'stats'];
    if (vipCommands.includes(commandName)) {
      return permissions.canAccessVIP;
    }
    
    // Public commands - everyone can use
    return true;
  }

  /**
   * Update user's tier in database when roles change
   */
  async syncUserTier(member: GuildMember): Promise<void> {
    try {
      const newTier = await this.getUserTier(member);
      const profile = await supabaseService.getUserProfile(member.id);
      
      if (profile && profile.tier !== newTier) {
        await supabaseService.updateUserProfile(member.id, {
          tier: newTier,
          updated_at: new Date()
        });
        
        logger.info(`Updated user ${member.user.username} tier from ${profile.tier} to ${newTier}`);
      }
    } catch (error) {
      logger.error('Error syncing user tier:', error);
    }
  }

  /**
   * Get users by permission level
   */
  async getUsersByPermission(guildMembers: GuildMember[], permission: keyof UserPermissions): Promise<GuildMember[]> {
    const filteredMembers: GuildMember[] = [];
    
    for (const member of guildMembers) {
      const permissions = await this.getUserPermissions(member);
      if (permissions[permission]) {
        filteredMembers.push(member);
      }
    }
    
    return filteredMembers;
  }

  /**
   * Check rate limiting for user actions
   */
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  checkRateLimit(userId: string, action: string, limit: number, windowMs: number): boolean {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const userLimit = this.rateLimits.get(key);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit
      this.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (userLimit.count >= limit) {
      return false; // Rate limited
    }
    
    userLimit.count++;
    return true;
  }

  /**
   * Clear rate limits for a user (admin function)
   */
  clearRateLimit(userId: string, action?: string): void {
    if (action) {
      this.rateLimits.delete(`${userId}:${action}`);
    } else {
      // Clear all rate limits for user
      for (const key of this.rateLimits.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.rateLimits.delete(key);
        }
      }
    }
  }

  /**
   * Get user's current rate limit status
   */
  getRateLimitStatus(userId: string, action: string): { remaining: number; resetTime: number } | null {
    const key = `${userId}:${action}`;
    const userLimit = this.rateLimits.get(key);
    
    if (!userLimit || Date.now() > userLimit.resetTime) {
      return null;
    }
    
    return {
      remaining: Math.max(0, 10 - userLimit.count), // Assuming default limit of 10
      resetTime: userLimit.resetTime
    };
  }
}

export const permissionsService = new PermissionsService();
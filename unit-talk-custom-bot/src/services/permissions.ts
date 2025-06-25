
import { GuildMember, User } from 'discord.js';
import { UserTier, UserPermissions, CooldownData } from '../types/';
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
      return member.roles.cache.has((botConfig.roles as any).staff) ||
             this.isAdmin(member) ||
             this.isModerator(member);
    } catch (error) {
      logger.error('Error checking staff status:', error);
      return false;
    }
  }

  /**
   * Check if user has a specific role
   */
  hasRole(member: GuildMember, roleType: string): boolean {
    try {
      switch (roleType.toLowerCase()) {
        case 'admin':
          return this.isAdmin(member);
        case 'moderator':
        case 'mod':
          return this.isModerator(member);
        case 'staff':
          return this.isStaff(member);
        case 'vip':
          return member.roles.cache.has(botConfig.roles.vip) ||
                 member.roles.cache.has(botConfig.roles.vipPlus) ||
                 this.isAdmin(member);
        case 'vipplus':
        case 'vip_plus':
          return member.roles.cache.has(botConfig.roles.vipPlus) ||
                 this.isAdmin(member);
        case 'member':
          return true; // All users are members
        default:
          // Try to find role by name or ID
          return member.roles.cache.some(role =>
            role.name.toLowerCase() === roleType.toLowerCase() ||
            role.id === roleType
          );
      }
    } catch (error) {
      logger.error(`Error checking role ${roleType}:`, error);
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
    const isOwner = tier === 'owner';
    const isStaff = this.isStaff(member);

    return {
      tier,
      canUsePicks: true, // All users can submit picks
      canUseAdmin: isAdmin,
      canModerate: isModerator || isAdmin,
      canAccessVIP: tier === 'vip' || tier === 'vip_plus' || isAdmin,
      canAccessVIPPlus: tier === 'vip_plus' || isAdmin,
      maxPicksPerDay: tier === 'vip_plus' ? 20 : tier === 'vip' ? 15 : 10,
      cooldownSeconds: tier === 'vip_plus' ? 30 : tier === 'vip' ? 60 : 120,
      canSubmitPicks: true,
      canViewVIPContent: tier === 'vip' || tier === 'vip_plus' || isAdmin,
      canViewVipPlusContent: tier === 'vip_plus' || isAdmin,
      canUseCommand: true,
      canCreateThreads: isStaff || isAdmin,
      canViewAnalytics: isAdmin,
      canAccessAnalytics: isAdmin,
      canEditConfig: isAdmin,
      canUseAdminCommands: isAdmin,
      canUseModeratorCommands: isModerator || isAdmin,
      isOwner,
      isAdmin,
      isModerator,
      roles: member.roles.cache.map(role => role.id),
      canAccessCoaching: tier === 'vip_plus' || isAdmin,
      canUseDMs: true,
      maxDMsPerHour: tier === 'vip_plus' ? 20 : tier === 'vip' ? 10 : 5,
      isRateLimited: false
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

      case (botConfig.channels as any).freePicks:
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

      if (profile && (profile as any).tier && (profile as any).tier !== newTier) {
        await supabaseService.updateUserProfile(member.id, {
          tier: newTier,
          updated_at: new Date().toISOString()
        } as any);

        logger.info(`Updated user ${member.user.username} tier from ${(profile as any).tier} to ${newTier}`);
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
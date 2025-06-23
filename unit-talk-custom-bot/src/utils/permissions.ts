import { GuildMember } from 'discord.js';
import { UserTier, UserPermissions, CooldownData } from '../types';
import { botConfig } from '../config';
import { supabaseService } from '../services/supabase';
import { logger } from './logger';

export class PermissionUtils {
  private static cooldowns = new Map<string, CooldownData>();

  static async getUserTier(member: GuildMember): Promise<UserTier> {
    try {
      // Check roles in order of priority
      if (member.roles.cache.has(botConfig.roles.owner)) return 'owner';
      if (member.roles.cache.has(botConfig.roles.admin)) return 'admin';
      if (member.roles.cache.has(botConfig.roles.staff)) return 'staff';
      if (member.roles.cache.has(botConfig.roles.vipPlus)) return 'vip_plus';
      if (member.roles.cache.has(botConfig.roles.vip)) return 'vip';
      
      return 'member';
    } catch (error) {
      logger.error('Error getting user tier', { error, userId: member.id });
      return 'member';
    }
  }

  static async getUserPermissions(member: GuildMember): Promise<UserPermissions> {
    const tier = await this.getUserTier(member);
    
    const basePermissions: UserPermissions = {
      tier,
      canSubmitPicks: true,
      canViewVIPContent: false,
      canViewVipPlusContent: false,
      canUseCommand: true,
      canCreateThreads: false,
      canViewAnalytics: false,
      canEditConfig: false,
      canUseAdminCommands: false,
      canUseModeratorCommands: false,
      isOwner: false,
      isAdmin: false,
      isModerator: false,
      roles: [],
      canAccessVIP: false,
      canAccessVIPPlus: false,
      canAccessCoaching: false,
      canUseDMs: true,
      maxPicksPerDay: 3,
      maxDMsPerHour: 5,
      isRateLimited: false
    };

    // Apply tier-specific permissions
    switch (tier) {
      case 'owner':
        return {
          ...basePermissions,
          canCreateThreads: true,
          canAccessAnalytics: true,
          canModerate: true,
          canUseAdminCommands: true,
          maxPicksPerDay: 999,
          maxDMsPerHour: 999,
          isAdmin: true,
          isModerator: true,
          canAccessVIP: true,
          canAccessVIPPlus: true,
          canViewVipPlusContent: true,
          canAccessCoaching: true,
          isOwner: true,
          canUseModeratorCommands: true
        };

      case 'admin':
        return {
          ...basePermissions,
          canAccessVIP: true,
          canAccessVIPPlus: true,
          canSubmitPicks: true,
          canAccessCoaching: true,
          canUseDMs: true,
          canCreateThreads: true,
          canViewVIPContent: true,
          canViewVipPlusContent: true,
          canUseAdminCommands: true,
          canUseModeratorCommands: true,
          canUseCommand: true,
          canViewAnalytics: true,
          canEditConfig: true,
          isOwner: false,
          isAdmin: true,
          isModerator: true,
          maxPicksPerDay: 50,
          maxDMsPerHour: 50
        };

      case 'staff':
        return {
          ...basePermissions,
          canAccessVIP: true,
          canAccessVIPPlus: true,
          canSubmitPicks: true,
          canAccessCoaching: true,
          canUseDMs: true,
          canCreateThreads: true,
          canViewVIPContent: true,
          canViewVipPlusContent: true,
          canUseAdminCommands: false,
          canUseModeratorCommands: true,
          canUseCommand: true,
          canViewAnalytics: true,
          canEditConfig: false,
          isOwner: false,
          isAdmin: false,
          isModerator: true,
          maxPicksPerDay: 25,
          maxDMsPerHour: 25
        };

      case 'vip_plus':
        return {
          ...basePermissions,
          canAccessVIP: true,
          canAccessVIPPlus: true,
          canSubmitPicks: true,
          canAccessCoaching: true,
          canUseDMs: true,
          canCreateThreads: true,
          canViewVIPContent: true,
          canViewVipPlusContent: true,
          canUseAdminCommands: false,
          canUseModeratorCommands: false,
          canUseCommand: true,
          canViewAnalytics: false,
          canEditConfig: false,
          isOwner: false,
          isAdmin: false,
          isModerator: false,
          maxDMsPerHour: 15
        };

      case 'vip':
        return {
          ...basePermissions,
          canAccessVIP: true,
          canAccessVIPPlus: false,
          canSubmitPicks: true,
          canAccessCoaching: false,
          canUseDMs: true,
          canCreateThreads: true,
          canViewVIPContent: true,
          canViewVipPlusContent: false,
          canUseAdminCommands: false,
          canUseModeratorCommands: false,
          canUseCommand: true,
          canViewAnalytics: false,
          canEditConfig: false,
          isOwner: false,
          isAdmin: false,
          isModerator: false
        };

      default:
        return {
          ...basePermissions,
          canAccessVIP: true,
          canAccessVIPPlus: false,
          canSubmitPicks: true,
          canAccessCoaching: false,
          canUseDMs: true,
          canCreateThreads: true,
          canViewVIPContent: false,
          canViewVipPlusContent: false,
          canUseAdminCommands: false,
          canUseModeratorCommands: false,
          canUseCommand: true,
          canViewAnalytics: false,
          canEditConfig: false,
          isOwner: false,
          isAdmin: false,
          isModerator: false
        };
    }
  }

  static async canSubmitPicks(member: GuildMember): Promise<boolean> {
    const permissions = await this.getUserPermissions(member);
    return permissions.canSubmitPicks;
  }

  static async canAccessCoaching(member: GuildMember): Promise<boolean> {
    const permissions = await this.getUserPermissions(member);
    return permissions.canAccessCoaching || false;
  }

  static async isRateLimited(userId: string, action: string): Promise<boolean> {
    const key = `${userId}:${action}`;
    const cooldown = this.cooldowns.get(key);

    if (!cooldown) return false;

    const now = Date.now();
    if (now >= cooldown.expires_at) {
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  static setCooldown(userId: string, action: string, durationMs: number): void {
    const key = `${userId}:${action}`;
    const now = Date.now();

    this.cooldowns.set(key, {
      user_id: userId,
      command: action,
      expires_at: now + durationMs
    });

    // Store in database for persistence
    supabaseService.upsertUserCooldown(
      userId,
      action,
      new Date(now + durationMs)
    ).catch((error: any) => {
      logger.error('Failed to store cooldown in database', { error, userId, action });
    });
  }

  static getTierName(tier: UserTier): string {
    const tierNames: Record<UserTier, string> = {
      member: 'Member',
      vip: 'VIP',
      vip_plus: 'VIP+',
      staff: 'Staff',
      admin: 'Admin',
      owner: 'Owner'
    };
    return tierNames[tier] || 'Member';
  }

  static getTierColor(tier: UserTier): string {
    const tierColors: Record<UserTier, string> = {
      member: '#95a5a6',
      vip: '#f39c12',
      vip_plus: '#e74c3c',
      staff: '#3498db',
      admin: '#9b59b6',
      owner: '#1abc9c'
    };
    return tierColors[tier] || '#95a5a6';
  }

  static async hasPermission(member: GuildMember, permission: keyof UserPermissions): Promise<boolean> {
    const permissions = await this.getUserPermissions(member);
    const value = permissions[permission];
    return typeof value === 'boolean' ? value : false;
  }

  static async checkChannelAccess(member: GuildMember, channelId: string): Promise<boolean> {
    const tier = await this.getUserTier(member);
    
    // VIP+ channels
    if (channelId === botConfig.channels.vipPlusPicks || channelId === botConfig.channels.vipPlusGeneral) {
      return ['vip_plus', 'staff', 'admin', 'owner'].includes(tier);
    }
    
    // VIP channels
    if (channelId === botConfig.channels.vipPicks || channelId === botConfig.channels.vipGeneral) {
      return ['vip', 'vip_plus', 'staff', 'admin', 'owner'].includes(tier);
    }
    
    // Admin channels
    if (channelId === botConfig.channels.admin) {
      return ['admin', 'owner'].includes(tier);
    }
    
    return true; // Public channels
  }
}
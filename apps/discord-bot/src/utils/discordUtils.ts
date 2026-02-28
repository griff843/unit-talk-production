/**
 * Discord utility functions for handling Discord.js type conversions and common operations
 */

import { GuildMember, APIInteractionGuildMember, PartialGuildMember, Guild } from 'discord.js';

import {
  toISOString,
  toDate,
  getHours,
  getMinutes,
  getFullYear,
  getMonth,
  getDate,
  setDate,
  toLocaleDateString,
} from './dateUtils';

/**
 * Type guard to check if member is a full GuildMember
 */
export function isGuildMember(
  member: GuildMember | APIInteractionGuildMember
): member is GuildMember {
  return 'guild' in member && typeof member.guild === 'object';
}

/**
 * Safely convert APIInteractionGuildMember to GuildMember when possible
 * Returns the original GuildMember if already a GuildMember
 */
export async function toGuildMember(
  member: GuildMember | APIInteractionGuildMember,
  guild?: Guild
): Promise<GuildMember | PartialGuildMember> {
  // If already a GuildMember, return as-is
  if (isGuildMember(member)) {
    return member;
  }

  // If we have a guild, try to fetch the full member
  if (guild) {
    try {
      const fullMember = await guild.members.fetch(member.user.id);
      return fullMember;
    } catch (error) {
      // Fall through to return original member for now
    }
  }

  // For now, just return the original member and let TypeScript handle it
  // This avoids complex type casting issues while maintaining functionality
  return member as any;
}

/**
 * Get user ID from either GuildMember or APIInteractionGuildMember
 */
export function getUserId(member: GuildMember | APIInteractionGuildMember): string {
  return member.user.id;
}

/**
 * Get display name from either GuildMember or APIInteractionGuildMember
 */
export function getDisplayName(member: GuildMember | APIInteractionGuildMember): string {
  if (isGuildMember(member)) {
    return member.displayName;
  }
  return member.nick || member.user.username;
}

/**
 * Check if member has specific role (works with both types)
 */
export function hasRole(member: GuildMember | APIInteractionGuildMember, roleId: string): boolean {
  if (typeof member.roles === 'string') {
    // APIInteractionGuildMember has roles as string array in some contexts
    return false; // Safe default
  }

  if (Array.isArray(member.roles)) {
    return member.roles.includes(roleId);
  }

  // GuildMember has RoleManager
  return member.roles.cache?.has(roleId) || false;
}

/**
 * Get avatar URL from either GuildMember or APIInteractionGuildMember
 */
export function getAvatarURL(member: GuildMember | APIInteractionGuildMember): string | null {
  if (isGuildMember(member)) {
    return member.displayAvatarURL();
  }
  // For APIInteractionGuildMember, construct avatar URL manually or return null
  if (member.avatar) {
    return `https://cdn.discordapp.com/guilds/${member.user.id}/users/${member.user.id}/avatars/${member.avatar}.png`;
  }
  return null;
}

import { GuildMember } from 'discord.js';

/**
 * Check if a guild member has a specific role
 */
export function hasRole(member: GuildMember, roleName: string): boolean {
  if (!member || !member.roles) {
    return false;
  }

  return member.roles.cache.some(role => role.name === roleName);
}

/**
 * Check if a guild member has any of the specified roles
 */
export function hasAnyRole(member: GuildMember, roleNames: string[]): boolean {
  if (!member || !member.roles) {
    return false;
  }

  return member.roles.cache.some(role => roleNames.includes(role.name));
}

/**
 * Get all role names for a guild member
 */
export function getRoleNames(member: GuildMember): string[] {
  if (!member || !member.roles) {
    return [];
  }

  return member.roles.cache.map(role => role.name);
}

/**
 * Check if a guild member has admin permissions
 */
export function isAdmin(member: GuildMember): boolean {
  if (!member || !member.permissions) {
    return false;
  }

  return member.permissions.has('Administrator');
}

/**
 * Check if a guild member has moderator permissions
 */
export function isModerator(member: GuildMember): boolean {
  if (!member) {
    return false;
  }

  return hasAnyRole(member, ['Moderator', 'Admin', 'Owner']) || isAdmin(member);
}

/**
 * Check if a guild member is a UT Capper
 */
export function isUTCapper(member: GuildMember): boolean {
  return hasRole(member, 'UT Capper');
}

/**
 * Get color for capper tier
 */
export function getTierColor(tier: string): number {
  switch (tier?.toLowerCase()) {
    case 'elite':
      return 0xFFD700; // Gold
    case 'pro':
      return 0x9932CC; // Purple
    case 'rookie':
      return 0x32CD32; // Green
    default:
      return 0x808080; // Gray
  }
}
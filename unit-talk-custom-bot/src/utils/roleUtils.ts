import { GuildMember, PartialGuildMember } from 'discord.js';
import { ROLE_NAMES } from '../config/onboarding.prompts';

/**
 * Determines the user's tier based on their roles
 */
export function getUserTier(member: GuildMember | PartialGuildMember | null): string {
  if (!member || !member.roles) {
    return 'member';
  }

  const roles = member.roles.cache;

  // Check for staff/admin roles first (highest priority)
  if (roles.some(role => role.name === ROLE_NAMES.OWNER)) {
    return 'owner';
  }
  if (roles.some(role => role.name === ROLE_NAMES.ADMIN)) {
    return 'admin';
  }
  if (roles.some(role => role.name === ROLE_NAMES.STAFF)) {
    return 'staff';
  }

  // Check for VIP tiers
  if (roles.some(role => role.name === ROLE_NAMES.VIP_PLUS)) {
    return 'vip_plus';
  }
  if (roles.some(role => role.name === ROLE_NAMES.VIP)) {
    return 'vip';
  }
  if (roles.some(role => role.name === ROLE_NAMES.TRIAL)) {
    return 'trial';
  }

  // Check for capper role
  if (roles.some(role => role.name === ROLE_NAMES.CAPPER)) {
    return 'capper';
  }

  // Default to member
  return 'member';
}

/**
 * Checks if a user has a specific tier or higher
 */
export function hasMinimumTier(member: GuildMember | PartialGuildMember | null, requiredTier: string): boolean {
  const userTier = getUserTier(member);
  const tierHierarchy = ['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner'];

  const userTierIndex = tierHierarchy.indexOf(userTier);
  const requiredTierIndex = tierHierarchy.indexOf(requiredTier);

  return userTierIndex >= requiredTierIndex;
}

/**
 * Gets the display name for a tier
 */
export function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'vip_plus':
      return 'VIP+ Elite';
    case 'vip':
      return 'VIP Member';
    case 'trial':
      return 'Trial Member';
    case 'staff':
      return 'Staff';
    case 'admin':
      return 'Admin';
    case 'owner':
      return 'Owner';
    default:
      return 'Member';
  }
}

/**
 * Gets the color associated with a tier
 */
export function getTierColor(tier: string): number {
  switch (tier) {
    case 'vip_plus':
      return 0xff4500; // Orange red
    case 'vip':
      return 0xffd700; // Gold
    case 'trial':
      return 0x00ffff; // Cyan
    case 'staff':
      return 0x9932cc; // Dark orchid
    case 'admin':
      return 0xff0000; // Red
    case 'owner':
      return 0x8b0000; // Dark red
    default:
      return 0x00ffcc; // Default teal
  }
}
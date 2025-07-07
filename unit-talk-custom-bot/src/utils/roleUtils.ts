import { GuildMember, PartialGuildMember, Guild } from 'discord.js';
import { ROLE_NAMES } from '../config/onboarding.prompts';
import { logger } from './logger';

const ROLE_IDS = {
  VIP: process.env.VIP_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  VIP_PLUS: process.env.VIP_PLUS_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  ADMIN: process.env.ADMIN_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  MODERATOR: process.env.MODERATOR_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  STAFF: process.env.STAFF_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  OWNER: process.env.OWNER_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  CAPPER: process.env.CAPPER_ROLE_IDS?.split(',').filter(id => id.trim()) || [],
  TRIAL: process.env.TRIAL_ROLE_IDS?.split(',').filter(id => id.trim()) || []
};

// Cache for recent upgrades to handle Discord role propagation delays
const recentUpgrades = new Map<string, { tier: string, timestamp: number }>();

/**
 * Enhanced member fetching with retries and error handling
 */
export async function fetchFreshMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      // Force fetch from Discord API, not cache
      const member = await guild.members.fetch({ user: userId, force: true });
      logger.info(`✅ Successfully fetched fresh member data for ${member.user.tag} (${userId})`);
      return member;
    } catch (error) {
      attempts++;
      logger.error(`❌ Failed to fetch member ${userId} (attempt ${attempts}/${maxAttempts}):`, {
        userId,
        error: error instanceof Error ? error.message : String(error),
        fullError: error
      });

      if (attempts < maxAttempts) {
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  return null;
}

/**
 * Enhanced tier detection with fresh member fetching and optimistic upgrades
 */
export async function getUserTierWithFreshFetch(guild: Guild, userId: string, optimisticTier?: string): Promise<string> {
  // Check for recent optimistic upgrade
  const recentUpgrade = recentUpgrades.get(userId);
  if (recentUpgrade && (Date.now() - recentUpgrade.timestamp) < 30000) { // 30 seconds
    logger.info(`🚀 Using optimistic tier ${recentUpgrade.tier} for recently upgraded user ${userId}`);
    return recentUpgrade.tier;
  }

  // Fetch fresh member data
  const member = await fetchFreshMember(guild, userId);
  if (!member) {
    logger.error(`❌ Could not fetch member data for tier detection`, { userId });
    return 'member'; // Fallback only after confirmed failure
  }

  const tier = getUserTier(member);
  logger.info(`👤 Fresh tier detection for ${member.user.tag}: ${tier}`);

  return tier;
}

/**
 * Set optimistic tier for recently upgraded users
 */
export function setOptimisticTier(userId: string, tier: string): void {
  recentUpgrades.set(userId, { tier, timestamp: Date.now() });
  logger.info(`🎯 Set optimistic tier ${tier} for user ${userId}`);

  // Clean up after 60 seconds
  setTimeout(() => {
    recentUpgrades.delete(userId);
  }, 60000);
}


/**
 * Enhanced role change handler with delay for Discord propagation
 */
export async function handleRoleUpgradeWithDelay(guild: Guild, userId: string, newTier: string, delayMs: number = 3000): Promise<string> {
  // Set optimistic tier immediately
  setOptimisticTier(userId, newTier);

  // Wait for Discord to propagate the role change
  await new Promise(resolve => setTimeout(resolve, delayMs));

  // Fetch fresh member data to confirm
  return await getUserTierWithFreshFetch(guild, userId);
}

/**
 * Determines the user's tier based on their roles
 */
export function getUserTier(member: GuildMember | PartialGuildMember | null): string {
  if (!member || !member.roles) {
    return 'member';
  }

  const roles = member.roles.cache;

  // Check for staff/admin roles first (highest priority) using role IDs
  if (ROLE_IDS.OWNER.length > 0 && ROLE_IDS.OWNER.some(id => roles.has(id))) {
    return 'owner';
  }
  if (ROLE_IDS.ADMIN.length > 0 && ROLE_IDS.ADMIN.some(id => roles.has(id))) {
    return 'admin';
  }
  if ((ROLE_IDS.STAFF.length > 0 && ROLE_IDS.STAFF.some(id => roles.has(id))) ||
      (ROLE_IDS.MODERATOR.length > 0 && ROLE_IDS.MODERATOR.some(id => roles.has(id)))) {
    return 'staff';
  }

  // Check for VIP tiers using role IDs
  if (ROLE_IDS.VIP_PLUS.length > 0 && ROLE_IDS.VIP_PLUS.some(id => roles.has(id))) {
    return 'vip_plus';
  }
  if (ROLE_IDS.VIP.length > 0 && ROLE_IDS.VIP.some(id => roles.has(id))) {
    return 'vip';
  }
  if (ROLE_IDS.TRIAL.length > 0 && ROLE_IDS.TRIAL.some(id => roles.has(id))) {
    return 'trial';
  }

  // Check for capper role using role IDs
  if (ROLE_IDS.CAPPER.length > 0 && ROLE_IDS.CAPPER.some(id => roles.has(id))) {
    return 'capper';
  }

  // Fallback to role name matching for roles not configured with IDs
  if (roles.some(role => role.name === ROLE_NAMES.OWNER)) {
    return 'owner';
  }
  if (roles.some(role => role.name === ROLE_NAMES.ADMIN)) {
    return 'admin';
  }
  if (roles.some(role => role.name === ROLE_NAMES.STAFF || role.name === ROLE_NAMES.MODERATOR)) {
    return 'staff';
  }
  if (roles.some(role => role.name === ROLE_NAMES.VIP_PLUS)) {
    return 'vip_plus';
  }
  if (roles.some(role => role.name === ROLE_NAMES.VIP)) {
    return 'vip';
  }
  if (roles.some(role => role.name === ROLE_NAMES.TRIAL)) {
    return 'trial';
  }
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
    case 'capper':
      return 'UT Capper';
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
    case 'capper':
      return 0x32cd32; // Green
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
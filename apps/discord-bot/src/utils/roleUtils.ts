import { GuildMember, PartialGuildMember, Guild } from 'discord.js';

import { ROLE_NAMES } from '../config/onboarding.prompts';

import { logger } from './logger';

// Recent upgrades cache for optimistic tier updates
const recentUpgrades = new Map<string, { tier: string; timestamp: number }>();

// Tier emoji mappings
const TIER_EMOJIS = {
  black_label: '🔥',
  vip_plus: '⭐',
  vip: '💎',
  member: '👤',
  trial: '🆓',
  staff: '🛡️',
  moderator: '🔨',
  admin: '👑',
};

/**
 * Get emoji for a tier
 */
export function getTierEmoji(tier: string): string {
  return TIER_EMOJIS[tier as keyof typeof TIER_EMOJIS] || '👤';
}

// Helper function to handle both single ID and array formats
function getRoleIds(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar.includes(',') ? envVar.split(',').filter(id => id.trim()) : [envVar];
}

// Load role IDs from environment variables
const ROLE_IDS = {
  VIP: getRoleIds(process.env.VIP_ROLE_ID || ''),
  VIP_PLUS: getRoleIds(process.env.VIP_PLUS_ROLE_ID || ''),
  ADMIN: getRoleIds(process.env.ADMIN_ROLE_ID || ''),
  MODERATOR: getRoleIds(process.env.MODERATOR_ROLE_ID || ''),
  STAFF: getRoleIds(process.env.STAFF_ROLE_ID || ''),
  OWNER: getRoleIds(process.env.OWNER_ROLE_ID || ''),
  CAPPER: getRoleIds(process.env.CAPPER_ROLE_ID || ''),
  TRIAL: getRoleIds(process.env.TRIAL_ROLE_ID || ''),
};

// Helper function to safely check if a role matches any ID in a list
function hasRoleFromList(role: any, roleIds: string[]): boolean {
  return roleIds.length > 0 && roleIds.includes(role.id);
}

// Helper function to check if a role name matches, ignoring emojis
function matchesRoleName(roleName: string, targetName: string): boolean {
  // Remove emojis and trim
  const cleanRoleName = roleName
    .replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]/gu,
      ''
    )
    .trim();
  const cleanTargetName = targetName
    .replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]/gu,
      ''
    )
    .trim();

  return cleanRoleName.toLowerCase() === cleanTargetName.toLowerCase();
}

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
        fullError: error,
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
export async function getUserTierWithFreshFetch(
  guild: Guild,
  userId: string,
  optimisticTier?: string
): Promise<string> {
  // Check for recent optimistic upgrade
  const recentUpgrade = recentUpgrades.get(userId);
  if (recentUpgrade && Date.now() - recentUpgrade.timestamp < 30000) {
    // 30 seconds
    logger.info(
      `🚀 Using optimistic tier ${recentUpgrade.tier} for recently upgraded user ${userId}`
    );
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
export async function handleRoleUpgradeWithDelay(
  guild: Guild,
  userId: string,
  newTier: string,
  delayMs: number = 3000
): Promise<string> {
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

  // Log roles for debugging
  logger.debug(`Checking roles for ${member.user.tag}:`, {
    roles: roles.map(r => ({ id: r.id, name: r.name })),
  });

  // Check roles in order of precedence
  for (const role of roles.values()) {
    // Check Owner
    if (hasRoleFromList(role, ROLE_IDS.OWNER) || matchesRoleName(role.name, 'Owner')) {
      return 'owner';
    }
    // Check Admin
    if (hasRoleFromList(role, ROLE_IDS.ADMIN) || matchesRoleName(role.name, 'Admin')) {
      return 'admin';
    }
    // Check Staff/Moderator
    if (
      hasRoleFromList(role, ROLE_IDS.STAFF) ||
      hasRoleFromList(role, ROLE_IDS.MODERATOR) ||
      matchesRoleName(role.name, 'Staff') ||
      matchesRoleName(role.name, 'Moderator')
    ) {
      return 'staff';
    }
    // Check VIP+
    if (hasRoleFromList(role, ROLE_IDS.VIP_PLUS) || matchesRoleName(role.name, 'VIP+ Member')) {
      return 'vip_plus';
    }
    // Check VIP
    if (hasRoleFromList(role, ROLE_IDS.VIP) || matchesRoleName(role.name, 'VIP Member')) {
      return 'vip';
    }
    // Check Trial
    if (hasRoleFromList(role, ROLE_IDS.TRIAL) || matchesRoleName(role.name, 'Trial')) {
      return 'trial';
    }
    // Check Capper
    if (hasRoleFromList(role, ROLE_IDS.CAPPER) || matchesRoleName(role.name, 'UT Capper')) {
      return 'capper';
    }
  }

  // Default to member if no special roles found
  return 'member';
}

/**
 * Checks if a user has a specific tier or higher
 */
export function hasMinimumTier(
  member: GuildMember | PartialGuildMember | null,
  requiredTier: string
): boolean {
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

/**
 * Unit Talk Discord Bot - Configuration Adapter
 *
 * This adapter provides Discord Bot-specific configuration by importing from the
 * centralized environment configuration. This follows SaaS-level monorepo
 * best practices by maintaining a single source of truth while providing
 * application-specific interfaces.
 */

import { BotConfig } from '../types/index';

import { env } from './environment';

// =============================================================================
// DISCORD BOT CONFIGURATION USING CENTRALIZED ENV
// =============================================================================

export const botConfig: BotConfig = {
  prefix: '!',
  channels: {
    general: env.discord.channels.general,
    picks: env.discord.channels.freePicks, // Default to free picks
    vip: env.discord.channels.vipGeneral,
    vipPlus: env.discord.channels.vipPlusGeneral,
    admin: env.discord.channels.admin,
    logs: env.discord.channels.botLogs,
    announcements: env.discord.channels.announcements,
    freePicks: env.discord.channels.freePicks,
    vipPicks: env.discord.channels.vipPicks,
    vipGeneral: env.discord.channels.vipGeneral,
    vipPlusPicks: env.discord.channels.vipPlusPicks,
    vipPlusGeneral: env.discord.channels.vipPlusGeneral,
    threads: env.discord.channels.threads,
  },
  roles: {
    member: env.discord.roles.member || '',
    vip: env.discord.roles.vip[0] || '',
    vipPlus: env.discord.roles.vipPlus[0] || '',
    staff: env.discord.roles.staff[0] || '',
    admin: env.discord.roles.admin[0] || '',
    owner: env.discord.roles.owner[0] || '',
    moderator: env.discord.roles.moderator[0] || '',
  },
  features: {
    vipNotifications: env.features.dmNotificationsEnabled,
    autoThreads: env.features.threadManagementEnabled,
    keywordDMs: env.features.dmNotificationsEnabled,
    aiGrading: env.features.autoGradingEnabled,
    analytics: env.features.analyticsEnabled,
    autoGrading: env.features.autoGradingEnabled,
  },
  cooldowns: {
    picks: 60 * 60 * 1000, // 1 hour in milliseconds
    commands: 5 * 1000, // 5 seconds
    dms: 10 * 60 * 1000, // 10 minutes
  },
  limits: {
    maxPicksPerDay: env.pickManagement.limits.maxPicksPerDay,
    maxDMsPerHour: env.performance.limits.maxDmsPerHour,
    maxThreadsPerDay: env.performance.limits.maxThreadsPerDay,
    maxUnitsPerPick: env.pickManagement.limits.maxUnitsPerPick,
    threadAutoArchiveMinutes: env.performance.limits.threadAutoArchiveMinutes,
  },
  supabase: {
    url: env.database.supabaseUrl,
    key: env.database.supabaseAnonKey,
    serviceRoleKey: env.database.supabaseServiceRoleKey,
  },
  discord: {
    token: env.discord.botToken,
    clientId: env.discord.clientId,
    guildId: env.discord.guildId,
  },
  agents: {
    enabled: true, // Always enabled in production
    endpoints: {
      grading: env.urls.agents,
      analytics: env.urls.analytics,
    },
    baseUrl: env.urls.agents,
    apiKey: env.apiKeys.agents,
  },
};

export default botConfig;

// =============================================================================
// ADVANCED DISCORD BOT CONFIGURATION
// =============================================================================

/**
 * Advanced Discord Bot configuration interface following centralized pattern
 */
export interface DiscordBotConfiguration {
  // Server Configuration
  port: number;
  nodeEnv: string;
  logLevel: string;
  debugMode: boolean;

  // Discord Authentication
  discord: {
    botToken: string;
    token: string;
    clientId: string;
    guildId: string;
  };

  // Discord Roles
  roles: {
    admin: string[];
    moderator: string[];
    bot: string[];
    staff: string[];
    owner: string[];
    vip: string[];
    vipPlus: string[];
    capper: string[];
    trial: string[];
  };

  // Discord Channels
  channels: {
    // Core Communication
    announcements: string;
    general: string;
    welcome: string;

    // Pick Channels
    freePicks: string;
    vipPicks: string;
    vipPlusPicks: string;

    // VIP Arena (2x XP)
    vipGeneral: string;
    vipStrategyRoom: string;

    // VIP+ Arena (2.5x XP)
    vipPlusGeneral: string;
    vipPlusStrategyRoom: string;
    vipPlusExclusiveInsights: string;
    vipPlusTraderInsights: string;

    // Support & Community
    support: string;
    threads: string;
    sportsTalk: string;

    // Staff
    admin: string;
    botLogs: string;
  };

  // Database Configuration (v3.0.0 Unified Schema)
  database: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
  };

  // Platform Integration
  agents: {
    baseUrl: string;
    apiKey: string;
  };

  // XP System Configuration
  xpSystem: {
    enabled: boolean;
    multipliers: {
      general: number;
      vip: number;
      vipPlus: number;
    };
    channels: {
      general: string[];
      vip: string[];
      vipPlus: string[];
    };
  };

  // Feature Flags
  features: {
    autoGradingEnabled: boolean;
    dmNotificationsEnabled: boolean;
    analyticsEnabled: boolean;
    threadManagementEnabled: boolean;
    capperTrackingEnabled: boolean;
    forumManagementEnabled: boolean;
    capperThreadAutoCreate: boolean;
    capperQaThreadsEnabled: boolean;
    capperPerformanceTracking: boolean;
    capperDailyPickAggregation: boolean;
    xpSystemEnabled: boolean;
    leaderboardEnabled: boolean;
    engagementTrackingEnabled: boolean;
    milestoneCelebrationsEnabled: boolean;
    streakTrackingEnabled: boolean;
    achievementSystemEnabled: boolean;
    vipConversionTracking: boolean;
    trialUsageTracking: boolean;
    upgradeFunnelAnalytics: boolean;
    autoVipPromotionMessages: boolean;
    welcomeSystemEnabled: boolean;
    newMemberGuideEnabled: boolean;
    autoRoleSuggestions: boolean;
  };

  // Pick Management System
  pickManagement: {
    limits: {
      maxPicksPerDay: number;
      maxUnitsPerPick: number;
      minUnitsPerPick: number;
    };
    categories: string[];
    grading: {
      autoGradeDelayHours: number;
      gradeConfirmationRequired: boolean;
      manualGradeOverride: boolean;
    };
  };

  // System Performance & Limits
  performance: {
    rateLimitEnabled: boolean;
    autoBackupEnabled: boolean;
    cacheEnabled: boolean;
    limits: {
      threadAutoArchiveMinutes: number;
      forumAutoCleanupDays: number;
      capperThreadAutoArchiveHours: number;
      maxDmsPerHour: number;
      maxThreadsPerDay: number;
    };
  };

  // Integrations
  integrations: {
    notion?: {
      token: string;
    };
    webhooks?: {
      discordAlert: string;
      alertsChannelId: string;
    };
  };
}

class DiscordBotConfig implements DiscordBotConfiguration {
  // Server Configuration
  get port(): number {
    return env.ports.discordBot;
  }

  get nodeEnv(): string {
    return env.environment;
  }

  get logLevel(): string {
    return env.logLevel;
  }

  get debugMode(): boolean {
    return env.debugMode;
  }

  // Discord Authentication
  get discord() {
    return {
      botToken: env.discord.botToken,
      token: env.discord.token,
      clientId: env.discord.clientId,
      guildId: env.discord.guildId,
    };
  }

  // Discord Roles
  get roles() {
    return env.discord.roles;
  }

  // Discord Channels
  get channels() {
    return env.discord.channels;
  }

  // Database Configuration (v3.0.0 Unified Schema)
  get database() {
    return {
      supabaseUrl: env.database.supabaseUrl,
      supabaseAnonKey: env.database.supabaseAnonKey,
      supabaseServiceRoleKey: env.database.supabaseServiceRoleKey,
    };
  }

  // Platform Integration
  get agents() {
    return {
      baseUrl: env.urls.agents,
      apiKey: env.apiKeys.agents,
    };
  }

  // XP System Configuration
  get xpSystem() {
    return {
      enabled: env.features.xpSystemEnabled,
      multipliers: env.xpSystem.multipliers,
      channels: env.xpSystem.channels,
    };
  }

  // Feature Flags
  get features() {
    return env.features;
  }

  // Pick Management System
  get pickManagement() {
    return env.pickManagement;
  }

  // System Performance & Limits
  get performance() {
    return {
      rateLimitEnabled: env.performance.rateLimitEnabled,
      autoBackupEnabled: env.performance.autoBackupEnabled,
      cacheEnabled: env.performance.cacheEnabled,
      limits: env.performance.limits,
    };
  }

  // Integrations
  get integrations() {
    const integrations: DiscordBotConfiguration['integrations'] = {};

    if (env.all.NOTION_TOKEN) {
      integrations.notion = {
        token: env.all.NOTION_TOKEN,
      };
    }

    if (env.all.DISCORD_ALERT_WEBHOOK && env.all.ALERTS_CHANNEL_ID) {
      integrations.webhooks = {
        discordAlert: env.all.DISCORD_ALERT_WEBHOOK,
        alertsChannelId: env.all.ALERTS_CHANNEL_ID,
      };
    }

    return integrations;
  }

  // Convenience Methods
  get isProduction(): boolean {
    return env.isProduction;
  }

  get isDevelopment(): boolean {
    return env.isDevelopment;
  }

  get isStaging(): boolean {
    return env.isStaging;
  }
}

// Export the advanced configuration as well
export const discordBotConfig = new DiscordBotConfig();

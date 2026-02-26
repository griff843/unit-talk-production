/**
 * Discord Routing Configuration
 *
 * SPRINT-FOUNDATION-TRUTH-LOCK-094A
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 *
 * Canonical resolver for all Discord routing configuration.
 * Tracks resolution source for observability.
 *
 * RULE: All Discord routing reads MUST go through this module.
 * Do NOT scatter process.env reads throughout the codebase.
 *
 * ROUTING CONTRACT (SPRINT-B4):
 * - DISCORD_MODE="canary" → ALL posts go to DISCORD_CANARY_WEBHOOK_URL
 * - DISCORD_MODE="production" → posts route to explicit per-channel webhooks
 * - Misconfiguration → fail-closed (boot failure or gate violation)
 */

import {
  RuntimeDiscordRoutingEnvSchema,
  DISCORD_PRODUCTION_CHANNELS,
  type DiscordMode,
  type DiscordProductionChannel,
} from '@unit-talk/config';

export type ResolutionSource = 'env' | 'db' | 'default' | 'unset' | 'canary' | 'production';

/**
 * Channel-to-webhook mapping for production mode.
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 */
export type ProductionWebhookMap = Record<DiscordProductionChannel, string | null>;

export interface DiscordRoutingConfig {
  /** Current routing mode: canary routes all to single URL, production uses per-channel */
  mode: DiscordMode | null;
  /** Canary webhook URL (used when mode=canary) */
  canaryWebhookUrl: string | null;
  /** Per-channel webhook URLs (used when mode=production) */
  productionWebhooks: ProductionWebhookMap;
  /** Legacy single webhook URL (deprecated, use mode-based routing) */
  webhookUrl: string | null;
  channelId: string | null;
  workerEnabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  staleClaimThresholdSeconds: number;
  resolution: {
    mode: ResolutionSource;
    webhookUrl: ResolutionSource;
    channelId: ResolutionSource;
    workerEnabled: ResolutionSource;
  };
}

/**
 * Resolve Discord routing configuration from environment.
 * This is the SINGLE source of truth for Discord routing config.
 */
// eslint-disable-next-line complexity -- SPRINT-B4: builds comprehensive config from multiple env vars
export function resolveDiscordRoutingConfig(): DiscordRoutingConfig {
  const mode = (process.env['DISCORD_MODE'] as DiscordMode) || null;
  const canaryWebhookUrl = process.env['DISCORD_CANARY_WEBHOOK_URL'] || null;

  // Build production webhook map
  const productionWebhooks: ProductionWebhookMap = {
    TRADER_INSIGHTS: process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] || null,
    BEST_BETS: process.env['DISCORD_WEBHOOK_BEST_BETS'] || null,
    STRATEGY_LAB: process.env['DISCORD_WEBHOOK_STRATEGY_LAB'] || null,
    FREE_DAILY_PICKS: process.env['DISCORD_WEBHOOK_FREE_DAILY_PICKS'] || null,
    VIP_LOUNGE: process.env['DISCORD_WEBHOOK_VIP_LOUNGE'] || null,
    INFO_CENTER: process.env['DISCORD_WEBHOOK_INFO_CENTER'] || null,
    RECAPS: process.env['DISCORD_WEBHOOK_RECAPS'] || null,
  };

  // Legacy webhook URL (for backward compatibility)
  const webhookUrl = process.env['DISCORD_WEBHOOK_URL'] || null;
  const channelId = process.env['DEFAULT_DISCORD_TICKET_CHANNEL_ID'] || null;
  const workerEnabled = process.env['ENABLE_DISCORD_TICKET_WORKER'] === 'true';
  const pollIntervalMs = parseInt(process.env['TICKET_DISCORD_POLL_INTERVAL'] || '10000', 10);
  const batchSize = parseInt(process.env['TICKET_DISCORD_BATCH_SIZE'] || '10', 10);
  const staleClaimThresholdSeconds = parseInt(
    process.env['TICKET_DISCORD_STALE_CLAIM_SECONDS'] || '60',
    10
  );

  return {
    mode,
    canaryWebhookUrl,
    productionWebhooks,
    webhookUrl,
    channelId,
    workerEnabled,
    pollIntervalMs,
    batchSize,
    staleClaimThresholdSeconds,
    resolution: {
      mode: mode ? 'env' : 'unset',
      webhookUrl: webhookUrl ? 'env' : 'unset',
      channelId: channelId ? 'env' : 'unset',
      workerEnabled: process.env['ENABLE_DISCORD_TICKET_WORKER'] ? 'env' : 'default',
    },
  };
}

/**
 * Get webhook URL for a specific channel based on current mode.
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 *
 * @param channel - Target channel for the post
 * @returns Webhook URL or null if not configured
 */
export function getWebhookForChannel(channel: DiscordProductionChannel): string | null {
  const config = resolveDiscordRoutingConfig();

  if (config.mode === 'canary') {
    // Canary mode: all posts go to canary webhook
    return config.canaryWebhookUrl;
  } else if (config.mode === 'production') {
    // Production mode: route to per-channel webhook
    // eslint-disable-next-line security/detect-object-injection -- channel is typed enum, not user input
    return config.productionWebhooks[channel];
  }

  // No mode set - fallback to legacy single webhook (deprecation path)
  return config.webhookUrl;
}

/**
 * Require webhook URL for a channel (throws if not configured).
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 *
 * @param channel - Target channel for the post
 * @returns Webhook URL
 * @throws Error if webhook not configured for channel
 */
export function requireWebhookForChannel(channel: DiscordProductionChannel): string {
  const config = resolveDiscordRoutingConfig();
  const url = getWebhookForChannel(channel);

  if (!url) {
    if (config.mode === 'canary') {
      throw new Error(`DISCORD_CANARY_WEBHOOK_URL is required in canary mode but not configured.`);
    } else if (config.mode === 'production') {
      throw new Error(
        `DISCORD_WEBHOOK_${channel} is required in production mode but not configured.`
      );
    } else {
      throw new Error(
        `Discord webhook not configured. Set DISCORD_MODE and appropriate webhook URLs.`
      );
    }
  }

  return url;
}

/**
 * Validate Discord routing configuration for mode-based routing.
 * FAIL-CLOSED: Returns issues if configuration is invalid.
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 *
 * @returns Array of validation issues (empty = valid)
 */
export function validateDiscordRoutingConfig(): string[] {
  const config = resolveDiscordRoutingConfig();
  const issues: string[] = [];

  if (!config.mode) {
    issues.push('DISCORD_MODE not set (required: "canary" or "production")');
    return issues;
  }

  if (config.mode !== 'canary' && config.mode !== 'production') {
    issues.push(`Invalid DISCORD_MODE: "${config.mode}" (must be "canary" or "production")`);
    return issues;
  }

  if (config.mode === 'canary') {
    if (!config.canaryWebhookUrl) {
      issues.push('DISCORD_CANARY_WEBHOOK_URL is required when DISCORD_MODE=canary');
    }
  } else if (config.mode === 'production') {
    // Check all production webhooks are configured
    for (const channel of DISCORD_PRODUCTION_CHANNELS) {
      // eslint-disable-next-line security/detect-object-injection -- channel is from const array, not user input
      if (!config.productionWebhooks[channel]) {
        issues.push(`DISCORD_WEBHOOK_${channel} is required when DISCORD_MODE=production`);
      }
    }
  }

  return issues;
}

/**
 * Check if Discord routing is properly configured.
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 *
 * @returns true if routing is valid, false otherwise
 */
export function isDiscordRoutingConfigured(): boolean {
  return validateDiscordRoutingConfig().length === 0;
}

/**
 * Parse and validate Discord routing env vars using Zod schema.
 * FAIL-CLOSED: Throws ZodError on invalid configuration.
 * SPRINT-B4-DISCORD-CANARY-ROUTING-004
 *
 * @returns Validated routing env
 * @throws ZodError if configuration is invalid
 */
export function parseDiscordRoutingEnv() {
  return RuntimeDiscordRoutingEnvSchema.parse({
    DISCORD_MODE: process.env['DISCORD_MODE'],
    DISCORD_CANARY_WEBHOOK_URL: process.env['DISCORD_CANARY_WEBHOOK_URL'],
    DISCORD_WEBHOOK_TRADER_INSIGHTS: process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'],
    DISCORD_WEBHOOK_BEST_BETS: process.env['DISCORD_WEBHOOK_BEST_BETS'],
    DISCORD_WEBHOOK_STRATEGY_LAB: process.env['DISCORD_WEBHOOK_STRATEGY_LAB'],
    DISCORD_WEBHOOK_FREE_DAILY_PICKS: process.env['DISCORD_WEBHOOK_FREE_DAILY_PICKS'],
    DISCORD_WEBHOOK_VIP_LOUNGE: process.env['DISCORD_WEBHOOK_VIP_LOUNGE'],
    DISCORD_WEBHOOK_INFO_CENTER: process.env['DISCORD_WEBHOOK_INFO_CENTER'],
    DISCORD_WEBHOOK_RECAPS: process.env['DISCORD_WEBHOOK_RECAPS'],
  });
}

/**
 * Get a snapshot of the current Discord routing config.
 * Includes all values and their resolution sources.
 */
export function getDiscordRoutingSnapshot(): DiscordRoutingConfig & { timestamp: string } {
  return {
    ...resolveDiscordRoutingConfig(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate Discord routing config for worker readiness.
 * Returns issues array (empty = ready).
 * @deprecated Use validateDiscordRoutingConfig() for mode-based routing
 */
export function validateDiscordRoutingReadiness(): string[] {
  const config = resolveDiscordRoutingConfig();
  const issues: string[] = [];

  if (!config.workerEnabled) {
    issues.push('ENABLE_DISCORD_TICKET_WORKER not set to true');
  }

  // Check mode-based routing first
  const routingIssues = validateDiscordRoutingConfig();
  if (routingIssues.length > 0) {
    issues.push(...routingIssues);
  } else if (!config.webhookUrl && !config.mode) {
    // Fallback: legacy webhook check if mode not set
    issues.push('DISCORD_WEBHOOK_URL not configured (or set DISCORD_MODE for new routing)');
  }

  if (!config.channelId) {
    issues.push('DEFAULT_DISCORD_TICKET_CHANNEL_ID not configured');
  }

  return issues;
}

/**
 * Check if Discord worker is ready to process.
 */
export function isDiscordWorkerReady(): boolean {
  return validateDiscordRoutingReadiness().length === 0;
}

// Export singleton for convenience
export const discordRoutingConfig = resolveDiscordRoutingConfig();

// Re-export channel constants
export { DISCORD_PRODUCTION_CHANNELS, type DiscordProductionChannel };

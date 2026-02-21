/**
 * Discord Routing Configuration
 *
 * SPRINT-FOUNDATION-TRUTH-LOCK-094A
 *
 * Canonical resolver for all Discord routing configuration.
 * Tracks resolution source for observability.
 *
 * RULE: All Discord routing reads MUST go through this module.
 * Do NOT scatter process.env reads throughout the codebase.
 */

export type ResolutionSource = 'env' | 'db' | 'default' | 'unset';

export interface DiscordRoutingConfig {
  webhookUrl: string | null;
  channelId: string | null;
  workerEnabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  staleClaimThresholdSeconds: number;
  resolution: {
    webhookUrl: ResolutionSource;
    channelId: ResolutionSource;
    workerEnabled: ResolutionSource;
  };
}

/**
 * Resolve Discord routing configuration from environment.
 * This is the SINGLE source of truth for Discord routing config.
 */
export function resolveDiscordRoutingConfig(): DiscordRoutingConfig {
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
    webhookUrl,
    channelId,
    workerEnabled,
    pollIntervalMs,
    batchSize,
    staleClaimThresholdSeconds,
    resolution: {
      webhookUrl: webhookUrl ? 'env' : 'unset',
      channelId: channelId ? 'env' : 'unset',
      workerEnabled: process.env['ENABLE_DISCORD_TICKET_WORKER'] ? 'env' : 'default',
    },
  };
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
 */
export function validateDiscordRoutingReadiness(): string[] {
  const config = resolveDiscordRoutingConfig();
  const issues: string[] = [];

  if (!config.workerEnabled) {
    issues.push('ENABLE_DISCORD_TICKET_WORKER not set to true');
  }

  if (!config.webhookUrl) {
    issues.push('DISCORD_WEBHOOK_URL not configured');
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

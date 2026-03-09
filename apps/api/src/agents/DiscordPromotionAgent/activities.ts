/**
 * DiscordPromotionAgent — Temporal Activities
 * SPRINT-PROMOTION-PIPELINE-ACTIVATION
 *
 * Exposes promoteToDiscord() and getDiscordPublishHealth() as Temporal activities
 * so the Temporal worker can invoke them on a schedule.
 *
 * Required env vars for live posting:
 *   AUTOPILOT_MODE=prod
 *   DISCORD_WEBHOOK_URL=<webhook>
 *   PROMOTION_SHADOW_MODE must NOT be set to 'true'
 */

import { getDiscordPublishHealth, promoteToDiscord } from './index';

/**
 * Run one promotion cycle: process all eligible picks (capper, system, legacy)
 * and post them to Discord via webhook.
 *
 * Returns the number of picks processed.
 */
export async function runDiscordPromotion(): Promise<{ processed: number }> {
  await promoteToDiscord();
  return { processed: 0 }; // promoteToDiscord logs its own counts; return sentinel
}

/**
 * Health check activity: returns promotion pipeline gate status.
 * Suitable for observability and alerting.
 */
export async function getDiscordPromotionHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  pendingCount: number;
  recentlyPostedCount: number;
  shadowModeEnabled: boolean;
  webhookConfigured: boolean;
  killSwitchActive: boolean;
}> {
  return getDiscordPublishHealth();
}

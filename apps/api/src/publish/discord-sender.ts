/**
 * Discord Sender with Idempotency
 *
 * Sends pick publish messages to Discord with:
 * - Idempotency header support
 * - Capper thread mapping
 * - Webhook and bot token fallback
 * - Secure logging (no tokens in logs)
 * - Embed formatting
 */

import { env } from '../config/env';
import { logger } from '../shared/logger';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
  };
}

export interface DiscordSendOptions {
  /**
   * Idempotency key for Discord API
   * Prevents duplicate messages if request is retried
   */
  dedupeKey?: string;

  /**
   * Explicit Discord channel ID to send to
   * PRIORITY: If provided, this channel will be used before any fallbacks
   */
  discordChannelId?: string;

  /**
   * Capper name for thread mapping
   */
  capperName?: string;

  /**
   * Tenant ID for logging
   */
  tenantId?: string;

  /**
   * Pick ID for logging
   */
  pickId?: string;
}

export interface DiscordSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channelId?: string;
}

/**
 * Send embed to Discord
 *
 * Attempts delivery via:
 * 1. Capper-specific thread (if capperName provided and thread ID configured)
 * 2. Dedicated alerts channel (if ALERTS_CHANNEL_ID configured)
 * 3. Webhook URL (if DISCORD_WEBHOOK_URL configured)
 *
 * @param embed - Discord embed payload
 * @param options - Send options including idempotency key
 * @returns Send result with message ID or error
 */
// eslint-disable-next-line max-lines-per-function -- Critical channel routing logic requires comprehensive error handling
export async function sendEmbed(
  embed: DiscordEmbed,
  options: DiscordSendOptions = {}
): Promise<DiscordSendResult> {
  const { dedupeKey, discordChannelId, capperName, tenantId, pickId } = options;

  logger.info('Sending Discord embed', {
    event: 'discord_send_start',
    tenantId,
    pickId,
    capperName,
    discordChannelId,
    dedupeKeyPresent: !!dedupeKey,
    embedTitle: embed.title,
  });

  // Determine target channel/thread
  const target = getDiscordTarget(discordChannelId, capperName);

  if (!target) {
    const error = 'No Discord channel or webhook configured';
    logger.error('Discord send failed - no target', {
      event: 'discord_send_failed',
      error,
      tenantId,
      pickId,
      capperName,
    });

    return {
      success: false,
      error,
    };
  }

  try {
    // Send via appropriate method
    if (target.type === 'webhook') {
      return await sendViaWebhook(embed, target.url, dedupeKey, { tenantId, pickId });
    } else if (target.type === 'bot') {
      return await sendViaBot(embed, target.channelId, target.threadId, dedupeKey, {
        tenantId,
        pickId,
      });
    } else {
      throw new Error(`Unknown target type: ${(target as any).type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Discord send failed', {
      event: 'discord_send_failed',
      error: errorMessage,
      tenantId,
      pickId,
      capperName,
      targetType: target.type,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get Discord target (webhook or channel/thread)
 *
 * ROUTING PRIORITY:
 * 1. Explicit discordChannelId (from pick_publish.discord_channel_id)
 * 2. Capper-specific thread
 * 3. Alerts channel fallback
 * 4. Webhook URL fallback
 */
function getDiscordTarget(
  discordChannelId?: string,
  capperName?: string
): { type: 'webhook'; url: string } | { type: 'bot'; channelId: string; threadId?: string } | null {
  // PRIORITY 1: Use explicit channel ID if provided (from pick_publish table)
  if (discordChannelId) {
    logger.info('Using explicit Discord channel ID', {
      event: 'discord_target_explicit',
      discordChannelId,
    });
    return {
      type: 'bot',
      channelId: discordChannelId,
    };
  }

  // PRIORITY 2: Try capper-specific thread
  if (capperName && env.capperThreads) {
    const threadId = env.capperThreads[capperName];
    if (threadId && env.alertsChannelId) {
      return {
        type: 'bot',
        channelId: env.alertsChannelId,
        threadId,
      };
    }
  }

  // PRIORITY 3: Try dedicated alerts channel
  if (env.alertsChannelId) {
    return {
      type: 'bot',
      channelId: env.alertsChannelId,
    };
  }

  // PRIORITY 4: Try webhook URL
  if (process.env.DISCORD_WEBHOOK_URL) {
    return {
      type: 'webhook',
      url: process.env.DISCORD_WEBHOOK_URL,
    };
  }

  return null;
}

/**
 * Send via Discord webhook
 */
async function sendViaWebhook(
  embed: DiscordEmbed,
  webhookUrl: string,
  dedupeKey?: string,
  context?: { tenantId?: string; pickId?: string }
): Promise<DiscordSendResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add idempotency header if supported and key provided
  if (dedupeKey) {
    headers['X-Idempotency-Key'] = dedupeKey;
  }

  const payload = {
    embeds: [embed],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${errorText.substring(0, 200)}`);
  }

  // Discord doesn't return message ID for webhooks without wait=true
  // For idempotency, we rely on dedupeKey header or database tracking
  logger.info('Discord webhook send successful', {
    event: 'discord_webhook_success',
    status: response.status,
    dedupeKeyUsed: !!dedupeKey,
    ...context,
  });

  return {
    success: true,
    messageId: 'webhook-' + Date.now(), // Synthetic ID for tracking
  };
}

/**
 * Send via Discord bot (channel or thread)
 */
// eslint-disable-next-line max-lines-per-function, max-params -- Discord bot API requires multiple parameters and comprehensive error handling
async function sendViaBot(
  embed: DiscordEmbed,
  channelId: string,
  threadId: string | undefined,
  dedupeKey: string | undefined,
  context?: { tenantId?: string; pickId?: string }
): Promise<DiscordSendResult> {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error('DISCORD_BOT_TOKEN not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bot ${botToken}`,
  };

  // Add idempotency header if supported and key provided
  if (dedupeKey) {
    headers['X-Idempotency-Key'] = dedupeKey;
  }

  const payload: any = {
    embeds: [embed],
  };

  // If thread ID provided, include in payload
  if (threadId) {
    payload.thread_id = threadId;
  }

  // Send to channel or thread
  const targetId = threadId || channelId;
  const url = `https://discord.com/api/v10/channels/${targetId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord bot send failed: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const data = (await response.json()) as { id?: string };
  const messageId = data.id || 'unknown';

  logger.info('Discord bot send successful', {
    event: 'discord_bot_success',
    messageId,
    channelId: targetId,
    isThread: !!threadId,
    dedupeKeyUsed: !!dedupeKey,
    ...context,
  });

  return {
    success: true,
    messageId,
    channelId: targetId,
  };
}

/**
 * Format pick data as Discord embed
 */
// eslint-disable-next-line max-lines-per-function, complexity -- Rich embed formatting requires handling multiple pick properties
export function formatPickEmbed(pick: any): DiscordEmbed {
  const fields: DiscordEmbedField[] = [
    {
      name: '🏆 Sport',
      value: pick.league || pick.sport || 'Unknown',
      inline: true,
    },
    {
      name: '📊 Market',
      value: pick.market_type || pick.marketType || 'Unknown',
      inline: true,
    },
    {
      name: '⬆️ Side',
      value: (pick.side || pick.direction || 'Unknown').toUpperCase(),
      inline: true,
    },
    {
      name: '📏 Line',
      value: String(pick.line || 'N/A'),
      inline: true,
    },
    {
      name: '💰 Odds',
      value: String(pick.odds || -110),
      inline: true,
    },
    {
      name: '🎯 Confidence',
      value: String(pick.confidence_score || pick.userScore || 75),
      inline: true,
    },
  ];

  // Add tier if available
  if (pick.tier) {
    fields.push({
      name: '⭐ Tier',
      value: pick.tier,
      inline: true,
    });
  }

  // Add professional score if available
  if (pick.professional_score) {
    fields.push({
      name: '🎓 Professional Score',
      value: String(pick.professional_score),
      inline: true,
    });
  }

  return {
    title: `🔥 ${pick.player_name || pick.playerName || 'New Pick'}`,
    description: pick.notes || undefined,
    color: 0x00ff00, // Green
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Unit Talk • Professional Betting Intelligence',
    },
  };
}

import { EmbedBuilder } from 'discord.js';
import { NotificationPayload, NotificationChannelConfig } from '../types';

export interface UnitTalkAlert {
  type: 'injury' | 'line_move' | 'middling' | 'info';
  title: string;
  summary: string;
  instruction: string;
  impact?: string | number;
  market?: string;
  player?: string;
  team?: string;
  oldLine?: string;
  oldOdds?: string;
  newLine?: string;
  newOdds?: string;
  source?: string;
  extraFields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: Date | string;
}

function getAlertStyle(type: UnitTalkAlert['type']) {
  switch (type) {
    case 'injury':
      return { color: 0xED4245, emoji: '🚨', title: 'Critical Injury Impact' };
    case 'line_move':
      return { color: 0xFFA500, emoji: '🔥', title: 'Significant Line Movement' };
    case 'middling':
      return { color: 0x2ecc71, emoji: '💰', title: 'Middling/Arb Opportunity' };
    case 'info':
    default:
      return { color: 0x5865F2, emoji: '💡', title: 'Unit Talk Advice' };
  }
}

export function buildUnitTalkAlertEmbed(alert: UnitTalkAlert) {
  const style = getAlertStyle(alert.type);

  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setTitle(`${style.emoji} ${alert.title || style.title}`)
    .setDescription(`**${alert.instruction}**\n${alert.summary}`)
    .setFooter({ text: `Unit Talk Advice${alert.source ? ` | Source: ${alert.source}` : ''}` })
    .setTimestamp(alert.timestamp ? new Date(alert.timestamp) : new Date());

  // Add core fields
  if (alert.market) embed.addFields({ name: 'Market', value: alert.market, inline: true });
  if (alert.player) embed.addFields({ name: 'Player', value: alert.player, inline: true });
  if (alert.team) embed.addFields({ name: 'Team', value: alert.team, inline: true });
  if (alert.oldLine || alert.oldOdds)
    embed.addFields({ name: 'Old Line', value: `${alert.oldLine ?? ''} / ${alert.oldOdds ?? ''}`.trim(), inline: true });
  if (alert.newLine || alert.newOdds)
    embed.addFields({ name: 'New Line', value: `${alert.newLine ?? ''} / ${alert.newOdds ?? ''}`.trim(), inline: true });
  if (alert.impact)
    embed.addFields({ name: 'Impact', value: `**${alert.impact}**`, inline: true });

  // Add extra fields if provided
  if (alert.extraFields && Array.isArray(alert.extraFields)) {
    for (const field of alert.extraFields) {
      embed.addFields(field);
    }
  }

  return embed;
}

export async function sendDiscordNotification(
  payload: NotificationPayload,
  config: NotificationChannelConfig
): Promise<void> {
  if (!config.webhookUrl) {
    throw new Error('Discord webhook URL is required');
  }

  const embed = {
    embeds: [{
      title: payload.title || 'Notification',
      description: payload.message,
      color: 5814783, // Default blue color
      fields: payload.meta ? Object.entries(payload.meta).map(([key, value]) => ({
        name: key,
        value: String(value),
        inline: true
      })) : [],
      timestamp: new Date().toISOString()
    }]
  };

  // Handle channel-specific options
  if (payload.channelOptions?.discord?.embed) {
    embed.embeds[0] = { ...embed.embeds[0], ...payload.channelOptions.discord.embed };
  }

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embed)
  });

  if (!response.ok) {
    throw new Error(`Discord notification failed: ${response.statusText}`);
  }
}

/**
 * Discord Alert Provider - Phase 3
 *
 * Sends alerts to Discord via webhook.
 * NO SECRETS PRINTED - webhook URL is redacted in logs.
 */

import type { Alert } from '../../slo/types';

function redactWebhookUrl(url: string): string {
  // Redact everything after /webhooks/ except last 4 characters
  const match = url.match(/^(https:\/\/discord\.com\/api\/webhooks\/)([^\/]+)\/(.+)$/);
  if (match) {
    const [, prefix, id, token] = match;
    const redactedId = id.substring(0, 4) + '***' + id.substring(id.length - 4);
    const redactedToken = '***' + token.substring(token.length - 4);
    return `${prefix}${redactedId}/${redactedToken}`;
  }
  return '***REDACTED***';
}

function getSeverityColor(severity: Alert['severity']): number {
  switch (severity) {
    case 'critical':
      return 0xff0000; // Red
    case 'warning':
      return 0xffa500; // Orange
    case 'info':
      return 0x0099ff; // Blue
    default:
      return 0x808080; // Gray
  }
}

function getSeverityEmoji(severity: Alert['severity']): string {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '❓';
  }
}

export async function sendDiscordAlert(alert: Alert, webhookUrl: string): Promise<void> {
  const redactedUrl = redactWebhookUrl(webhookUrl);
  console.log(`[Discord] Sending alert to ${redactedUrl}`);

  const embed = {
    title: `${getSeverityEmoji(alert.severity)} ${alert.title}`,
    description: alert.message,
    color: getSeverityColor(alert.severity),
    fields: [
      {
        name: 'SLO',
        value: alert.slo_name,
        inline: true,
      },
      {
        name: 'Current Value',
        value: alert.current_value !== null ? String(alert.current_value) : 'N/A',
        inline: true,
      },
      {
        name: 'Threshold',
        value: String(alert.threshold),
        inline: true,
      },
      {
        name: 'Data Source',
        value: alert.data_source,
        inline: true,
      },
      {
        name: 'Severity',
        value: alert.severity.toUpperCase(),
        inline: true,
      },
    ],
    timestamp: alert.created_at,
    footer: {
      text: 'Unit Talk Command Center - Automated SLO Alert',
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'SLO Monitor',
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }

    console.log(`[Discord] Alert sent successfully: ${alert.title}`);
  } catch (error) {
    console.error(`[Discord] Failed to send alert:`, error);
    throw error;
  }
}

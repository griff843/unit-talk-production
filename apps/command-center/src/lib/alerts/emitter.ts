/**
 * Alert Emitter - Phase 3
 *
 * Handles alert emission with deduplication and rate limiting.
 * Routes alerts to configured providers (Discord, DB, Log).
 *
 * NO SECRETS PRINTED - webhook URLs and tokens are redacted in logs.
 */

import type { Alert, AlertChannel, AlertingConfig } from '../slo/types';
import { sendDiscordAlert } from './providers/discord';
import { writeAlertToDB } from './providers/db';
import { logAlert } from './providers/log';

// =============================================================================
// Alert Deduplication Store (in-memory for now)
// =============================================================================

interface AlertDedupeEntry {
  fingerprint: string;
  lastEmitted: number;
}

const recentAlerts = new Map<string, AlertDedupeEntry>();

function shouldSuppressAlert(fingerprint: string, rateLimitMinutes: number): boolean {
  const existing = recentAlerts.get(fingerprint);

  if (!existing) {
    return false;
  }

  const nowMs = Date.now();
  const elapsedMinutes = (nowMs - existing.lastEmitted) / (1000 * 60);

  if (elapsedMinutes < rateLimitMinutes) {
    console.log(
      `[Alerts] Suppressing duplicate alert ${fingerprint} (last emitted ${Math.floor(elapsedMinutes)}m ago)`
    );
    return true;
  }

  return false;
}

function recordAlertEmission(fingerprint: string) {
  recentAlerts.set(fingerprint, {
    fingerprint,
    lastEmitted: Date.now(),
  });

  // Cleanup old entries (older than 24 hours)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, entry] of recentAlerts.entries()) {
    if (entry.lastEmitted < cutoff) {
      recentAlerts.delete(key);
    }
  }
}

// =============================================================================
// Configuration
// =============================================================================

export function getAlertingConfig(): AlertingConfig {
  const enabled = process.env.ALERTING_ENABLED !== 'false'; // Default: true
  const channel: AlertChannel =
    (process.env.ALERTING_CHANNEL as AlertChannel) || 'log';
  const discordWebhookUrl = process.env.DISCORD_ALERT_WEBHOOK || process.env.DISCORD_OPERATOR_WEBHOOK_URL;
  const rateLimitMinutes = parseInt(
    process.env.ALERTING_RATE_LIMIT_MINUTES || '10',
    10
  );

  return {
    enabled,
    channel,
    discordWebhookUrl,
    rateLimitMinutes,
  };
}

// =============================================================================
// Alert Emission
// =============================================================================

export async function emitAlert(alert: Alert): Promise<void> {
  const config = getAlertingConfig();

  if (!config.enabled) {
    console.log('[Alerts] Alerting disabled via ALERTING_ENABLED=false');
    return;
  }

  // Check for deduplication
  if (shouldSuppressAlert(alert.fingerprint, config.rateLimitMinutes)) {
    return; // Suppressed
  }

  try {
    // Route to appropriate provider(s)
    if (config.channel === 'discord') {
      if (!config.discordWebhookUrl) {
        console.warn('[Alerts] Discord channel selected but no webhook URL configured');
        // Fallback to log
        await logAlert(alert);
      } else {
        await sendDiscordAlert(alert, config.discordWebhookUrl);
      }
    } else if (config.channel === 'db') {
      await writeAlertToDB(alert);
    } else {
      // Default: log
      await logAlert(alert);
    }

    // Always write to DB for history (if channel is not already db)
    if (config.channel !== 'db') {
      await writeAlertToDB(alert).catch(err => {
        console.warn('[Alerts] Failed to write alert to DB for history:', err.message);
      });
    }

    // Record emission for deduplication
    recordAlertEmission(alert.fingerprint);

    console.log(`[Alerts] Alert emitted: ${alert.title} (severity: ${alert.severity})`);
  } catch (error) {
    console.error('[Alerts] Failed to emit alert:', error);
    throw error;
  }
}

export async function emitAlerts(alerts: Alert[]): Promise<void> {
  const results = await Promise.allSettled(
    alerts.map(alert => emitAlert(alert))
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`[Alerts] ${failures.length} of ${alerts.length} alerts failed to emit`);
  } else {
    console.log(`[Alerts] Successfully emitted ${alerts.length} alerts`);
  }
}

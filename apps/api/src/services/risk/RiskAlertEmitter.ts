/* eslint-disable no-console, security/detect-object-injection */
/**
 * RiskAlertEmitter — Discord alerts for risk events
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Rate-limited: 5-minute cooldown per alert type.
 * Uses DISCORD_ALERT_WEBHOOK env var.
 */

import type { ExposureBreach, DriftState } from './types';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cooldown tracker
const lastSent: Record<string, number> = {};

function isCooledDown(alertType: string): boolean {
  const last = lastSent[alertType];
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function markSent(alertType: string): void {
  lastSent[alertType] = Date.now();
}

/**
 * Send a Discord webhook alert. Returns true if sent, false if cooled down or no webhook.
 */
async function sendWebhook(alertType: string, embed: Record<string, unknown>): Promise<boolean> {
  if (isCooledDown(alertType)) return false;

  const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
  if (!webhookUrl) {
    console.warn('[RiskAlertEmitter] No DISCORD_ALERT_WEBHOOK configured');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (response.ok) {
      markSent(alertType);
      return true;
    }

    console.error(`[RiskAlertEmitter] Webhook failed: ${response.status} ${response.statusText}`);
    return false;
  } catch (err) {
    console.error('[RiskAlertEmitter] Webhook error:', err);
    return false;
  }
}

/**
 * Alert: Exposure breach detected.
 */
export async function emitExposureBreach(
  totalKelly: number,
  breaches: ExposureBreach[]
): Promise<boolean> {
  const topBreach = breaches[0];
  const severity = breaches.some(b => b.severity === 'critical') ? 'CRITICAL' : 'HIGH';

  return sendWebhook('EXPOSURE_BREACH', {
    title: `RISK ALERT: Exposure Breach (${severity})`,
    color: 0xff0000,
    fields: [
      { name: 'Total Kelly Exposure', value: totalKelly.toFixed(4), inline: true },
      {
        name: 'Top Breach',
        value: topBreach
          ? `${topBreach.dimension}:${topBreach.key} = ${topBreach.current.toFixed(4)} > ${topBreach.limit}`
          : 'N/A',
        inline: true,
      },
      { name: 'Total Breaches', value: String(breaches.length), inline: true },
      { name: 'Action', value: 'Promotions BLOCKED until exposure reduced', inline: false },
    ],
    timestamp: new Date().toISOString(),
  });
}

/**
 * Alert: Drift throttle activated.
 */
export async function emitDriftThrottle(drift: DriftState): Promise<boolean> {
  return sendWebhook('DRIFT_THROTTLE', {
    title: 'RISK ALERT: Model Drift Detected',
    color: 0xff6600,
    fields: [
      { name: 'Brier Score', value: drift.global_brier?.toFixed(4) ?? 'N/A', inline: true },
      { name: 'Calibration Gap', value: drift.calibration_gap?.toFixed(4) ?? 'N/A', inline: true },
      { name: 'Sample Size', value: String(drift.sample_size), inline: true },
      {
        name: 'Win Rates',
        value: `Predicted: ${drift.win_rate_predicted?.toFixed(3) ?? '?'} | Actual: ${drift.win_rate_actual?.toFixed(3) ?? '?'}`,
        inline: false,
      },
      { name: 'Action', value: 'Promotions THROTTLED until model recalibrates', inline: false },
    ],
    timestamp: new Date().toISOString(),
  });
}

/**
 * Alert: Risk engine error (fail-closed).
 */
export async function emitEngineError(errorMessage: string): Promise<boolean> {
  return sendWebhook('ENGINE_ERROR', {
    title: 'RISK EMERGENCY: Engine Failure',
    color: 0xff0000,
    fields: [
      { name: 'Error', value: errorMessage.slice(0, 1000), inline: false },
      { name: 'Action', value: 'ALL promotions BLOCKED (fail-closed)', inline: false },
    ],
    timestamp: new Date().toISOString(),
  });
}

/**
 * AlertAgent V2 — Main Engine
 *
 * Orchestrates: signal → alert_key → cooldown check → advice → embed → route.
 *
 * Flag-gated:
 *   ALERT_ENGINE_V2 = "true"  → use V2
 *   ALERT_DRY_RUN   = "true"  → write payload JSON artifacts, do NOT post to Discord
 *
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { generateAlertKey } from './alertKey';
import { getConsensusAdvice } from './consensusAdvice';
import { CooldownManager } from './cooldownManager';
import { buildAlertEmbedV2 } from './embedBuilderV2';
import { AlertEngineV2Config, AlertPayload, AlertSignal, DEFAULT_COOLDOWN_WINDOWS } from './types';

// ── Config Loader ────────────────────────────────────────────────────────────

export function loadAlertEngineV2Config(): AlertEngineV2Config {
  return {
    enabled: process.env.ALERT_ENGINE_V2 === 'true',
    dryRun: process.env.ALERT_DRY_RUN !== 'false', // default true
    dryRunOutputDir:
      process.env.ALERT_DRY_RUN_OUTPUT_DIR ||
      path.join(
        process.cwd(),
        'out',
        'alert-agent',
        new Date().toISOString().slice(0, 10),
        '04-smoke'
      ),
    cooldownWindows: { ...DEFAULT_COOLDOWN_WINDOWS },
    canaryChannelId: process.env.ALERT_CANARY_CHANNEL_ID || undefined,
  };
}

// ── Engine Class ─────────────────────────────────────────────────────────────

export class AlertEngineV2 {
  private config: AlertEngineV2Config;
  private cooldown: CooldownManager;
  /** Callback to post a Discord embed. Injected so V2 has no direct Discord dep. */
  private postEmbed?: (payload: AlertPayload) => Promise<void>;

  constructor(
    config?: Partial<AlertEngineV2Config>,
    postEmbed?: (payload: AlertPayload) => Promise<void>
  ) {
    const defaults = loadAlertEngineV2Config();
    this.config = { ...defaults, ...config };
    this.cooldown = new CooldownManager(this.config.cooldownWindows);
    this.postEmbed = postEmbed;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Process an alert signal through the full V2 pipeline.
   *
   * Returns the AlertPayload if the alert was emitted (or dry-run written).
   * Returns null if suppressed by cooldown / idempotency.
   */
  async processSignal(signal: AlertSignal): Promise<AlertPayload | null> {
    const traceId = randomUUID().slice(0, 12);
    const alertKey = generateAlertKey(signal);

    // Idempotency + cooldown gate
    if (!this.cooldown.tryAcquire(alertKey, signal.type)) {
      return null; // suppressed
    }

    // Advice
    const advice = getConsensusAdvice(signal);

    // Embed
    const embed = buildAlertEmbedV2(signal, advice, alertKey, traceId);

    const payload: AlertPayload = {
      alert_key: alertKey,
      type: signal.type,
      signal,
      advice,
      embed,
      trace_id: traceId,
      created_at: new Date().toISOString(),
      dry_run: this.config.dryRun,
    };

    // Route
    if (this.config.dryRun) {
      await this.writeDryRunArtifact(payload);
    } else if (this.postEmbed) {
      await this.postEmbed(payload);
    }

    return payload;
  }

  /**
   * Check whether V2 is enabled (reads config snapshot).
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check whether V2 is in dry-run mode.
   */
  isDryRun(): boolean {
    return this.config.dryRun;
  }

  /**
   * Get the cooldown manager (for testing / monitoring).
   */
  getCooldownManager(): CooldownManager {
    return this.cooldown;
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.cooldown.destroy();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async writeDryRunArtifact(payload: AlertPayload): Promise<string> {
    const dir = this.config.dryRunOutputDir;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(dir, { recursive: true });
    const filename = `dryrun-${payload.type}-${payload.alert_key}.json`;
    const filepath = path.join(dir, filename);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');
    return filepath;
  }
}

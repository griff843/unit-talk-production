/**
 * Discord Routing Configuration tests — SPRINT-DISCORD-RECAP-VERIFICATION
 *
 * Verifies fail-closed routing logic: canary mode, production mode,
 * legacy fallback, and validation gates.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  resolveDiscordRoutingConfig,
  getWebhookForChannel,
  requireWebhookForChannel,
  validateDiscordRoutingConfig,
  isDiscordRoutingConfigured,
} from '../discordRouting';

// Save and restore env between tests
const savedEnv: Record<string, string | undefined> = {};
const envKeys = [
  'DISCORD_MODE',
  'DISCORD_CANARY_WEBHOOK_URL',
  'DISCORD_WEBHOOK_URL',
  'DISCORD_WEBHOOK_TRADER_INSIGHTS',
  'DISCORD_WEBHOOK_BEST_BETS',
  'DISCORD_WEBHOOK_STRATEGY_LAB',
  'DISCORD_WEBHOOK_FREE_DAILY_PICKS',
  'DISCORD_WEBHOOK_VIP_LOUNGE',
  'DISCORD_WEBHOOK_INFO_CENTER',
  'DISCORD_WEBHOOK_RECAPS',
  'DEFAULT_DISCORD_TICKET_CHANNEL_ID',
  'ENABLE_DISCORD_TICKET_WORKER',
  'TICKET_DISCORD_POLL_INTERVAL',
  'TICKET_DISCORD_BATCH_SIZE',
  'TICKET_DISCORD_STALE_CLAIM_SECONDS',
];

beforeEach(() => {
  for (const key of envKeys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of envKeys) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

// ── resolveDiscordRoutingConfig ──────────────────────────────────────

describe('resolveDiscordRoutingConfig', () => {
  it('returns defaults when no env vars set', () => {
    const config = resolveDiscordRoutingConfig();
    expect(config.mode).toBeNull();
    expect(config.webhookUrl).toBeNull();
    expect(config.canaryWebhookUrl).toBeNull();
    expect(config.workerEnabled).toBe(false);
    expect(config.pollIntervalMs).toBe(10000);
    expect(config.batchSize).toBe(10);
    expect(config.staleClaimThresholdSeconds).toBe(60);
  });

  it('reads canary mode from env', () => {
    process.env['DISCORD_MODE'] = 'canary';
    process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.webhook';
    const config = resolveDiscordRoutingConfig();
    expect(config.mode).toBe('canary');
    expect(config.canaryWebhookUrl).toBe('https://canary.webhook');
  });

  it('reads production webhook map from env', () => {
    process.env['DISCORD_MODE'] = 'production';
    process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti.webhook';
    process.env['DISCORD_WEBHOOK_BEST_BETS'] = 'https://bb.webhook';
    const config = resolveDiscordRoutingConfig();
    expect(config.mode).toBe('production');
    expect(config.productionWebhooks.TRADER_INSIGHTS).toBe('https://ti.webhook');
    expect(config.productionWebhooks.BEST_BETS).toBe('https://bb.webhook');
    expect(config.productionWebhooks.STRATEGY_LAB).toBeNull();
  });

  it('tracks resolution sources', () => {
    process.env['DISCORD_MODE'] = 'canary';
    process.env['DISCORD_WEBHOOK_URL'] = 'https://legacy.webhook';
    const config = resolveDiscordRoutingConfig();
    expect(config.resolution.mode).toBe('env');
    expect(config.resolution.webhookUrl).toBe('env');
    expect(config.resolution.workerEnabled).toBe('default');
  });
});

// ── getWebhookForChannel ─────────────────────────────────────────────

describe('getWebhookForChannel', () => {
  it('canary mode → all channels use canary URL', () => {
    process.env['DISCORD_MODE'] = 'canary';
    process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.test';
    expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://canary.test');
    expect(getWebhookForChannel('BEST_BETS')).toBe('https://canary.test');
    expect(getWebhookForChannel('RECAPS')).toBe('https://canary.test');
  });

  it('production mode → per-channel webhook', () => {
    process.env['DISCORD_MODE'] = 'production';
    process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti.prod';
    process.env['DISCORD_WEBHOOK_RECAPS'] = 'https://recaps.prod';
    expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://ti.prod');
    expect(getWebhookForChannel('RECAPS')).toBe('https://recaps.prod');
    expect(getWebhookForChannel('BEST_BETS')).toBeNull();
  });

  it('no mode → legacy fallback', () => {
    process.env['DISCORD_WEBHOOK_URL'] = 'https://legacy.webhook';
    expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://legacy.webhook');
  });

  it('no mode, no legacy → null', () => {
    expect(getWebhookForChannel('TRADER_INSIGHTS')).toBeNull();
  });
});

// ── requireWebhookForChannel ─────────────────────────────────────────

describe('requireWebhookForChannel', () => {
  it('throws in canary mode when canary URL missing', () => {
    process.env['DISCORD_MODE'] = 'canary';
    expect(() => requireWebhookForChannel('TRADER_INSIGHTS')).toThrow(
      'DISCORD_CANARY_WEBHOOK_URL is required'
    );
  });

  it('throws in production mode when channel URL missing', () => {
    process.env['DISCORD_MODE'] = 'production';
    expect(() => requireWebhookForChannel('BEST_BETS')).toThrow(
      'DISCORD_WEBHOOK_BEST_BETS is required'
    );
  });

  it('throws when no mode and no webhook', () => {
    expect(() => requireWebhookForChannel('TRADER_INSIGHTS')).toThrow(
      'Discord webhook not configured'
    );
  });

  it('returns URL when properly configured', () => {
    process.env['DISCORD_MODE'] = 'canary';
    process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.ok';
    expect(requireWebhookForChannel('TRADER_INSIGHTS')).toBe('https://canary.ok');
  });
});

// ── validateDiscordRoutingConfig ─────────────────────────────────────

describe('validateDiscordRoutingConfig', () => {
  it('no mode → issue reported', () => {
    const issues = validateDiscordRoutingConfig();
    expect(issues).toContain('DISCORD_MODE not set (required: "canary" or "production")');
  });

  it('invalid mode → issue reported', () => {
    process.env['DISCORD_MODE'] = 'invalid';
    const issues = validateDiscordRoutingConfig();
    expect(issues[0]).toContain('Invalid DISCORD_MODE');
  });

  it('canary mode without URL → issue', () => {
    process.env['DISCORD_MODE'] = 'canary';
    const issues = validateDiscordRoutingConfig();
    expect(issues).toContain('DISCORD_CANARY_WEBHOOK_URL is required when DISCORD_MODE=canary');
  });

  it('canary mode with URL → no issues', () => {
    process.env['DISCORD_MODE'] = 'canary';
    process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.test';
    const issues = validateDiscordRoutingConfig();
    expect(issues).toHaveLength(0);
  });

  it('production mode with missing channels → issues for each', () => {
    process.env['DISCORD_MODE'] = 'production';
    const issues = validateDiscordRoutingConfig();
    expect(issues.length).toBe(7); // 7 channels
    expect(issues[0]).toContain('DISCORD_WEBHOOK_');
  });

  it('production mode fully configured → no issues', () => {
    process.env['DISCORD_MODE'] = 'production';
    process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti';
    process.env['DISCORD_WEBHOOK_BEST_BETS'] = 'https://bb';
    process.env['DISCORD_WEBHOOK_STRATEGY_LAB'] = 'https://sl';
    process.env['DISCORD_WEBHOOK_FREE_DAILY_PICKS'] = 'https://fdp';
    process.env['DISCORD_WEBHOOK_VIP_LOUNGE'] = 'https://vl';
    process.env['DISCORD_WEBHOOK_INFO_CENTER'] = 'https://ic';
    process.env['DISCORD_WEBHOOK_RECAPS'] = 'https://r';
    const issues = validateDiscordRoutingConfig();
    expect(issues).toHaveLength(0);
  });
});

// ── isDiscordRoutingConfigured ───────────────────────────────────────

describe('isDiscordRoutingConfigured', () => {
  it('false when misconfigured', () => {
    expect(isDiscordRoutingConfigured()).toBe(false);
  });

  it('true when canary mode properly set', () => {
    process.env['DISCORD_MODE'] = 'canary';
    process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.test';
    expect(isDiscordRoutingConfigured()).toBe(true);
  });
});

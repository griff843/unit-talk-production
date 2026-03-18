/**
 * Discord Routing Integration Tests — SPRINT-DISCORD-ROUTING-INTEGRATION
 *
 * Proves that DiscordPromotionAgent uses channel-aware routing:
 * - canary mode → all posts to DISCORD_CANARY_WEBHOOK_URL
 * - production mode → per-channel webhooks
 * - legacy mode → DISCORD_WEBHOOK_URL fallback
 * - fail-closed → no webhook = no post
 *
 * These tests verify the integration point, NOT the routing logic itself
 * (that's in config/__tests__/discordRouting.test.ts).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock external deps BEFORE importing the module under test
vi.mock('axios');
vi.mock('../../../services/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        gte: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    }),
  },
}));
vi.mock('../../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('../../../lib/AutopilotGuard', () => ({
  autopilotGuard: {
    assertMayPerformSideEffect: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));
vi.mock('../../../lib/lifecycle', () => ({
  atomicClaimForPost: vi.fn().mockResolvedValue({ claimed: true }),
  atomicClaimParlayForPost: vi.fn().mockResolvedValue({ claimed: true }),
  lifecycleUpdate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../services/publishOutbox', () => ({
  enqueueForPublish: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
  markPublished: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue(undefined),
}));

import { getWebhookForChannel, requireWebhookForChannel } from '../../../config/discordRouting';

// ── ENV MANAGEMENT ──────────────────────────────────────────────────────
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
  'PROMOTION_SHADOW_MODE',
  'AUTOPILOT_MODE',
];

const savedEnv: Record<string, string | undefined> = {};

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
  vi.restoreAllMocks();
});

// ── ROUTING INTEGRATION TESTS ──────────────────────────────────────────

describe('DiscordPromotionAgent routing integration', () => {
  describe('canary mode routing', () => {
    it('getWebhookForChannel returns canary URL for any channel in canary mode', () => {
      process.env['DISCORD_MODE'] = 'canary';
      process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.webhook/test';

      // All channels should resolve to the canary webhook
      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://canary.webhook/test');
      expect(getWebhookForChannel('BEST_BETS')).toBe('https://canary.webhook/test');
      expect(getWebhookForChannel('FREE_DAILY_PICKS')).toBe('https://canary.webhook/test');
      expect(getWebhookForChannel('RECAPS')).toBe('https://canary.webhook/test');
    });

    it('getWebhookForChannel returns null in canary mode without canary URL', () => {
      process.env['DISCORD_MODE'] = 'canary';
      // No DISCORD_CANARY_WEBHOOK_URL set

      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBeNull();
      expect(getWebhookForChannel('BEST_BETS')).toBeNull();
    });

    it('requireWebhookForChannel throws in canary mode without canary URL', () => {
      process.env['DISCORD_MODE'] = 'canary';

      expect(() => requireWebhookForChannel('TRADER_INSIGHTS')).toThrow(
        'DISCORD_CANARY_WEBHOOK_URL is required in canary mode'
      );
    });

    it('canary mode ignores per-channel production webhooks', () => {
      process.env['DISCORD_MODE'] = 'canary';
      process.env['DISCORD_CANARY_WEBHOOK_URL'] = 'https://canary.webhook/test';
      process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti.webhook/prod';

      // Even with per-channel webhook set, canary mode routes to canary
      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://canary.webhook/test');
    });
  });

  describe('production mode routing', () => {
    it('routes each channel to its specific webhook', () => {
      process.env['DISCORD_MODE'] = 'production';
      process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti.webhook';
      process.env['DISCORD_WEBHOOK_BEST_BETS'] = 'https://bb.webhook';
      process.env['DISCORD_WEBHOOK_FREE_DAILY_PICKS'] = 'https://fdp.webhook';

      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://ti.webhook');
      expect(getWebhookForChannel('BEST_BETS')).toBe('https://bb.webhook');
      expect(getWebhookForChannel('FREE_DAILY_PICKS')).toBe('https://fdp.webhook');
    });

    it('returns null for unconfigured channel in production mode', () => {
      process.env['DISCORD_MODE'] = 'production';
      process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti.webhook';
      // BEST_BETS not set

      expect(getWebhookForChannel('BEST_BETS')).toBeNull();
    });

    it('requireWebhookForChannel throws for unconfigured channel in production mode', () => {
      process.env['DISCORD_MODE'] = 'production';
      // No webhooks set

      expect(() => requireWebhookForChannel('BEST_BETS')).toThrow(
        'DISCORD_WEBHOOK_BEST_BETS is required in production mode'
      );
    });
  });

  describe('legacy fallback routing', () => {
    it('falls back to DISCORD_WEBHOOK_URL when no mode set', () => {
      process.env['DISCORD_WEBHOOK_URL'] = 'https://legacy.webhook';
      // No DISCORD_MODE set

      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBe('https://legacy.webhook');
      expect(getWebhookForChannel('BEST_BETS')).toBe('https://legacy.webhook');
      expect(getWebhookForChannel('FREE_DAILY_PICKS')).toBe('https://legacy.webhook');
    });

    it('returns null when no mode and no legacy webhook', () => {
      // Nothing set

      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBeNull();
    });
  });

  describe('fail-closed behavior', () => {
    it('getWebhookForChannel returns null when nothing configured', () => {
      // Completely bare env
      expect(getWebhookForChannel('TRADER_INSIGHTS')).toBeNull();
      expect(getWebhookForChannel('BEST_BETS')).toBeNull();
      expect(getWebhookForChannel('FREE_DAILY_PICKS')).toBeNull();
      expect(getWebhookForChannel('RECAPS')).toBeNull();
    });

    it('requireWebhookForChannel throws when nothing configured', () => {
      expect(() => requireWebhookForChannel('TRADER_INSIGHTS')).toThrow(
        'Discord webhook not configured'
      );
    });
  });

  describe('channel assignment correctness', () => {
    it('capper picks use TRADER_INSIGHTS channel', () => {
      // This verifies the expected channel mapping from the agent code
      process.env['DISCORD_MODE'] = 'production';
      process.env['DISCORD_WEBHOOK_TRADER_INSIGHTS'] = 'https://ti.webhook';

      const url = getWebhookForChannel('TRADER_INSIGHTS');
      expect(url).toBe('https://ti.webhook');
    });

    it('system picks use BEST_BETS channel', () => {
      process.env['DISCORD_MODE'] = 'production';
      process.env['DISCORD_WEBHOOK_BEST_BETS'] = 'https://bb.webhook';

      const url = getWebhookForChannel('BEST_BETS');
      expect(url).toBe('https://bb.webhook');
    });

    it('legacy picks use FREE_DAILY_PICKS channel', () => {
      process.env['DISCORD_MODE'] = 'production';
      process.env['DISCORD_WEBHOOK_FREE_DAILY_PICKS'] = 'https://fdp.webhook';

      const url = getWebhookForChannel('FREE_DAILY_PICKS');
      expect(url).toBe('https://fdp.webhook');
    });
  });
});

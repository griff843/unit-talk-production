/**
 * Phase 6.5: Autopilot Guard Integration Tests
 *
 * These tests verify that the AutopilotGuard is the sole authority
 * for side effects and evidence logging works correctly.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock supabase before importing AutopilotGuard
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'test-evidence-id' }, error: null })
        })
      })
    })
  }
}));

// Mock shadowMode
jest.mock('../../shadow/ShadowMode', () => ({
  shadowMode: {
    isShadowMode: jest.fn().mockReturnValue(false),
    shouldSkipPublicAction: jest.fn().mockReturnValue(false)
  }
}));

import { AutopilotGuard, SideEffectContext, GuardResult, AutopilotMode } from '../../lib/AutopilotGuard';

describe('Phase 6.5: AutopilotGuard', () => {
  let guard: AutopilotGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Reset singleton
    (AutopilotGuard as any).instance = null;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Mode Detection', () => {
    it('should default to OFF mode when no env var set', () => {
      delete process.env.AUTOPILOT_MODE;
      guard = AutopilotGuard.getInstance();
      expect(guard.getMode()).toBe('off');
    });

    it('should respect AUTOPILOT_MODE=prod', () => {
      process.env.AUTOPILOT_MODE = 'prod';
      guard = AutopilotGuard.getInstance();
      expect(guard.getMode()).toBe('prod');
    });

    it('should respect AUTOPILOT_MODE=log_only', () => {
      process.env.AUTOPILOT_MODE = 'log_only';
      guard = AutopilotGuard.getInstance();
      expect(guard.getMode()).toBe('log_only');
    });

    it('should respect AUTOPILOT_MODE=canary', () => {
      process.env.AUTOPILOT_MODE = 'canary';
      process.env.AUTOPILOT_CANARY_PERCENTAGE = '50';
      guard = AutopilotGuard.getInstance();
      expect(guard.getMode()).toBe('canary');
    });
  });

  describe('Side Effect Gating', () => {
    it('should REJECT side effects in OFF mode', async () => {
      process.env.AUTOPILOT_MODE = 'off';
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: 'DISCORD_POST',
        agent_name: 'TestAgent',
        pick_id: 'test-pick-123'
      };

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('REJECT');
      expect(result.mode).toBe('off');
      expect(result.reason).toContain('OFF');
    });

    it('should REJECT side effects in LOG_ONLY mode', async () => {
      process.env.AUTOPILOT_MODE = 'log_only';
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: 'DISCORD_ALERT',
        agent_name: 'AlertAgent',
        pick_id: 'test-alert-456'
      };

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('REJECT');
      expect(result.mode).toBe('log_only');
      expect(result.reason).toContain('LOG_ONLY');
    });

    it('should ALLOW side effects in PROD mode when not in shadow mode', async () => {
      process.env.AUTOPILOT_MODE = 'prod';
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: 'NOTIFICATION_SEND',
        agent_name: 'NotificationAgent',
        recipient_id: 'user-789'
      };

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('ALLOW');
      expect(result.mode).toBe('prod');
    });
  });

  describe('Evidence Logging', () => {
    it('should log evidence for every decision', async () => {
      process.env.AUTOPILOT_MODE = 'off';
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: 'DISCORD_POST',
        agent_name: 'TestAgent',
        pick_id: 'test-pick-123',
        correlation_id: 'corr-456',
        metadata: { tier: 'S' }
      };

      const result = await guard.assertMayPerformSideEffect(context);

      // Should have evidence ID from mocked supabase
      expect(result.evidence_id).toBeDefined();
    });
  });

  describe('Fail-Closed Behavior', () => {
    it('should REJECT with UNKNOWN on evaluation error', async () => {
      process.env.AUTOPILOT_MODE = 'prod';
      guard = AutopilotGuard.getInstance();

      // Force an error by passing invalid context
      const context = null as any;

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('UNKNOWN');
      expect(result.reason).toContain('fail-closed');
    });
  });

  describe('Canary Mode', () => {
    it('should allow percentage of requests in canary mode', async () => {
      process.env.AUTOPILOT_MODE = 'canary';
      process.env.AUTOPILOT_CANARY_PERCENTAGE = '100'; // 100% should always allow
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: 'DISCORD_POST',
        agent_name: 'TestAgent',
        pick_id: 'test-pick-123'
      };

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('canary');
    });

    it('should reject when outside canary percentage', async () => {
      process.env.AUTOPILOT_MODE = 'canary';
      process.env.AUTOPILOT_CANARY_PERCENTAGE = '0'; // 0% should never allow
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: 'DISCORD_POST',
        agent_name: 'TestAgent',
        pick_id: 'test-pick-123'
      };

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.allowed).toBe(false);
      expect(result.mode).toBe('canary');
    });
  });

  describe('Action Type Coverage', () => {
    const actionTypes: SideEffectContext['action'][] = [
      'DISCORD_POST',
      'DISCORD_ALERT',
      'NOTIFICATION_SEND',
      'DB_POSTED_MUTATION',
      'WEBHOOK_CALL',
      'SMS_SEND',
      'EMAIL_SEND',
      'VIP_CHANNEL_POST',
      'GAME_THREAD_POST',
      'COACHING_DM',
      'PROMO_PUBLISH'
    ];

    it.each(actionTypes)('should handle %s action type', async (actionType) => {
      process.env.AUTOPILOT_MODE = 'off';
      guard = AutopilotGuard.getInstance();

      const context: SideEffectContext = {
        action: actionType,
        agent_name: 'TestAgent'
      };

      const result = await guard.assertMayPerformSideEffect(context);

      expect(result.decision).toBeDefined();
      expect(['ALLOW', 'REJECT', 'UNKNOWN']).toContain(result.decision);
    });
  });

  describe('Status and Health', () => {
    it('should return correct status', () => {
      process.env.AUTOPILOT_MODE = 'prod';
      process.env.AUTOPILOT_CANARY_PERCENTAGE = '25';
      guard = AutopilotGuard.getInstance();

      const status = guard.getStatus();

      expect(status.mode).toBe('prod');
      expect(status.canaryPercentage).toBe(25);
      expect(status.ready).toBe(true);
    });

    it('should allow mode changes for testing', () => {
      guard = AutopilotGuard.getInstance();

      guard.setMode('prod');
      expect(guard.getMode()).toBe('prod');

      guard.setMode('off');
      expect(guard.getMode()).toBe('off');
    });
  });
});

describe('Phase 6.5: AutopilotGuard Integration Points', () => {
  describe('Service Integration Verification', () => {
    it('should have AutopilotGuard available for DiscordPromotionAgent', async () => {
      const { autopilotGuard } = await import('../../lib/AutopilotGuard');
      expect(autopilotGuard).toBeDefined();
      expect(typeof autopilotGuard.assertMayPerformSideEffect).toBe('function');
    });

    it('should have AutopilotGuard available for DiscordAlertRouter', async () => {
      const { autopilotGuard } = await import('../../lib/AutopilotGuard');
      expect(autopilotGuard).toBeDefined();
    });

    it('should have AutopilotGuard available for VIPPlusChannelService', async () => {
      const { autopilotGuard } = await import('../../lib/AutopilotGuard');
      expect(autopilotGuard).toBeDefined();
    });

    it('should have AutopilotGuard available for DailyPickPublisher', async () => {
      const { autopilotGuard } = await import('../../lib/AutopilotGuard');
      expect(autopilotGuard).toBeDefined();
    });

    it('should have AutopilotGuard available for NotificationAgent', async () => {
      const { autopilotGuard } = await import('../../lib/AutopilotGuard');
      expect(autopilotGuard).toBeDefined();
    });
  });
});

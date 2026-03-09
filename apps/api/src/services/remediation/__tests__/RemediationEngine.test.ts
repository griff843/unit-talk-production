/**
 * @fileoverview RemediationEngine Tests
 *
 * Tests for PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/__tests__/RemediationEngine.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { KnobResolver } from '../KnobResolver';
import { PlaybookRegistry } from '../PlaybookRegistry';
import { MVRefreshLagPlaybook } from '../playbooks/MVRefreshLagPlaybook';
import { PipelineLagThrottlePlaybook } from '../playbooks/PipelineLagThrottlePlaybook';
import { RemediationEngine, createRemediationEngine } from '../RemediationEngine';
import { ExecutionContext, PlaybookId } from '../types';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: [{ should_execute: true, reason: 'ok' }], error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
  })),
}));

describe('RemediationEngine', () => {
  let engine: RemediationEngine;
  let registry: PlaybookRegistry;
  let knobResolver: KnobResolver;

  beforeEach(() => {
    // Reset singleton
    PlaybookRegistry.resetInstance();

    // Create mock instances
    registry = PlaybookRegistry.getInstance('https://test.supabase.co', 'test-key');
    knobResolver = new KnobResolver('https://test.supabase.co', 'test-key');

    // Create engine with mocked dependencies
    engine = createRemediationEngine('https://test.supabase.co', 'test-key', {
      enabled: true,
      dry_run_only: true,
      require_approval: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('executePlaybook', () => {
    const mockContext: ExecutionContext = {
      incident_id: 'test-incident-123',
      slo_id: 'test-slo',
      triggered_by: 'slo_incident',
      trigger_value: 1500,
      trigger_threshold: 1000,
      evidence: { source: 'test' },
      correlation_id: 'test-correlation-123',
      environment: 'test',
    };

    it('should return skipped result when engine is disabled', async () => {
      const disabledEngine = createRemediationEngine('https://test.supabase.co', 'test-key', {
        enabled: false,
      });

      const result = await disabledEngine.executePlaybook('PIPELINE_LAG_THROTTLE', mockContext);

      expect(result.success).toBe(true);
      expect(result.status).toBe('skipped');
      expect(result.recommendations).toContain('Remediation engine is disabled');
    });

    it('should return failed result when playbook is not found', async () => {
      await engine.initialize();

      const result = await engine.executePlaybook(
        'NONEXISTENT_PLAYBOOK' as PlaybookId,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('not found');
    });

    it('should execute playbook in dry run mode', async () => {
      await engine.initialize();

      // Register a test playbook
      const playbook = new PipelineLagThrottlePlaybook();
      registry.register(playbook);

      const result = await engine.executePlaybook('PIPELINE_LAG_THROTTLE', mockContext, {
        dryRun: true,
      });

      expect(result.dry_run).toBe(true);
      expect(result.playbook_id).toBe('PIPELINE_LAG_THROTTLE');
    });
  });

  describe('getStatus', () => {
    it('should return engine status', async () => {
      const status = engine.getStatus();

      expect(status.config).toBeDefined();
      expect(status.config.enabled).toBe(true);
      expect(status.config.dry_run_only).toBe(true);
      expect(status.registryStatus).toBeDefined();
    });
  });
});

describe('KnobResolver', () => {
  let resolver: KnobResolver;

  beforeEach(() => {
    resolver = new KnobResolver('https://test.supabase.co', 'test-key');
  });

  describe('getInventory', () => {
    it('should return all known knobs', () => {
      const inventory = resolver.getInventory();

      expect(inventory.length).toBeGreaterThan(0);
      expect(inventory.some(k => k.knob_id === 'AUTOPILOT_MODE')).toBe(true);
      expect(inventory.some(k => k.knob_id === 'SYSTEM_FREEZE')).toBe(true);
    });
  });

  describe('getKnobDefinition', () => {
    it('should return knob definition for known knob', () => {
      const definition = resolver.getKnobDefinition('AUTOPILOT_MODE');

      expect(definition).toBeDefined();
      expect(definition?.type).toBe('EXECUTABLE');
      expect(definition?.safe_to_toggle).toBe(true);
    });

    it('should return undefined for unknown knob', () => {
      const definition = resolver.getKnobDefinition('UNKNOWN_KNOB');

      expect(definition).toBeUndefined();
    });
  });

  describe('canExecutePlaybook', () => {
    it('should return canExecute=true when all knobs exist and are executable', async () => {
      const result = await resolver.canExecutePlaybook(['AUTOPILOT_MODE']);

      expect(result.canExecute).toBe(true);
      expect(result.missingKnobs).toHaveLength(0);
      expect(result.nonExecutableKnobs).toHaveLength(0);
    });

    it('should return canExecute=false when knobs are missing', async () => {
      const result = await resolver.canExecutePlaybook(['UNKNOWN_KNOB']);

      expect(result.canExecute).toBe(false);
      expect(result.missingKnobs).toContain('UNKNOWN_KNOB');
    });

    it('should return canExecute=false when knobs are not executable', async () => {
      const result = await resolver.canExecutePlaybook(['API_QUOTA_THROTTLE']);

      expect(result.canExecute).toBe(false);
      expect(result.nonExecutableKnobs).toContain('API_QUOTA_THROTTLE');
    });
  });
});

describe('Playbooks', () => {
  describe('MVRefreshLagPlaybook', () => {
    const playbook = new MVRefreshLagPlaybook();

    it('should have correct metadata', () => {
      expect(playbook.id).toBe('MV_REFRESH_LAG');
      expect(playbook.executionType).toBe('EXECUTABLE');
      expect(playbook.requiredKnobs).toContain('SLO_EVALUATION_ENABLED');
    });

    it('should never return canExecute=true', () => {
      const result = playbook.canExecute(new Map());
      expect(result).toBe(false);
    });

    it('should return recommendations on execute', async () => {
      const context: ExecutionContext = {
        incident_id: 'test-123',
        triggered_by: 'slo_incident',
        evidence: {},
        correlation_id: 'corr-123',
        environment: 'test',
      };

      const result = await playbook.execute(context, true);

      expect(result.success).toBe(true);
      expect(result.execution_type).toBe('EXECUTABLE');
      expect(result.status).toBe('dry_run');
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.length).toBeGreaterThan(0);
    });
  });

  describe('PipelineLagThrottlePlaybook', () => {
    const playbook = new PipelineLagThrottlePlaybook();

    it('should have correct metadata', () => {
      expect(playbook.id).toBe('PIPELINE_LAG_THROTTLE');
      expect(playbook.executionType).toBe('EXECUTABLE');
      expect(playbook.requiredKnobs).toContain('AUTOPILOT_MODE');
    });

    it('should return canExecute=true when knobs are available', () => {
      const knobs = new Map([
        [
          'AUTOPILOT_MODE',
          {
            knob_id: 'AUTOPILOT_MODE',
            exists: true,
            type: 'EXECUTABLE' as const,
            can_execute: true,
          },
        ],
      ]);

      const result = playbook.canExecute(knobs);
      expect(result).toBe(true);
    });

    it('should return canExecute=false when knobs are missing', () => {
      const knobs = new Map([
        [
          'AUTOPILOT_MODE',
          {
            knob_id: 'AUTOPILOT_MODE',
            exists: false,
            type: 'RECOMMENDATION_ONLY' as const,
            can_execute: false,
            reason: 'Not found',
          },
        ],
      ]);

      const result = playbook.canExecute(knobs);
      expect(result).toBe(false);
    });
  });
});

describe('PlaybookRegistry', () => {
  beforeEach(() => {
    PlaybookRegistry.resetInstance();
  });

  it('should be a singleton', () => {
    const instance1 = PlaybookRegistry.getInstance('https://test.supabase.co', 'test-key');
    const instance2 = PlaybookRegistry.getInstance();

    expect(instance1).toBe(instance2);
  });

  it('should register and retrieve playbooks', () => {
    const registry = PlaybookRegistry.getInstance('https://test.supabase.co', 'test-key');
    const playbook = new MVRefreshLagPlaybook();

    registry.register(playbook);

    expect(registry.has('MV_REFRESH_LAG')).toBe(true);
    expect(registry.get('MV_REFRESH_LAG')).toBe(playbook);
  });

  it('should return status correctly', () => {
    const registry = PlaybookRegistry.getInstance('https://test.supabase.co', 'test-key');
    const playbook = new PipelineLagThrottlePlaybook();

    registry.register(playbook);

    const status = registry.getStatus();

    expect(status.registeredPlaybooks).toBe(1);
    expect(status.initialized).toBe(false); // Not initialized yet
  });
});

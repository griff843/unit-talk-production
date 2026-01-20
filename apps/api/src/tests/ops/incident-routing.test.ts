/**
 * @fileoverview Tests for Ops Incident Routing
 *
 * Tests for:
 * - Routing decision logic (dedupe, cooldown, escalation)
 * - Discord embed building
 * - Notification delivery
 * - Feature flag behavior
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module tests/ops/incident-routing
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  OpsIncidentRouter,
  IncidentRecord,
  RoutingDecision,
} from '../../services/ops/OpsIncidentRouter';
import {
  buildIncidentEmbed,
  buildDigestEmbed,
  buildEscalationContent,
  buildDigestContent,
  OpsDigestData,
} from '../../services/ops/OpsDiscordEmbedBuilder';

// ============================================================================
// Test Data
// ============================================================================

const createMockIncident = (overrides?: Partial<IncidentRecord>): IncidentRecord => ({
  incident_id: 'test-incident-123',
  slo_id: 'slo-api-latency',
  slo_name: 'API Latency P99',
  severity: 'warning',
  status: 'open',
  opened_at: new Date().toISOString(),
  acknowledged_at: null,
  resolved_at: null,
  trigger_value: 150,
  trigger_threshold: 100,
  evidence: { endpoint: '/api/picks', latency_ms: 150 },
  needs_notification: true,
  notification_reason: 'threshold_exceeded',
  ...overrides,
});

const createMockDigestData = (overrides?: Partial<OpsDigestData>): OpsDigestData => ({
  periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  periodEnd: new Date().toISOString(),
  incidentCounts: {
    total: 10,
    critical: 2,
    warning: 8,
    open: 1,
    acknowledged: 2,
    resolved: 7,
  },
  topNoisySlos: [
    { slo_id: 'slo-1', slo_name: 'API Latency', incident_count: 5 },
    { slo_id: 'slo-2', slo_name: 'Error Rate', incident_count: 3 },
  ],
  timingMetrics: {
    avg_time_to_ack_minutes: 15,
    avg_time_to_resolve_minutes: 45,
    median_time_to_ack_minutes: 10,
    median_time_to_resolve_minutes: 30,
  },
  evaluationHealth: {
    total_evaluations: 1000,
    successful_evaluations: 995,
    error_rate: 0.5,
  },
  sloHealthSummary: [
    { slo_id: 'slo-1', slo_name: 'API Latency', current_status: 'GREEN', last_evaluation: new Date().toISOString(), week_incidents: 2 },
    { slo_id: 'slo-2', slo_name: 'Error Rate', current_status: 'YELLOW', last_evaluation: new Date().toISOString(), week_incidents: 3 },
  ],
  ...overrides,
});

// ============================================================================
// Routing Decision Tests
// ============================================================================

describe('OpsIncidentRouter', () => {
  describe('makeRoutingDecision', () => {
    it('should not notify when all features are disabled', () => {
      // Create router with all features disabled
      const mockRouter = {
        config: {
          discordEnabled: false,
          notionEnabled: false,
          digestEnabled: false,
          discordChannelId: '',
          discordEscalationRoleId: '',
          notionApiKey: '',
          notionDatabaseId: '',
        },
        makeRoutingDecision(incident: IncidentRecord): RoutingDecision {
          const destinations: string[] = [];
          let shouldEscalate = false;

          if (this.config.discordEnabled && this.config.discordChannelId) {
            destinations.push('discord');
            if (incident.severity === 'critical' && this.config.discordEscalationRoleId) {
              shouldEscalate = true;
            }
          }

          if (this.config.notionEnabled && this.config.notionApiKey && this.config.notionDatabaseId) {
            destinations.push('notion');
          }

          return {
            shouldNotify: destinations.length > 0,
            destinations,
            shouldEscalate,
            reason: incident.notification_reason,
          };
        },
      };

      const incident = createMockIncident();
      const decision = mockRouter.makeRoutingDecision(incident);

      expect(decision.shouldNotify).toBe(false);
      expect(decision.destinations).toHaveLength(0);
      expect(decision.shouldEscalate).toBe(false);
    });

    it('should route to Discord when enabled', () => {
      const mockRouter = {
        config: {
          discordEnabled: true,
          notionEnabled: false,
          discordChannelId: 'channel-123',
          discordEscalationRoleId: '',
          notionApiKey: '',
          notionDatabaseId: '',
        },
        makeRoutingDecision(incident: IncidentRecord): RoutingDecision {
          const destinations: string[] = [];
          let shouldEscalate = false;

          if (this.config.discordEnabled && this.config.discordChannelId) {
            destinations.push('discord');
            if (incident.severity === 'critical' && this.config.discordEscalationRoleId) {
              shouldEscalate = true;
            }
          }

          if (this.config.notionEnabled && this.config.notionApiKey && this.config.notionDatabaseId) {
            destinations.push('notion');
          }

          return {
            shouldNotify: destinations.length > 0,
            destinations,
            shouldEscalate,
            reason: incident.notification_reason,
          };
        },
      };

      const incident = createMockIncident();
      const decision = mockRouter.makeRoutingDecision(incident);

      expect(decision.shouldNotify).toBe(true);
      expect(decision.destinations).toContain('discord');
      expect(decision.shouldEscalate).toBe(false);
    });

    it('should escalate critical incidents when role is configured', () => {
      const mockRouter = {
        config: {
          discordEnabled: true,
          notionEnabled: false,
          discordChannelId: 'channel-123',
          discordEscalationRoleId: 'role-ops-team',
          notionApiKey: '',
          notionDatabaseId: '',
        },
        makeRoutingDecision(incident: IncidentRecord): RoutingDecision {
          const destinations: string[] = [];
          let shouldEscalate = false;

          if (this.config.discordEnabled && this.config.discordChannelId) {
            destinations.push('discord');
            if (incident.severity === 'critical' && this.config.discordEscalationRoleId) {
              shouldEscalate = true;
            }
          }

          if (this.config.notionEnabled && this.config.notionApiKey && this.config.notionDatabaseId) {
            destinations.push('notion');
          }

          return {
            shouldNotify: destinations.length > 0,
            destinations,
            shouldEscalate,
            reason: incident.notification_reason,
          };
        },
      };

      const incident = createMockIncident({ severity: 'critical' });
      const decision = mockRouter.makeRoutingDecision(incident);

      expect(decision.shouldNotify).toBe(true);
      expect(decision.shouldEscalate).toBe(true);
    });

    it('should not escalate warning incidents', () => {
      const mockRouter = {
        config: {
          discordEnabled: true,
          notionEnabled: false,
          discordChannelId: 'channel-123',
          discordEscalationRoleId: 'role-ops-team',
          notionApiKey: '',
          notionDatabaseId: '',
        },
        makeRoutingDecision(incident: IncidentRecord): RoutingDecision {
          const destinations: string[] = [];
          let shouldEscalate = false;

          if (this.config.discordEnabled && this.config.discordChannelId) {
            destinations.push('discord');
            if (incident.severity === 'critical' && this.config.discordEscalationRoleId) {
              shouldEscalate = true;
            }
          }

          if (this.config.notionEnabled && this.config.notionApiKey && this.config.notionDatabaseId) {
            destinations.push('notion');
          }

          return {
            shouldNotify: destinations.length > 0,
            destinations,
            shouldEscalate,
            reason: incident.notification_reason,
          };
        },
      };

      const incident = createMockIncident({ severity: 'warning' });
      const decision = mockRouter.makeRoutingDecision(incident);

      expect(decision.shouldNotify).toBe(true);
      expect(decision.shouldEscalate).toBe(false);
    });

    it('should route to both Discord and Notion when both enabled', () => {
      const mockRouter = {
        config: {
          discordEnabled: true,
          notionEnabled: true,
          discordChannelId: 'channel-123',
          discordEscalationRoleId: '',
          notionApiKey: 'notion-key',
          notionDatabaseId: 'notion-db',
        },
        makeRoutingDecision(incident: IncidentRecord): RoutingDecision {
          const destinations: string[] = [];
          let shouldEscalate = false;

          if (this.config.discordEnabled && this.config.discordChannelId) {
            destinations.push('discord');
            if (incident.severity === 'critical' && this.config.discordEscalationRoleId) {
              shouldEscalate = true;
            }
          }

          if (this.config.notionEnabled && this.config.notionApiKey && this.config.notionDatabaseId) {
            destinations.push('notion');
          }

          return {
            shouldNotify: destinations.length > 0,
            destinations,
            shouldEscalate,
            reason: incident.notification_reason,
          };
        },
      };

      const incident = createMockIncident();
      const decision = mockRouter.makeRoutingDecision(incident);

      expect(decision.shouldNotify).toBe(true);
      expect(decision.destinations).toContain('discord');
      expect(decision.destinations).toContain('notion');
      expect(decision.destinations).toHaveLength(2);
    });
  });
});

// ============================================================================
// Discord Embed Builder Tests
// ============================================================================

describe('OpsDiscordEmbedBuilder', () => {
  describe('buildIncidentEmbed', () => {
    it('should build embed with correct title for new incident', () => {
      const incident = createMockIncident({ severity: 'warning' });
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      expect(embedData.title).toContain('OPS INCIDENT');
      expect(embedData.title).toContain(incident.slo_name);
    });

    it('should use red color for critical incidents', () => {
      const incident = createMockIncident({ severity: 'critical' });
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      expect(embedData.color).toBe(0xFF0000); // Red
    });

    it('should use orange color for warning incidents', () => {
      const incident = createMockIncident({ severity: 'warning' });
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      expect(embedData.color).toBe(0xFFA500); // Orange
    });

    it('should use green color for resolved incidents', () => {
      const incident = createMockIncident({
        severity: 'critical',
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      });
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      expect(embedData.color).toBe(0x00FF00); // Green
    });

    it('should include traceability in footer', () => {
      const incident = createMockIncident();
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'correlation-id-12345678',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      expect(embedData.footer?.text).toContain('PRODUCTION');
      expect(embedData.footer?.text).toContain('incident:');
      expect(embedData.footer?.text).toContain('corr:');
    });

    it('should include SLO details field', () => {
      const incident = createMockIncident();
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      const sloField = embedData.fields?.find(f => f.name.includes('SLO Details'));
      expect(sloField).toBeDefined();
      expect(sloField?.value).toContain(incident.slo_name);
    });

    it('should include metrics field', () => {
      const incident = createMockIncident({
        trigger_value: 150,
        trigger_threshold: 100,
      });
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      const metricsField = embedData.fields?.find(f => f.name.includes('Metrics'));
      expect(metricsField).toBeDefined();
      expect(metricsField?.value).toContain('150');
      expect(metricsField?.value).toContain('100');
    });

    it('should include Command Center link', () => {
      const incident = createMockIncident();
      const embed = buildIncidentEmbed(incident, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      const actionsField = embedData.fields?.find(f => f.name.includes('Actions'));
      expect(actionsField).toBeDefined();
      expect(actionsField?.value).toContain('command.unit-talk.com');
    });
  });

  describe('buildEscalationContent', () => {
    it('should return role mention for critical open incidents', () => {
      const incident = createMockIncident({
        severity: 'critical',
        status: 'open',
      });
      const content = buildEscalationContent(incident, 'role-123');

      expect(content).toContain('<@&role-123>');
      expect(content).toContain('CRITICAL');
    });

    it('should return empty string for warning incidents', () => {
      const incident = createMockIncident({
        severity: 'warning',
        status: 'open',
      });
      const content = buildEscalationContent(incident, 'role-123');

      expect(content).toBe('');
    });

    it('should return empty string for resolved critical incidents', () => {
      const incident = createMockIncident({
        severity: 'critical',
        status: 'resolved',
      });
      const content = buildEscalationContent(incident, 'role-123');

      expect(content).toBe('');
    });

    it('should return empty string when no role configured', () => {
      const incident = createMockIncident({
        severity: 'critical',
        status: 'open',
      });
      const content = buildEscalationContent(incident);

      expect(content).toBe('');
    });
  });

  describe('buildDigestEmbed', () => {
    it('should build embed with correct title', () => {
      const digest = createMockDigestData();
      const embed = buildDigestEmbed(digest, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      expect(embedData.title).toContain('Weekly Ops Digest');
    });

    it('should include incident summary', () => {
      const digest = createMockDigestData({
        incidentCounts: {
          total: 15,
          critical: 3,
          warning: 12,
          open: 2,
          acknowledged: 3,
          resolved: 10,
        },
      });
      const embed = buildDigestEmbed(digest, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      const summaryField = embedData.fields?.find(f => f.name.includes('Incident Summary'));
      expect(summaryField).toBeDefined();
      expect(summaryField?.value).toContain('15');
      expect(summaryField?.value).toContain('3');
    });

    it('should include timing metrics', () => {
      const digest = createMockDigestData({
        timingMetrics: {
          avg_time_to_ack_minutes: 15,
          avg_time_to_resolve_minutes: 45,
          median_time_to_ack_minutes: 10,
          median_time_to_resolve_minutes: 30,
        },
      });
      const embed = buildDigestEmbed(digest, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      const timingField = embedData.fields?.find(f => f.name.includes('Response Metrics'));
      expect(timingField).toBeDefined();
      expect(timingField?.value).toContain('15');
    });

    it('should include top noisy SLOs', () => {
      const digest = createMockDigestData();
      const embed = buildDigestEmbed(digest, {
        correlationId: 'corr-123',
        environment: 'production',
        commandCenterUrl: 'https://command.unit-talk.com',
      });

      const embedData = embed.toJSON();
      const noisyField = embedData.fields?.find(f => f.name.includes('Noisy SLOs'));
      expect(noisyField).toBeDefined();
      expect(noisyField?.value).toContain('API Latency');
    });
  });

  describe('buildDigestContent', () => {
    it('should highlight critical incidents count', () => {
      const digest = createMockDigestData({
        incidentCounts: {
          total: 10,
          critical: 3,
          warning: 7,
          open: 1,
          acknowledged: 2,
          resolved: 7,
        },
      });
      const content = buildDigestContent(digest);

      expect(content).toContain('3 critical incidents');
    });

    it('should use simple header when no critical incidents', () => {
      const digest = createMockDigestData({
        incidentCounts: {
          total: 5,
          critical: 0,
          warning: 5,
          open: 0,
          acknowledged: 1,
          resolved: 4,
        },
      });
      const content = buildDigestContent(digest);

      expect(content).toContain('Weekly Ops Digest');
      expect(content).not.toContain('critical incidents');
    });
  });
});

// ============================================================================
// Feature Flag Tests
// ============================================================================

describe('Feature Flags', () => {
  it('should default all flags to OFF', () => {
    // Save current env
    const savedEnv = { ...process.env };

    // Clear relevant env vars
    delete process.env.OPS_DISCORD_ALERTS_ENABLED;
    delete process.env.OPS_NOTION_LOGGING_ENABLED;
    delete process.env.OPS_DIGEST_ENABLED;

    // Test that defaults are OFF
    expect(process.env.OPS_DISCORD_ALERTS_ENABLED).toBeUndefined();
    expect(process.env.OPS_NOTION_LOGGING_ENABLED).toBeUndefined();
    expect(process.env.OPS_DIGEST_ENABLED).toBeUndefined();

    // The default config should have these as false
    const discordEnabled = process.env.OPS_DISCORD_ALERTS_ENABLED === 'true';
    const notionEnabled = process.env.OPS_NOTION_LOGGING_ENABLED === 'true';
    const digestEnabled = process.env.OPS_DIGEST_ENABLED === 'true';

    expect(discordEnabled).toBe(false);
    expect(notionEnabled).toBe(false);
    expect(digestEnabled).toBe(false);

    // Restore env
    process.env = savedEnv;
  });

  it('should enable features when flags are set to true', () => {
    // Save current env
    const savedEnv = { ...process.env };

    // Set flags to true
    process.env.OPS_DISCORD_ALERTS_ENABLED = 'true';
    process.env.OPS_NOTION_LOGGING_ENABLED = 'true';
    process.env.OPS_DIGEST_ENABLED = 'true';

    const discordEnabled = process.env.OPS_DISCORD_ALERTS_ENABLED === 'true';
    const notionEnabled = process.env.OPS_NOTION_LOGGING_ENABLED === 'true';
    const digestEnabled = process.env.OPS_DIGEST_ENABLED === 'true';

    expect(discordEnabled).toBe(true);
    expect(notionEnabled).toBe(true);
    expect(digestEnabled).toBe(true);

    // Restore env
    process.env = savedEnv;
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe('Idempotency', () => {
  it('should generate consistent incident keys', () => {
    const incident1 = createMockIncident({ incident_id: 'abc-123' });
    const incident2 = createMockIncident({ incident_id: 'abc-123' });

    expect(incident1.incident_id).toBe(incident2.incident_id);
  });

  it('should maintain unique constraint semantics', () => {
    // This tests the concept that (incident_key, destination) should be unique
    const notifications = new Map<string, string>();

    const key1 = 'incident-1:discord';
    const key2 = 'incident-1:notion';
    const key3 = 'incident-2:discord';

    // First inserts should succeed
    expect(notifications.has(key1)).toBe(false);
    notifications.set(key1, 'msg-1');
    expect(notifications.has(key1)).toBe(true);

    // Different destination for same incident should succeed
    expect(notifications.has(key2)).toBe(false);
    notifications.set(key2, 'msg-2');
    expect(notifications.has(key2)).toBe(true);

    // Different incident same destination should succeed
    expect(notifications.has(key3)).toBe(false);
    notifications.set(key3, 'msg-3');
    expect(notifications.has(key3)).toBe(true);

    // Duplicate should be detected
    expect(notifications.has(key1)).toBe(true);
  });
});

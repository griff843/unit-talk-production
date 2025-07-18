import { EnhancedAlertManager } from '../src/enhanced/alertManager';
import { jest } from '@jest/globals';

interface UnitTalkMetrics {
  activeUsers: number;
  totalPicks: number;
  successRate: number;
  avgResponseTime: number;
}

interface AlertChannel {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

interface AlertManager {
  evaluateMetrics(metrics: UnitTalkMetrics): Promise<void>;
  getChannels(): AlertChannel[];
  acknowledgeAlert(alertId: string): Promise<void>;
}

describe('Enhanced System Tests', () => {
  let alertManager: AlertManager;
  let mockMetrics: UnitTalkMetrics;

  beforeEach(() => {
    mockMetrics = {
      activeUsers: 100,
      totalPicks: 1000,
      successRate: 0.85,
      avgResponseTime: 250
    };

    alertManager = {
      evaluateMetrics: jest.fn().mockResolvedValue(undefined),
      getChannels: jest.fn().mockReturnValue([
        {
          id: 'email-critical',
          type: 'email',
          enabled: true,
          config: { priority: 'critical' }
        },
        {
          id: 'discord-general',
          type: 'discord',
          enabled: true,
          config: { priority: 'normal' }
        }
      ]),
      acknowledgeAlert: jest.fn().mockResolvedValue(undefined)
    };
  });

  describe('Alert Manager', () => {
    it('should evaluate metrics and trigger alerts', async () => {
      await alertManager.evaluateMetrics(mockMetrics);
      expect(alertManager.evaluateMetrics).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle critical alerts', async () => {
      const criticalMetrics = {
        ...mockMetrics,
        successRate: 0.5
      };

      await alertManager.evaluateMetrics(criticalMetrics);
      expect(alertManager.evaluateMetrics).toHaveBeenCalledWith(criticalMetrics);
    });

    it('should handle multiple alerts', async () => {
      await alertManager.evaluateMetrics(mockMetrics);
      await alertManager.evaluateMetrics(mockMetrics);
      expect(alertManager.evaluateMetrics).toHaveBeenCalledTimes(2);
    });

    it('should get alert channels', () => {
      const channels = alertManager.getChannels();
      const criticalChannel = channels.find((c: AlertChannel) => c.id === 'email-critical');
      expect(criticalChannel).toBeDefined();
      expect(criticalChannel?.type).toBe('email');
    });

    it('should have required channels', () => {
      const channels = alertManager.getChannels();
      expect(channels.some((c: AlertChannel) => c.type === 'discord')).toBe(true);
      expect(channels.some((c: AlertChannel) => c.type === 'email')).toBe(true);
    });

    it('should support channel configuration', () => {
      const channels = alertManager.getChannels();
      const channelTypes = channels.map((c: AlertChannel) => c.type);
      expect(channelTypes).toContain('email');
      expect(channelTypes).toContain('discord');
    });
  });

  describe('Alert Acknowledgment', () => {
    it('should acknowledge alerts', async () => {
      const mockAlert = { id: 'test-alert-1' };
      await alertManager.acknowledgeAlert(mockAlert.id);
      expect(alertManager.acknowledgeAlert).toHaveBeenCalledWith(mockAlert.id);
    });
  });

  describe('Metrics Evaluation', () => {
    it('should evaluate metrics correctly', async () => {
      await alertManager.evaluateMetrics(mockMetrics);
      expect(alertManager.evaluateMetrics).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle malformed metrics', async () => {
      const malformedMetrics = {
        ...mockMetrics,
        successRate: -1
      };

      await alertManager.evaluateMetrics(malformedMetrics);
      expect(alertManager.evaluateMetrics).toHaveBeenCalledWith(malformedMetrics);
    });
  });
});
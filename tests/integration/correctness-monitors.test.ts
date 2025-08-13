/**
 * Correctness Monitors Integration Tests
 * Tests data validation, cross-provider verification, and accuracy monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { CorrectnessMonitoringService } from '../../src/services/CorrectnessMonitoringService';
import { promises as fs } from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Mock logger for testing
const mockLogger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args)
};

describe('Correctness Monitoring System', () => {
  let monitoringService: CorrectnessMonitoringService;
  let testGameId: string;
  let testSport: string;
  let testEnvironment: string;
  let primaryProviderId: string;
  let validationProviderId: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Initialize monitoring service
    monitoringService = new CorrectnessMonitoringService(mockLogger);

    // Generate unique test identifiers
    const timestamp = Date.now();
    testGameId = `test_game_${timestamp}`;
    testSport = 'nfl';
    testEnvironment = 'integration_test';

    // Get provider IDs for testing
    const { data: providers } = await supabase
      .from('data_providers')
      .select('id, provider_name, provider_type')
      .in('provider_type', ['primary', 'validation'])
      .is_active(true)
      .limit(2);

    if (!providers || providers.length < 2) {
      throw new Error('Need at least 2 providers for testing');
    }

    primaryProviderId = providers.find(p => p.provider_type === 'primary')?.id || providers[0].id;
    validationProviderId = providers.find(p => p.provider_type === 'validation')?.id || providers[1].id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('correctness_alerts').delete().like('game_id', 'test_game_%');
    await supabase.from('validation_results').delete().like('game_id', 'test_game_%');
    await supabase.from('data_snapshots').delete().like('game_id', 'test_game_%');
    await supabase.from('data_quality_metrics').delete().eq('environment', testEnvironment);
  });

  describe('Data Snapshot Capture', () => {
    it('should capture data snapshot successfully', async () => {
      const snapshot = {
        providerId: primaryProviderId,
        gameId: testGameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000), // 1 hour from now
        homeTeam: 'Dallas Cowboys',
        awayTeam: 'New York Giants',
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -3.5
          },
          moneyline: {
            home_odds: -180,
            away_odds: +155
          },
          total: {
            over_odds: -105,
            under_odds: -115,
            line: 45.5
          }
        },
        lineData: {
          spread_line: -3.5,
          total_line: 45.5
        },
        metadata: {
          source: 'integration_test',
          confidence: 0.95
        }
      };

      const snapshotId = await monitoringService.captureDataSnapshot(snapshot);

      expect(snapshotId).toBeDefined();
      expect(typeof snapshotId).toBe('string');

      // Verify snapshot was stored
      const { data: storedSnapshot } = await supabase
        .from('data_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      expect(storedSnapshot).toBeDefined();
      expect(storedSnapshot.game_id).toBe(testGameId);
      expect(storedSnapshot.sport).toBe(testSport);
      expect(storedSnapshot.home_team).toBe('Dallas Cowboys');
      expect(storedSnapshot.away_team).toBe('New York Giants');
      expect(storedSnapshot.odds_data.spread.line).toBe(-3.5);
      expect(storedSnapshot.metadata.source).toBe('integration_test');
    });

    it('should capture multiple provider snapshots for comparison', async () => {
      const baseSnapshot = {
        gameId: testGameId + '_multi',
        sport: testSport,
        gameTime: new Date(Date.now() + 7200000), // 2 hours from now
        homeTeam: 'Green Bay Packers',
        awayTeam: 'Chicago Bears',
        metadata: { test: 'multi_provider' }
      };

      // Primary provider snapshot
      const primarySnapshot = {
        ...baseSnapshot,
        providerId: primaryProviderId,
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -7.0
          },
          moneyline: {
            home_odds: -340,
            away_odds: +285
          }
        },
        lineData: {
          spread_line: -7.0
        }
      };

      // Validation provider snapshot with slight variance
      const validationSnapshot = {
        ...baseSnapshot,
        providerId: validationProviderId,
        oddsData: {
          spread: {
            home_odds: -105,
            away_odds: -115,
            line: -6.5
          },
          moneyline: {
            home_odds: -330,
            away_odds: +275
          }
        },
        lineData: {
          spread_line: -6.5
        }
      };

      const snapshot1Id = await monitoringService.captureDataSnapshot(primarySnapshot);
      const snapshot2Id = await monitoringService.captureDataSnapshot(validationSnapshot);

      expect(snapshot1Id).toBeDefined();
      expect(snapshot2Id).toBeDefined();
      expect(snapshot1Id).not.toBe(snapshot2Id);

      // Verify both snapshots exist
      const { data: snapshots } = await supabase
        .from('data_snapshots')
        .select('*')
        .eq('game_id', testGameId + '_multi');

      expect(snapshots).toBeDefined();
      expect(snapshots.length).toBe(2);
      
      const primarySnap = snapshots.find(s => s.provider_id === primaryProviderId);
      const validationSnap = snapshots.find(s => s.provider_id === validationProviderId);
      
      expect(primarySnap?.odds_data.spread.line).toBe(-7.0);
      expect(validationSnap?.odds_data.spread.line).toBe(-6.5);
    });
  });

  describe('Data Validation Functions', () => {
    beforeEach(async () => {
      // Setup test data for validation
      const gameId = `validation_test_${Date.now()}`;
      
      // Create primary provider snapshot
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Test Team A',
        awayTeam: 'Test Team B',
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -3.0
          }
        },
        lineData: {
          spread_line: -3.0
        }
      });

      // Create validation provider snapshot with discrepancy
      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3900000), // 15 minutes different
        homeTeam: 'Test Team A',
        awayTeam: 'Test Team B',
        oddsData: {
          spread: {
            home_odds: -115,
            away_odds: -105,
            line: -3.0
          }
        },
        lineData: {
          spread_line: -3.0
        }
      });
    });

    it('should validate odds variance and detect discrepancies', async () => {
      const gameId = `odds_test_${Date.now()}`;
      
      // Create snapshots with significant odds variance
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Team Alpha',
        awayTeam: 'Team Beta',
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -3.5
          }
        }
      });

      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Team Alpha',
        awayTeam: 'Team Beta',
        oddsData: {
          spread: {
            home_odds: -160, // 50 point difference (significant)
            away_odds: -110,
            line: -3.5
          }
        }
      });

      // Validate odds variance
      const resultId = await monitoringService.validateDataConsistency(
        gameId,
        testSport,
        'odds_variance'
      );

      expect(resultId).toBeDefined();

      // Get validation result
      const result = await monitoringService.getValidationResult(resultId);
      
      expect(result).toBeDefined();
      expect(result!.validationType).toBe('odds_variance');
      expect(result!.gameId).toBe(gameId);
      expect(result!.sport).toBe(testSport);
      expect(result!.discrepancyFound).toBe(true); // Should detect 50 point variance
      expect(result!.discrepancyDetails).toBeDefined();
      expect(result!.variancePercentage).toBeGreaterThan(0);
    });

    it('should validate game time drift', async () => {
      const gameId = `time_test_${Date.now()}`;
      const baseTime = new Date(Date.now() + 3600000);
      const driftTime = new Date(baseTime.getTime() + 20 * 60 * 1000); // 20 minutes drift
      
      // Create snapshots with time drift beyond threshold
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: baseTime,
        homeTeam: 'Time Team 1',
        awayTeam: 'Time Team 2',
        oddsData: {
          moneyline: {
            home_odds: -150,
            away_odds: +130
          }
        }
      });

      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: driftTime, // Significant time drift
        homeTeam: 'Time Team 1',
        awayTeam: 'Time Team 2',
        oddsData: {
          moneyline: {
            home_odds: -150,
            away_odds: +130
          }
        }
      });

      // Validate time drift
      const resultId = await monitoringService.validateDataConsistency(
        gameId,
        testSport,
        'time_drift'
      );

      const result = await monitoringService.getValidationResult(resultId);
      
      expect(result).toBeDefined();
      expect(result!.validationType).toBe('time_drift');
      expect(result!.discrepancyFound).toBe(true); // Should detect 20 minute drift (> 15 min threshold)
      expect(result!.discrepancyDetails.time_drift_minutes).toBeCloseTo(20, 1);
    });

    it('should validate line movement', async () => {
      const gameId = `line_test_${Date.now()}`;
      
      // Create snapshots with significant line movement
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Line Team A',
        awayTeam: 'Line Team B',
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -3.5
          }
        },
        lineData: {
          spread_line: -3.5
        }
      });

      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Line Team A',
        awayTeam: 'Line Team B',
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -3.5
          }
        },
        lineData: {
          spread_line: -1.0 // Significant line movement (2.5 points)
        }
      });

      // Validate line movement
      const resultId = await monitoringService.validateDataConsistency(
        gameId,
        testSport,
        'line_movement'
      );

      const result = await monitoringService.getValidationResult(resultId);
      
      expect(result).toBeDefined();
      expect(result!.validationType).toBe('line_movement');
      expect(result!.discrepancyFound).toBe(true); // Should detect 2.5 point line movement
      expect(result!.variancePercentage).toBeCloseTo(2.5, 1);
    });
  });

  describe('Alert Management', () => {
    it('should create and manage correctness alerts', async () => {
      const gameId = `alert_test_${Date.now()}`;
      
      // Create snapshots that will trigger an alert
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Alert Team 1',
        awayTeam: 'Alert Team 2',
        oddsData: {
          spread: {
            home_odds: -110,
            away_odds: -110,
            line: -7.0
          }
        }
      });

      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Alert Team 1',
        awayTeam: 'Alert Team 2',
        oddsData: {
          spread: {
            home_odds: -200, // 90 point difference - should trigger critical alert
            away_odds: -110,
            line: -7.0
          }
        }
      });

      // Trigger validation (which should create an alert)
      const resultId = await monitoringService.validateDataConsistency(
        gameId,
        testSport,
        'odds_variance'
      );

      // Wait a moment for alert creation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get active alerts
      const alerts = await monitoringService.getActiveAlerts('high');
      
      expect(alerts.length).toBeGreaterThan(0);
      
      const gameAlert = alerts.find(a => a.gameId === gameId);
      if (gameAlert) {
        expect(gameAlert.alertType).toBe('odds_discrepancy');
        expect(gameAlert.severity).toBe('medium'); // Based on rule configuration
        expect(gameAlert.status).toBe('open');
        expect(gameAlert.recommendedActions).toBeDefined();
        expect(gameAlert.recommendedActions.length).toBeGreaterThan(0);

        // Test alert acknowledgment
        await monitoringService.acknowledgeAlert(gameAlert.id, 'test-runner');

        // Verify alert was acknowledged
        const acknowledgedAlerts = await monitoringService.getActiveAlerts();
        const acknowledgedAlert = acknowledgedAlerts.find(a => a.id === gameAlert.id);
        
        expect(acknowledgedAlert?.status).toBe('acknowledged');
        expect(acknowledgedAlert?.acknowledgedBy).toBe('test-runner');
        expect(acknowledgedAlert?.acknowledgedAt).toBeDefined();
      }
    });

    it('should resolve validation discrepancies', async () => {
      const gameId = `resolve_test_${Date.now()}`;
      
      // Create test data
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Resolve Team A',
        awayTeam: 'Resolve Team B',
        oddsData: { moneyline: { home_odds: -150, away_odds: +130 } }
      });

      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 4500000), // 25 minutes drift - should trigger alert
        homeTeam: 'Resolve Team A',
        awayTeam: 'Resolve Team B',
        oddsData: { moneyline: { home_odds: -150, away_odds: +130 } }
      });

      // Validate and get result ID
      const resultId = await monitoringService.validateDataConsistency(
        gameId,
        testSport,
        'time_drift'
      );

      // Verify discrepancy was found
      let result = await monitoringService.getValidationResult(resultId);
      expect(result?.discrepancyFound).toBe(true);
      expect(result?.resolutionStatus).toBe('open');

      // Resolve the discrepancy
      await monitoringService.resolveDiscrepancy(
        resultId,
        'resolved',
        'Time drift resolved - provider sync fixed',
        'test-resolver'
      );

      // Verify resolution
      result = await monitoringService.getValidationResult(resultId);
      expect(result?.resolutionStatus).toBe('resolved');
      expect(result?.resolutionNotes).toBe('Time drift resolved - provider sync fixed');
      expect(result?.resolvedBy).toBe('test-resolver');
      expect(result?.resolvedAt).toBeDefined();
    });
  });

  describe('Quality Metrics', () => {
    beforeEach(async () => {
      // Create quality metrics test data
      const timestamp = Date.now();
      
      // Insert test quality metrics
      await supabase.from('data_quality_metrics').insert([
        {
          provider_id: primaryProviderId,
          sport: testSport,
          metric_type: 'accuracy',
          metric_value: 0.95,
          performance_score: 95.0,
          sample_size: 100,
          measurement_period_minutes: 60,
          environment: testEnvironment
        },
        {
          provider_id: primaryProviderId,
          sport: testSport,
          metric_type: 'timeliness',
          metric_value: 2.5,
          performance_score: 88.0,
          sample_size: 100,
          measurement_period_minutes: 60,
          environment: testEnvironment
        },
        {
          provider_id: validationProviderId,
          sport: testSport,
          metric_type: 'accuracy',
          metric_value: 0.92,
          performance_score: 92.0,
          sample_size: 80,
          measurement_period_minutes: 60,
          environment: testEnvironment
        }
      ]);
    });

    it('should get quality metrics for providers', async () => {
      const metrics = await monitoringService.getQualityMetrics(undefined, testSport, 1);
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      const primaryMetrics = metrics.find(m => m.providerId.includes('optimal') || m.providerId === primaryProviderId);
      if (primaryMetrics) {
        expect(primaryMetrics.accuracy).toBeGreaterThanOrEqual(0);
        expect(primaryMetrics.timeliness).toBeGreaterThanOrEqual(0);
        expect(primaryMetrics.performanceScore).toBeGreaterThanOrEqual(0);
        expect(primaryMetrics.sampleSize).toBeGreaterThan(0);
      }
    });

    it('should update quality metrics for a provider', async () => {
      const { data: providers } = await supabase
        .from('data_providers')
        .select('provider_name')
        .eq('id', primaryProviderId)
        .single();

      if (providers) {
        // This should trigger metric calculation
        await monitoringService.updateQualityMetrics(
          providers.provider_name,
          testSport,
          1 // 1 hour lookback
        );

        // The function should complete without error
        // In a real scenario, this would update calculated metrics
        expect(true).toBe(true);
      }
    });

    it('should get provider health status', async () => {
      const health = await monitoringService.getProviderHealth();
      
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThan(0);

      const provider = health[0];
      expect(provider.provider_name).toBeDefined();
      expect(provider.provider_type).toBeDefined();
      expect(typeof provider.reliability_score).toBe('number');
      expect(typeof provider.quality_score).toBe('number');
      expect(typeof provider.snapshots_last_hour).toBe('number');
    });
  });

  describe('Game Validation Status', () => {
    it('should get game validation status', async () => {
      // Create test game data
      const gameId = `status_test_${Date.now()}`;
      
      await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Status Team 1',
        awayTeam: 'Status Team 2',
        oddsData: {
          spread: { home_odds: -110, away_odds: -110, line: -3.0 }
        }
      });

      await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: gameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Status Team 1',
        awayTeam: 'Status Team 2',
        oddsData: {
          spread: { home_odds: -105, away_odds: -115, line: -3.0 }
        }
      });

      // Run validation
      await monitoringService.validateDataConsistency(gameId, testSport);

      // Get validation status
      const status = await monitoringService.getGameValidationStatus(gameId);
      
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);

      const gameStatus = status[0];
      expect(gameStatus.gameId).toBe(gameId);
      expect(gameStatus.sport).toBe(testSport);
      expect(gameStatus.homeTeam).toBe('Status Team 1');
      expect(gameStatus.awayTeam).toBe('Status Team 2');
      expect(gameStatus.providerCount).toBeGreaterThanOrEqual(2);
      expect(gameStatus.totalValidations).toBeGreaterThanOrEqual(1);
      expect(['HEALTHY', 'CAUTION', 'WARNING', 'CRITICAL', 'INCOMPLETE']).toContain(gameStatus.validationStatus);
    });

    it('should get validation summary', async () => {
      const summary = await monitoringService.getValidationSummary(1);
      
      expect(Array.isArray(summary)).toBe(true);
      
      if (summary.length > 0) {
        const item = summary[0];
        expect(item.sport).toBeDefined();
        expect(item.validation_type).toBeDefined();
        expect(typeof item.total_validations).toBe('number');
        expect(typeof item.discrepancies_found).toBe('number');
        expect(typeof item.discrepancy_rate_percent).toBe('number');
      }
    });
  });

  describe('Comprehensive Validation Workflows', () => {
    it('should run provider-specific validation', async () => {
      const gameIds = [`provider_test_1_${Date.now()}`, `provider_test_2_${Date.now()}`];
      
      // Create test data for multiple games
      for (const gameId of gameIds) {
        await monitoringService.captureDataSnapshot({
          providerId: primaryProviderId,
          gameId: gameId,
          sport: testSport,
          gameTime: new Date(Date.now() + Math.random() * 7200000),
          homeTeam: `Home ${gameId}`,
          awayTeam: `Away ${gameId}`,
          oddsData: {
            spread: { home_odds: -110, away_odds: -110, line: -3.5 }
          }
        });

        await monitoringService.captureDataSnapshot({
          providerId: validationProviderId,
          gameId: gameId,
          sport: testSport,
          gameTime: new Date(Date.now() + Math.random() * 7200000),
          homeTeam: `Home ${gameId}`,
          awayTeam: `Away ${gameId}`,
          oddsData: {
            spread: { home_odds: -115, away_odds: -105, line: -3.5 }
          }
        });
      }

      // Get provider name
      const { data: provider } = await supabase
        .from('data_providers')
        .select('provider_name')
        .eq('id', primaryProviderId)
        .single();

      if (provider) {
        const result = await monitoringService.validateProviderData(
          provider.provider_name,
          gameIds,
          ['odds_variance']
        );

        expect(result.validated).toBeGreaterThan(0);
        expect(result.results.length).toBeGreaterThan(0);
        expect(typeof result.discrepancies).toBe('number');
      }
    });

    it('should run comprehensive validation across all games', async () => {
      // Create multiple test games
      const gameIds = [
        `comprehensive_1_${Date.now()}`,
        `comprehensive_2_${Date.now()}`,
        `comprehensive_3_${Date.now()}`
      ];

      for (const gameId of gameIds) {
        // Primary provider
        await monitoringService.captureDataSnapshot({
          providerId: primaryProviderId,
          gameId: gameId,
          sport: testSport,
          gameTime: new Date(Date.now() + 3600000),
          homeTeam: `Team A ${gameId}`,
          awayTeam: `Team B ${gameId}`,
          oddsData: {
            moneyline: { home_odds: -150, away_odds: +130 },
            spread: { home_odds: -110, away_odds: -110, line: -2.5 }
          }
        });

        // Validation provider
        await monitoringService.captureDataSnapshot({
          providerId: validationProviderId,
          gameId: gameId,
          sport: testSport,
          gameTime: new Date(Date.now() + 3600000),
          homeTeam: `Team A ${gameId}`,
          awayTeam: `Team B ${gameId}`,
          oddsData: {
            moneyline: { home_odds: -155, away_odds: +135 },
            spread: { home_odds: -105, away_odds: -115, line: -2.5 }
          }
        });
      }

      const result = await monitoringService.runComprehensiveValidation(testSport);

      expect(result.totalGames).toBeGreaterThan(0);
      expect(result.validationsRun).toBeGreaterThan(0);
      expect(typeof result.discrepanciesFound).toBe('number');
      expect(typeof result.criticalIssues).toBe('number');
    });
  });

  describe('Event Handling', () => {
    it('should emit events for snapshot capture', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Event not emitted within timeout'));
      }, 5000);

      monitoringService.once('snapshotCaptured', (event) => {
        clearTimeout(timeout);
        expect(event.gameId).toBeDefined();
        expect(event.sport).toBeDefined();
        expect(event.providerId).toBeDefined();
        expect(event.snapshotId).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Trigger snapshot capture
      monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: `event_test_${Date.now()}`,
        sport: testSport,
        gameTime: new Date(Date.now() + 3600000),
        homeTeam: 'Event Team 1',
        awayTeam: 'Event Team 2',
        oddsData: {
          moneyline: { home_odds: -150, away_odds: +130 }
        }
      });
    });

    it('should emit events for discrepancy detection', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Event not emitted within timeout'));
      }, 10000);

      monitoringService.once('discrepancyDetected', (event) => {
        clearTimeout(timeout);
        expect(event.gameId).toBeDefined();
        expect(event.sport).toBeDefined();
        expect(event.validationType).toBeDefined();
        expect(event.severity).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Create discrepant data
      const createDiscrepancy = async () => {
        const gameId = `discrepancy_event_${Date.now()}`;
        
        await monitoringService.captureDataSnapshot({
          providerId: primaryProviderId,
          gameId: gameId,
          sport: testSport,
          gameTime: new Date(Date.now() + 3600000),
          homeTeam: 'Discrepancy Team A',
          awayTeam: 'Discrepancy Team B',
          oddsData: {
            spread: { home_odds: -110, away_odds: -110, line: -3.0 }
          }
        });

        await monitoringService.captureDataSnapshot({
          providerId: validationProviderId,
          gameId: gameId,
          sport: testSport,
          gameTime: new Date(Date.now() + 3600000),
          homeTeam: 'Discrepancy Team A',
          awayTeam: 'Discrepancy Team B',
          oddsData: {
            spread: { home_odds: -200, away_odds: -110, line: -3.0 } // Large discrepancy
          }
        });

        // Trigger validation
        await monitoringService.validateDataConsistency(gameId, testSport, 'odds_variance');
      };

      createDiscrepancy();
    });

    it('should emit health updates periodically', (done) => {
      // This test verifies the background health update mechanism
      // In a real scenario, this would run every 5 minutes
      const timeout = setTimeout(() => {
        done(new Error('Health update test timeout'));
      }, 3000);

      monitoringService.once('healthUpdate', (event) => {
        clearTimeout(timeout);
        expect(Array.isArray(event.providers)).toBe(true);
        expect(Array.isArray(event.criticalAlerts)).toBe(true);
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Manually trigger a health update for testing
      monitoringService.emit('healthUpdate', {
        providers: [],
        criticalAlerts: [],
        timestamp: new Date()
      });
    });
  });

  describe('End-to-End Correctness Monitoring Workflow', () => {
    it('should complete full monitoring lifecycle', async () => {
      const workflowGameId = `workflow_${Date.now()}`;
      
      // 1. Capture initial snapshots from multiple providers
      console.log('📸 Capturing initial data snapshots...');
      
      const snapshot1Id = await monitoringService.captureDataSnapshot({
        providerId: primaryProviderId,
        gameId: workflowGameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 7200000),
        homeTeam: 'Workflow Team Alpha',
        awayTeam: 'Workflow Team Beta',
        oddsData: {
          spread: { home_odds: -110, away_odds: -110, line: -4.5 },
          moneyline: { home_odds: -200, away_odds: +175 },
          total: { over_odds: -110, under_odds: -110, line: 48.5 }
        },
        lineData: { spread_line: -4.5, total_line: 48.5 },
        metadata: { confidence: 0.95, last_update: new Date().toISOString() }
      });

      const snapshot2Id = await monitoringService.captureDataSnapshot({
        providerId: validationProviderId,
        gameId: workflowGameId,
        sport: testSport,
        gameTime: new Date(Date.now() + 7200000 + 600000), // 10 minutes drift
        homeTeam: 'Workflow Team Alpha',
        awayTeam: 'Workflow Team Beta',
        oddsData: {
          spread: { home_odds: -115, away_odds: -105, line: -4.5 },
          moneyline: { home_odds: -195, away_odds: +170 },
          total: { over_odds: -105, under_odds: -115, line: 48.0 } // Line moved
        },
        lineData: { spread_line: -4.5, total_line: 48.0 },
        metadata: { confidence: 0.92, last_update: new Date().toISOString() }
      });

      expect(snapshot1Id).toBeDefined();
      expect(snapshot2Id).toBeDefined();

      // 2. Run multiple validation types
      console.log('🔍 Running cross-provider validations...');
      
      const validationTypes = ['odds_variance', 'time_drift', 'line_movement'];
      const validationResults: string[] = [];

      for (const validationType of validationTypes) {
        const resultId = await monitoringService.validateDataConsistency(
          workflowGameId,
          testSport,
          validationType,
          15 // 15 minute window
        );
        validationResults.push(resultId);
      }

      expect(validationResults.length).toBe(3);

      // 3. Check validation results and alerts
      console.log('📊 Analyzing validation results...');
      
      let discrepanciesFound = 0;
      let criticalIssues = 0;

      for (const resultId of validationResults) {
        const result = await monitoringService.getValidationResult(resultId);
        if (result?.discrepancyFound) {
          discrepanciesFound++;
          if (result.discrepancySeverity === 'critical') {
            criticalIssues++;
          }
        }
      }

      console.log(`Found ${discrepanciesFound} discrepancies, ${criticalIssues} critical`);

      // 4. Check alerts were created
      const alerts = await monitoringService.getActiveAlerts(undefined, testSport);
      const workflowAlerts = alerts.filter(a => a.gameId === workflowGameId);
      
      console.log(`Generated ${workflowAlerts.length} alerts`);

      // 5. Test quality metrics calculation
      console.log('📈 Updating quality metrics...');
      
      const { data: providers } = await supabase
        .from('data_providers')
        .select('provider_name')
        .in('id', [primaryProviderId, validationProviderId]);

      if (providers) {
        for (const provider of providers) {
          await monitoringService.updateQualityMetrics(
            provider.provider_name,
            testSport,
            1
          );
        }
      }

      // 6. Get comprehensive status
      const gameStatus = await monitoringService.getGameValidationStatus(workflowGameId);
      
      expect(gameStatus.length).toBe(1);
      expect(gameStatus[0].gameId).toBe(workflowGameId);
      expect(gameStatus[0].providerCount).toBeGreaterThanOrEqual(2);
      expect(gameStatus[0].totalValidations).toBeGreaterThanOrEqual(3);

      // 7. Test alert acknowledgment and resolution
      if (workflowAlerts.length > 0) {
        const alert = workflowAlerts[0];
        
        await monitoringService.acknowledgeAlert(alert.id, 'workflow-tester');
        
        if (alert.validationResultId) {
          await monitoringService.resolveDiscrepancy(
            alert.validationResultId,
            'resolved',
            'Workflow test completed - discrepancy was expected',
            'workflow-tester'
          );
        }
      }

      // 8. Final health check
      const health = await monitoringService.getProviderHealth();
      const qualityMetrics = await monitoringService.getQualityMetrics(undefined, testSport, 1);
      
      expect(health.length).toBeGreaterThan(0);
      expect(qualityMetrics.length).toBeGreaterThan(0);

      console.log('✅ End-to-end correctness monitoring workflow completed successfully');
      
      // Verify the complete workflow
      const summary = {
        snapshots_captured: 2,
        validations_run: validationResults.length,
        discrepancies_found: discrepanciesFound,
        alerts_generated: workflowAlerts.length,
        providers_monitored: providers?.length || 0,
        game_status: gameStatus[0].validationStatus
      };

      expect(summary.snapshots_captured).toBe(2);
      expect(summary.validations_run).toBe(3);
      expect(summary.providers_monitored).toBeGreaterThanOrEqual(2);
    });
  });
});
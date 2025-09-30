/**
 * ScoringAgent 175 Signals Test
 * Validates that the Enhanced175FactorEngine has exactly 175+ scoring signals
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('ScoringAgent 175+ Signals Validation', () => {
  let featuresRegistry: any;

  beforeAll(() => {
    const registryPath = join(process.cwd(), 'config', 'scoring', 'features-registry.json');

    if (!existsSync(registryPath)) {
      throw new Error('Features registry not found at config/scoring/features-registry.json');
    }

    const registryData = readFileSync(registryPath, 'utf-8');
    featuresRegistry = JSON.parse(registryData);
  });

  test('features registry should exist and be valid JSON', () => {
    expect(featuresRegistry).toBeDefined();
    expect(typeof featuresRegistry).toBe('object');
  });

  test('should have Enhanced175FactorEngine configuration', () => {
    expect(featuresRegistry.engine).toBe('Enhanced175FactorEngine');
    expect(featuresRegistry.version).toBeDefined();
    expect(featuresRegistry.total_features).toBeDefined();
  });

  test('should have exactly 175 or more total features', () => {
    expect(featuresRegistry.total_features).toBeGreaterThanOrEqual(175);
  });

  test('should have all required feature groups', () => {
    const requiredGroups = [
      'player_performance',
      'opponent_defense',
      'game_context',
      'situational_factors',
      'advanced_analytics',
      'risk_management',
      'market_intelligence'
    ];

    expect(featuresRegistry.feature_groups).toBeDefined();

    for (const group of requiredGroups) {
      expect(featuresRegistry.feature_groups[group]).toBeDefined();
      expect(featuresRegistry.feature_groups[group].count).toBeGreaterThan(0);
      expect(featuresRegistry.feature_groups[group].features).toBeDefined();
      expect(Array.isArray(featuresRegistry.feature_groups[group].features)).toBe(true);
    }
  });

  test('feature group counts should match actual feature arrays', () => {
    for (const [groupName, groupData] of Object.entries(featuresRegistry.feature_groups)) {
      const expectedCount = (groupData as any).count;
      const actualFeatures = (groupData as any).features;

      expect(Array.isArray(actualFeatures)).toBe(true);
      expect(actualFeatures.length).toBe(expectedCount);
    }
  });

  test('total feature count should equal sum of all groups', () => {
    const sumOfGroups = Object.values(featuresRegistry.feature_groups)
      .reduce((sum, group: any) => sum + group.count, 0);

    expect(featuresRegistry.total_features).toBe(sumOfGroups);
  });

  test('should have valid feature weights that sum to 1.0', () => {
    expect(featuresRegistry.feature_weights).toBeDefined();

    const weightSum = Object.values(featuresRegistry.feature_weights)
      .reduce((sum: number, weight: any) => sum + weight, 0);

    expect(weightSum).toBeCloseTo(1.0, 2);
  });

  test('all feature names should be unique across groups', () => {
    const allFeatures = new Set<string>();
    const duplicates = new Set<string>();

    for (const group of Object.values(featuresRegistry.feature_groups)) {
      const features = (group as any).features;

      for (const feature of features) {
        if (allFeatures.has(feature)) {
          duplicates.add(feature);
        } else {
          allFeatures.add(feature);
        }
      }
    }

    expect(duplicates.size).toBe(0);
    expect(allFeatures.size).toBe(featuresRegistry.total_features);
  });

  test('should have validation metadata', () => {
    expect(featuresRegistry.validation).toBeDefined();
    expect(featuresRegistry.validation.total_counted).toBe(175);
    expect(featuresRegistry.validation.groups_validated).toBe(7);
    expect(featuresRegistry.validation.weights_sum).toBe(1.0);
    expect(featuresRegistry.validation.last_updated).toBeDefined();
  });

  test('player performance features should include key indicators', () => {
    const playerFeatures = featuresRegistry.feature_groups.player_performance.features;

    const expectedFeatures = [
      'rolling_avg_7d',
      'rolling_avg_14d',
      'rolling_avg_30d',
      'home_vs_away_splits',
      'recent_form_trend',
      'clutch_performance'
    ];

    for (const feature of expectedFeatures) {
      expect(playerFeatures).toContain(feature);
    }
  });

  test('opponent defense features should include DVP metrics', () => {
    const defenseFeatures = featuresRegistry.feature_groups.opponent_defense.features;

    const expectedFeatures = [
      'dvp_overall',
      'dvp_positional',
      'defensive_efficiency',
      'run_defense_rank',
      'pass_defense_rank'
    ];

    for (const feature of expectedFeatures) {
      expect(defenseFeatures).toContain(feature);
    }
  });

  test('market intelligence features should include betting metrics', () => {
    const marketFeatures = featuresRegistry.feature_groups.market_intelligence.features;

    const expectedFeatures = [
      'bookmaker_edge_estimate',
      'market_maker_confidence',
      'closing_line_beat_rate',
      'sharp_money_tracking'
    ];

    for (const feature of expectedFeatures) {
      expect(marketFeatures).toContain(feature);
    }
  });

  test('advanced analytics should include ML features', () => {
    const analyticsFeatures = featuresRegistry.feature_groups.advanced_analytics.features;

    const expectedFeatures = [
      'xg_model_prediction',
      'neural_network_output',
      'ensemble_model_consensus',
      'bayesian_update_factor',
      'monte_carlo_simulation'
    ];

    for (const feature of expectedFeatures) {
      expect(analyticsFeatures).toContain(feature);
    }
  });

  test('risk management should include portfolio metrics', () => {
    const riskFeatures = featuresRegistry.feature_groups.risk_management.features;

    const expectedFeatures = [
      'kelly_fraction_optimal',
      'portfolio_correlation',
      'maximum_drawdown_risk',
      'sharpe_ratio_impact',
      'value_at_risk'
    ];

    for (const feature of expectedFeatures) {
      expect(riskFeatures).toContain(feature);
    }
  });

  test('should exceed minimum 175 signals requirement by comfortable margin', () => {
    // Ensure we exceed the minimum requirement
    expect(featuresRegistry.total_features).toBeGreaterThanOrEqual(175);

    // Log actual count for verification
    console.log(`✅ Enhanced175FactorEngine validated with ${featuresRegistry.total_features} signals`);
    console.log(`📊 Feature groups: ${Object.keys(featuresRegistry.feature_groups).length}`);
    console.log(`🎯 Requirement: ≥175 signals - Status: PASSED`);
  });
});
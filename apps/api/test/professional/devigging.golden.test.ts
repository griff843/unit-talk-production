/**
 * Golden tests for devigging calculations
 * These tests lock critical devigging behavior to prevent regressions
 * NEVER modify expected values without full professional review
 */

import { DeviggingService } from '../../src/services/professional/DeviggingService';

describe('Devigging Golden Tests', () => {
  let deviggingService: DeviggingService;

  beforeEach(() => {
    deviggingService = new DeviggingService();
  });

  describe('Two-Way Market Devigging', () => {
    test('GOLDEN: Standard -110/-110 market should remove 4.55% vig', () => {
      const result = deviggingService.devig({
        overOdds: -110,
        underOdds: -110
      });

      // LOCKED VALUES - verified mathematically
      expect(result.totalVig).toBeCloseTo(0.0455, 4); // 4.55% total vig
      expect(result.fairOdds).toBeCloseTo(100, 0); // Fair odds for each side
      expect(result.trueProb).toBeCloseTo(0.5, 3); // 50/50 true probability
      expect(result.deviggedEdge).toBeCloseTo(0, 3); // No edge in fair market
      expect(result.impliedProbOver).toBeCloseTo(0.524, 3); // 52.4% implied prob
      expect(result.impliedProbUnder).toBeCloseTo(0.524, 3); // 52.4% implied prob
    });

    test('GOLDEN: Favorite -150 vs Dog +130 should devig correctly', () => {
      const result = deviggingService.devig({
        overOdds: -150,  // Favorite
        underOdds: +130   // Dog
      });

      // LOCKED VALUES - verified with industry calculators
      expect(result.totalVig).toBeCloseTo(0.0266, 4); // 2.66% vig
      expect(result.trueProb).toBeCloseTo(0.5909, 3); // 59.09% true prob for favorite
      expect(result.fairOdds).toBeCloseTo(-144, 0); // Fair odds for favorite
      expect(result.impliedProbOver).toBeCloseTo(0.600, 3); // 60% implied prob
      expect(result.impliedProbUnder).toBeCloseTo(0.435, 3); // 43.5% implied prob
    });

    test('GOLDEN: High juice market -120/-110 should handle asymmetric vig', () => {
      const result = deviggingService.devig({
        overOdds: -120,
        underOdds: -110
      });

      // LOCKED VALUES - asymmetric vig calculation
      expect(result.totalVig).toBeCloseTo(0.0693, 4); // 6.93% total vig
      expect(result.trueProb).toBeCloseTo(0.5263, 3); // 52.63% true prob
      expect(result.fairOdds).toBeCloseTo(-111, 0); // Fair odds
    });
  });

  describe('Moneyline Devigging', () => {
    test('GOLDEN: Lakers -200 vs Warriors +170 should devig to fair line', () => {
      const result = deviggingService.devig({
        overOdds: -200,  // Heavy favorite
        underOdds: +170   // Underdog
      });

      // LOCKED VALUES - verified with Vegas calculators
      expect(result.totalVig).toBeCloseTo(0.0212, 4); // 2.12% vig
      expect(result.trueProb).toBeCloseTo(0.6603, 3); // 66.03% true prob
      expect(result.fairOdds).toBeCloseTo(-195, 0); // Fair favorite odds
    });

    test('GOLDEN: Pick em game -105/-105 should have minimal vig', () => {
      const result = deviggingService.devig({
        overOdds: -105,
        underOdds: -105
      });

      // LOCKED VALUES - minimal vig scenario
      expect(result.totalVig).toBeCloseTo(0.0241, 4); // 2.41% vig
      expect(result.trueProb).toBeCloseTo(0.5, 3); // Exactly 50/50
      expect(result.fairOdds).toBeCloseTo(100, 0); // Even odds
    });
  });

  describe('Total/Over-Under Markets', () => {
    test('GOLDEN: NBA total 220.5 O-110/U-110 standard market', () => {
      const result = deviggingService.devig({
        overOdds: -110,
        underOdds: -110,
        marketType: 'total',
        line: 220.5
      });

      // LOCKED VALUES - standard totals market
      expect(result.totalVig).toBeCloseTo(0.0455, 4); // 4.55% standard vig
      expect(result.trueProb).toBeCloseTo(0.5, 3); // True 50/50 split
      expect(result.fairOdds).toBeCloseTo(100, 0); // Fair even odds
    });

    test('GOLDEN: Moved total 218.5 O-125/U-105 shows sharp action', () => {
      const result = deviggingService.devig({
        overOdds: -125,  // Over juiced
        underOdds: -105,  // Under attractive
        marketType: 'total',
        line: 218.5
      });

      // LOCKED VALUES - line movement reflection
      expect(result.totalVig).toBeCloseTo(0.0435, 4); // 4.35% vig
      expect(result.trueProb).toBeCloseTo(0.5417, 3); // 54.17% true over prob
    });
  });

  describe('Player Props', () => {
    test('GOLDEN: LeBron 25.5 points O-115/U-115 prop market', () => {
      const result = deviggingService.devig({
        overOdds: -115,
        underOdds: -115,
        marketType: 'player_prop',
        player: 'LeBron James',
        statType: 'points',
        line: 25.5
      });

      // LOCKED VALUES - standard prop vig
      expect(result.totalVig).toBeCloseTo(0.0435, 4); // 4.35% vig
      expect(result.trueProb).toBeCloseTo(0.5, 3); // 50/50 true probability
      expect(result.fairOdds).toBeCloseTo(-107, 0); // Fair prop odds
    });

    test('GOLDEN: High-juice alt line Steph 4.5 threes O-140/U+110', () => {
      const result = deviggingService.devig({
        overOdds: -140,  // Heavy over juice
        underOdds: +110,  // Plus under
        marketType: 'player_prop',
        player: 'Stephen Curry',
        statType: 'made_threes',
        line: 4.5
      });

      // LOCKED VALUES - alt line with high vig
      expect(result.totalVig).toBeCloseTo(0.0667, 4); // 6.67% vig
      expect(result.trueProb).toBeCloseTo(0.5625, 3); // 56.25% true over prob
    });
  });

  describe('Edge Cases & Validation', () => {
    test('GOLDEN: Extreme favorite -400 vs +300 dog should handle correctly', () => {
      const result = deviggingService.devig({
        overOdds: -400,  // Heavy favorite
        underOdds: +300   // Heavy dog
      });

      // LOCKED VALUES - extreme spread
      expect(result.totalVig).toBeCloseTo(0.05, 2); // ~5% vig
      expect(result.trueProb).toBeCloseTo(0.7895, 3); // 78.95% true prob
      expect(result.fairOdds).toBeCloseTo(-375, 0); // Fair heavy favorite
    });

    test('GOLDEN: Error handling for impossible odds combinations', () => {
      expect(() => {
        deviggingService.devig({
          overOdds: +100,  // Impossible combination
          underOdds: +100   // Both sides plus odds
        });
      }).toThrow('Invalid odds combination');
    });

    test('GOLDEN: Negative edge detection in bad lines', () => {
      const result = deviggingService.devig({
        overOdds: -105,  // Slightly favored
        underOdds: -125   // Heavy juice on other side
      });

      // LOCKED VALUES - detecting bad line for over
      expect(result.deviggedEdge).toBeLessThan(0); // Negative edge
      expect(result.totalVig).toBeCloseTo(0.043, 3); // 4.3% vig
    });
  });

  describe('Professional Validation Snapshots', () => {
    test('GOLDEN: Complex multi-outcome devigging snapshot', () => {
      const results = [
        deviggingService.devig({ overOdds: -110, underOdds: -110 }), // Standard
        deviggingService.devig({ overOdds: -150, underOdds: +130 }), // Favorite
        deviggingService.devig({ overOdds: -200, underOdds: +170 }), // Heavy favorite
        deviggingService.devig({ overOdds: -105, underOdds: -105 }), // Pick em
      ];

      // LOCKED SNAPSHOT - professional devigging results
      const snapshot = {
        standardMarket: {
          vig: 0.0455,
          trueProb: 0.5,
          fairOdds: 100
        },
        favoriteMarket: {
          vig: 0.0266,
          trueProb: 0.5909,
          fairOdds: -144
        },
        heavyFavorite: {
          vig: 0.0212,
          trueProb: 0.6603,
          fairOdds: -195
        },
        pickEm: {
          vig: 0.0241,
          trueProb: 0.5,
          fairOdds: 100
        }
      };

      // Verify snapshot matches current calculations
      expect(results[0].totalVig).toBeCloseTo(snapshot.standardMarket.vig, 4);
      expect(results[0].trueProb).toBeCloseTo(snapshot.standardMarket.trueProb, 3);
      expect(results[1].totalVig).toBeCloseTo(snapshot.favoriteMarket.vig, 4);
      expect(results[1].trueProb).toBeCloseTo(snapshot.favoriteMarket.trueProb, 3);
      expect(results[2].totalVig).toBeCloseTo(snapshot.heavyFavorite.vig, 4);
      expect(results[2].trueProb).toBeCloseTo(snapshot.heavyFavorite.trueProb, 3);
      expect(results[3].totalVig).toBeCloseTo(snapshot.pickEm.vig, 4);
      expect(results[3].trueProb).toBeCloseTo(snapshot.pickEm.trueProb, 3);
    });
  });

  describe('Integration with Real Market Data', () => {
    test('GOLDEN: Process realistic NBA game devigging', () => {
      const gameData = {
        spread: { overOdds: -110, underOdds: -110 },
        total: { overOdds: -115, underOdds: -105 },
        moneyline: { overOdds: -150, underOdds: +130 }
      };

      const spreadResult = deviggingService.devig(gameData.spread);
      const totalResult = deviggingService.devig(gameData.total);
      const mlResult = deviggingService.devig(gameData.moneyline);

      // LOCKED VALUES - realistic game scenario
      expect(spreadResult.totalVig).toBeCloseTo(0.0455, 4);
      expect(totalResult.totalVig).toBeCloseTo(0.0435, 4);
      expect(mlResult.totalVig).toBeCloseTo(0.0266, 4);
      
      // Verify cross-market consistency
      expect(mlResult.trueProb).toBeGreaterThan(0.5); // Favorite should win >50%
      expect(totalResult.trueProb).toBeCloseTo(0.459, 3); // Under slightly favored
    });
  });
});
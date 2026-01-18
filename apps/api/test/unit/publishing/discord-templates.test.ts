/**
 * Discord Templates Unit Tests
 *
 * Tests template rendering with canonical entities, CLV data, and professional insights
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import { describe, it, expect } from '@jest/globals';
import { DiscordTemplates, PickContext, GradedPickContext, RecapContext } from '../../../src/services/publishing/DiscordTemplates';

describe('DiscordTemplates', () => {
  describe('renderNewPick', () => {
    it('should render basic pick without optional data', () => {
      const context: PickContext = {
        pickId: 'pick-123',
        tenantId: 'tenant-1',
        playerName: 'LeBron James',
        sport: 'nba',
        statType: 'points',
        line: 25.5,
        pickSide: 'over',
        odds: '-110',
        units: 2,
        capper: 'TestCapper',
        timestamp: new Date('2025-01-15T12:00:00Z'),
        source: 'legacy',
      };

      const embed = DiscordTemplates.renderNewPick(context);

      expect(embed.data.title).toContain('NEW PICK');
      expect(embed.data.title).toContain('NBA');
      expect(embed.data.description).toContain('LeBron James');
      expect(embed.data.description).toContain('OVER 25.5');
      expect(embed.data.footer?.text).toContain('TestCapper');
      expect(embed.data.footer?.text).toContain('legacy pipeline');
    });

    it('should render pick with canonical entities', () => {
      const context: PickContext = {
        pickId: 'pick-456',
        tenantId: 'tenant-1',
        canonicalPlayerId: 'player-canonical-123',
        canonicalGameId: 'game-canonical-456',
        playerName: 'Stephen Curry',
        teamName: 'Golden State Warriors',
        opponentName: 'Los Angeles Lakers',
        sport: 'nba',
        statType: 'three_pointers',
        line: 4.5,
        pickSide: 'over',
        odds: '+105',
        units: 1,
        capper: 'SharpCapper',
        timestamp: new Date(),
        source: 'canonical',
      };

      const embed = DiscordTemplates.renderNewPick(context);

      expect(embed.data.description).toContain('Stephen Curry');
      expect(embed.data.description).toContain('Golden State Warriors');
      expect(embed.data.description).toContain('vs Los Angeles Lakers');
      expect(embed.data.footer?.text).toContain('canonical pipeline');
    });

    it('should render pick with CLV data', () => {
      const context: PickContext = {
        pickId: 'pick-789',
        tenantId: 'tenant-1',
        playerName: 'Patrick Mahomes',
        sport: 'nfl',
        statType: 'passing_yards',
        line: 275.5,
        pickSide: 'over',
        odds: '-115',
        units: 3,
        clvValue: 0.5,
        clvPercentage: 2.3,
        openingOdds: '-120',
        closingOdds: '-105',
        capper: 'ProCapper',
        timestamp: new Date(),
        source: 'professional',
      };

      const embed = DiscordTemplates.renderNewPick(context);

      // Find CLV field
      const clvField = embed.data.fields?.find(f => f.name.includes('CLV'));
      expect(clvField).toBeDefined();
      expect(clvField?.value).toContain('+0.50 units');
      expect(clvField?.value).toContain('+2.3%');
      expect(clvField?.value).toContain('-120 → -105');
    });

    it('should render pick with professional insights', () => {
      const context: PickContext = {
        pickId: 'pick-pro',
        tenantId: 'tenant-1',
        playerName: 'Giannis Antetokounmpo',
        sport: 'nba',
        statType: 'points',
        line: 30.5,
        pickSide: 'over',
        odds: '-110',
        units: 2,
        professionalScore: 85,
        steamDetected: true,
        lineShoppingEdge: 3.5,
        optimalTimingScore: 92,
        publicVsSharpSplit: '35% / 65%',
        capper: 'EliteCapper',
        timestamp: new Date(),
        source: 'professional',
      };

      const embed = DiscordTemplates.renderNewPick(context);

      // Find professional insights field
      const proField = embed.data.fields?.find(f => f.name.includes('Professional Insights'));
      expect(proField).toBeDefined();
      expect(proField?.value).toContain('🔥 **Steam Detected**');
      expect(proField?.value).toContain('🛒 **Line Shopping Edge:** 3.5%');
      expect(proField?.value).toContain('⏰ **Timing Score:** 92/100');
      expect(proField?.value).toContain('👥 **Public/Sharp:** 35% / 65%');
    });

    it('should render pick with tier and confidence', () => {
      const context: PickContext = {
        pickId: 'pick-tier',
        tenantId: 'tenant-1',
        playerName: 'Luka Doncic',
        sport: 'nba',
        statType: 'assists',
        line: 8.5,
        pickSide: 'over',
        odds: '-105',
        units: 3,
        tier: 'S-tier',
        confidence: 9,
        professionalScore: 95,
        capper: 'TopCapper',
        timestamp: new Date(),
        source: 'professional',
      };

      const embed = DiscordTemplates.renderNewPick(context);

      // Check color (S-tier should be red)
      expect(embed.data.color).toBe(0xff0000);

      // Find confidence field
      const confField = embed.data.fields?.find(f => f.name.includes('Confidence'));
      expect(confField).toBeDefined();
      expect(confField?.value).toContain('**Tier:** S-tier');
      expect(confField?.value).toContain('**Confidence:** 9/10');
      expect(confField?.value).toContain('**Pro Score:** 95.0/100');
    });
  });

  describe('renderGradedPick', () => {
    it('should render winning pick', () => {
      const context: GradedPickContext = {
        pickId: 'pick-win',
        tenantId: 'tenant-1',
        playerName: 'LeBron James',
        sport: 'nba',
        statType: 'points',
        line: 25.5,
        pickSide: 'over',
        odds: '-110',
        units: 2,
        result: 'win',
        actualValue: 32,
        margin: 6.5,
        capper: 'TestCapper',
        timestamp: new Date(),
        settledAt: new Date(),
        source: 'test',
      };

      const embed = DiscordTemplates.renderGradedPick(context);

      expect(embed.data.title).toContain('✅ GRADED');
      expect(embed.data.title).toContain('LeBron James OVER 25.5');
      expect(embed.data.color).toBe(0x00ff00); // Green

      const resultField = embed.data.fields?.find(f => f.name.includes('Result'));
      expect(resultField).toBeDefined();
      expect(resultField?.value).toContain('**Result:** WIN');
      expect(resultField?.value).toContain('**Actual:** 32');
      expect(resultField?.value).toContain('**Margin:** +6.5');
      expect(resultField?.value).toContain('**Units:** +2');
    });

    it('should render losing pick', () => {
      const context: GradedPickContext = {
        pickId: 'pick-loss',
        tenantId: 'tenant-1',
        playerName: 'Stephen Curry',
        sport: 'nba',
        statType: 'three_pointers',
        line: 4.5,
        pickSide: 'over',
        odds: '+105',
        units: 1,
        result: 'loss',
        actualValue: 3,
        margin: -1.5,
        capper: 'TestCapper',
        timestamp: new Date(),
        settledAt: new Date(),
        source: 'test',
      };

      const embed = DiscordTemplates.renderGradedPick(context);

      expect(embed.data.title).toContain('❌ GRADED');
      expect(embed.data.color).toBe(0xff0000); // Red

      const resultField = embed.data.fields?.find(f => f.name.includes('Result'));
      expect(resultField?.value).toContain('**Result:** LOSS');
      expect(resultField?.value).toContain('**Units:** -1');
    });

    it('should render push', () => {
      const context: GradedPickContext = {
        pickId: 'pick-push',
        tenantId: 'tenant-1',
        playerName: 'Patrick Mahomes',
        sport: 'nfl',
        statType: 'passing_yards',
        line: 275.5,
        pickSide: 'over',
        odds: '-115',
        units: 3,
        result: 'push',
        actualValue: 275.5,
        margin: 0,
        capper: 'TestCapper',
        timestamp: new Date(),
        settledAt: new Date(),
        source: 'test',
      };

      const embed = DiscordTemplates.renderGradedPick(context);

      expect(embed.data.title).toContain('➖ GRADED');
      expect(embed.data.color).toBe(0xffff00); // Yellow
    });

    it('should render graded pick with CLV performance', () => {
      const context: GradedPickContext = {
        pickId: 'pick-clv-win',
        tenantId: 'tenant-1',
        playerName: 'Giannis Antetokounmpo',
        sport: 'nba',
        statType: 'points',
        line: 30.5,
        pickSide: 'over',
        odds: '-110',
        units: 2,
        result: 'win',
        actualValue: 35,
        margin: 4.5,
        clvValue: 0.75,
        clvPercentage: 3.2,
        capper: 'ProCapper',
        timestamp: new Date(),
        settledAt: new Date(),
        source: 'professional',
      };

      const embed = DiscordTemplates.renderGradedPick(context);

      const clvField = embed.data.fields?.find(f => f.name.includes('CLV Performance'));
      expect(clvField).toBeDefined();
      expect(clvField?.value).toContain('✅ Positive CLV + Win');
      expect(clvField?.value).toContain('**CLV:** +0.75');
    });
  });

  describe('renderDailyRecap', () => {
    it('should render daily recap with performance data', () => {
      const topPicks: PickContext[] = [
        {
          pickId: 'pick-1',
          tenantId: 'tenant-1',
          playerName: 'LeBron James',
          sport: 'nba',
          statType: 'points',
          line: 25.5,
          pickSide: 'over',
          odds: '-110',
          units: 2,
          capper: 'Capper1',
          timestamp: new Date(),
          source: 'test',
        },
        {
          pickId: 'pick-2',
          tenantId: 'tenant-1',
          playerName: 'Stephen Curry',
          sport: 'nba',
          statType: 'three_pointers',
          line: 4.5,
          pickSide: 'over',
          odds: '+105',
          units: 1,
          capper: 'Capper2',
          timestamp: new Date(),
          source: 'test',
        },
      ];

      const context: RecapContext = {
        date: '2025-01-15',
        sport: 'nba',
        capper: 'TestCapper',
        totalPicks: 10,
        wins: 7,
        losses: 2,
        pushes: 1,
        winRate: 0.7,
        roi: 0.15,
        totalUnits: 5.5,
        avgCLV: 0.25,
        topPicks,
      };

      const embed = DiscordTemplates.renderDailyRecap(context);

      expect(embed.data.title).toContain('📊 Daily Recap - 2025-01-15');

      const perfField = embed.data.fields?.find(f => f.name.includes('Performance'));
      expect(perfField).toBeDefined();
      expect(perfField?.value).toContain('**Record:** 7-2-1');
      expect(perfField?.value).toContain('**Win Rate:** 70.0%');
      expect(perfField?.value).toContain('**Avg CLV:** +0.25');

      const unitsField = embed.data.fields?.find(f => f.name.includes('Units'));
      expect(unitsField).toBeDefined();
      expect(unitsField?.value).toContain('**Total Units:** +5.50');
      expect(unitsField?.value).toContain('**ROI:** 15.0%');

      const topPicksField = embed.data.fields?.find(f => f.name.includes('Top Picks'));
      expect(topPicksField).toBeDefined();
      expect(topPicksField?.value).toContain('LeBron James OVER 25.5 points');
      expect(topPicksField?.value).toContain('Stephen Curry OVER 4.5 three_pointers');
    });

    it('should handle recap with no top picks', () => {
      const context: RecapContext = {
        date: '2025-01-15',
        totalPicks: 5,
        wins: 3,
        losses: 2,
        pushes: 0,
        winRate: 0.6,
        roi: 0.08,
        totalUnits: 2.0,
        avgCLV: 0.1,
        topPicks: [],
      };

      const embed = DiscordTemplates.renderDailyRecap(context);

      expect(embed.data.title).toContain('Daily Recap');
      expect(embed.data.fields?.some(f => f.name.includes('Top Picks'))).toBe(false);
    });
  });

  describe('Color and Emoji Functions', () => {
    it('should return correct sport emojis', () => {
      const nbaContext: PickContext = {
        pickId: 'pick-1',
        tenantId: 'tenant-1',
        playerName: 'Test',
        sport: 'nba',
        statType: 'points',
        line: 20,
        pickSide: 'over',
        odds: '-110',
        units: 1,
        capper: 'Test',
        timestamp: new Date(),
        source: 'test',
      };

      const embed = DiscordTemplates.renderNewPick(nbaContext);
      expect(embed.data.title).toContain('🏀');
    });

    it('should return correct tier colors', () => {
      const tierContexts = [
        { tier: 'S-tier', expectedColor: 0xff0000 }, // Red
        { tier: 'A-tier', expectedColor: 0xff8c00 }, // Orange
        { tier: 'B-tier', expectedColor: 0xffd700 }, // Gold
        { tier: 'C-tier', expectedColor: 0x00ff00 }, // Green
        { tier: undefined, expectedColor: 0x5865f2 }, // Default blue
      ];

      tierContexts.forEach(({ tier, expectedColor }) => {
        const context: PickContext = {
          pickId: 'pick-1',
          tenantId: 'tenant-1',
          playerName: 'Test',
          sport: 'nba',
          statType: 'points',
          line: 20,
          pickSide: 'over',
          odds: '-110',
          units: 1,
          tier,
          capper: 'Test',
          timestamp: new Date(),
          source: 'test',
        };

        const embed = DiscordTemplates.renderNewPick(context);
        expect(embed.data.color).toBe(expectedColor);
      });
    });
  });
});

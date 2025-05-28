import { calculateEdgeScore } from '../edgeScoreEngine';
import { calculateContextScore } from '../contextual';
import { calculateRoleStability } from '../roleStability';
import { scorePick, processBatch } from '../scoring';
import { ConfigManager } from '../config';

// Mock data
const mockMarketData = {
  opening_odds: -110,
  current_odds: -108,
  odds_history: [
    { odds: -110, timestamp: new Date('2024-01-01') },
    { odds: -109, timestamp: new Date('2024-01-02') },
    { odds: -108, timestamp: new Date('2024-01-03') }
  ],
  sharp_money_pct: 0.65,
  public_money_pct: 0.45,
  steam_moves: 1,
  market_liquidity: 0.85
};

const mockContextData = {
  dvp_score: 0.85,
  matchup_history: [
    { result: 'over', margin: 5.5, date: new Date('2024-01-01') },
    { result: 'over', margin: 3.5, date: new Date('2024-01-02') }
  ],
  venue: {
    type: 'home',
    altitude: 0,
    indoor: true
  },
  rest_days: 2,
  injuries: []
};

const mockRoleData = {
  minutes_history: [32, 34, 31, 33, 35],
  usage_rates: [0.25, 0.27, 0.24, 0.26],
  lineup_data: {
    consistency: 0.85,
    recent_changes: []
  },
  injury_report: {
    status: 'healthy',
    impact: 0
  },
  role_changes: []
};

describe('Edge Score Engine', () => {
  it('should correctly score optimal market conditions', () => {
    const input = {
      odds: -110,
      league: 'NBA',
      stat_type: 'points',
      position: 'PG',
      market_data: mockMarketData
    };

    const result = calculateEdgeScore(input);
    
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.breakdown.odds_score).toBeGreaterThan(0.9);
    expect(result.breakdown.market_score).toBeGreaterThan(0.7);
    expect(result.breakdown.sharp_score).toBeGreaterThan(0.6);
  });

  it('should penalize poor market conditions', () => {
    const input = {
      odds: -150,
      league: 'NBA',
      stat_type: 'points',
      position: 'PG',
      market_data: {
        ...mockMarketData,
        sharp_money_pct: 0.35,
        steam_moves: 3
      }
    };

    const result = calculateEdgeScore(input);
    
    expect(result.score).toBeLessThan(0.5);
    expect(result.breakdown.market_score).toBeLessThan(0.4);
  });
});

describe('Contextual Analysis', () => {
  it('should highly score strong matchups', () => {
    const input = {
      dvp_score: 0.9,
      matchup_history: [
        { result: 'over', margin: 5.5, date: new Date('2024-01-01') },
        { result: 'over', margin: 4.5, date: new Date('2024-01-02') },
        { result: 'over', margin: 6.0, date: new Date('2024-01-03') }
      ],
      venue: {
        type: 'home',
        altitude: 0,
        indoor: true
      },
      rest_days: 2,
      injuries: []
    };

    const result = calculateContextScore(input, 'NBA');
    
    expect(result.score).toBeGreaterThan(0.85);
    expect(result.breakdown.dvp).toBeGreaterThan(0.85);
    expect(result.breakdown.matchup).toBeGreaterThan(0.8);
  });

  it('should penalize injury-impacted matchups', () => {
    const input = {
      ...mockContextData,
      injuries: [
        {
          player: 'Star Player',
          status: 'out',
          impact: 'high'
        }
      ]
    };

    const result = calculateContextScore(input, 'NBA');
    
    expect(result.score).toBeLessThan(0.6);
    expect(result.breakdown.injury).toBeLessThan(0.5);
  });
});

describe('Role Stability', () => {
  it('should highly score consistent roles', () => {
    const input = {
      minutes_history: [32, 33, 32, 34, 33],
      usage_rates: [0.25, 0.26, 0.25, 0.24],
      lineup_data: {
        consistency: 0.9,
        recent_changes: []
      },
      injury_report: {
        status: 'healthy',
        impact: 0
      },
      role_changes: []
    };

    const result = calculateRoleStability(input);
    
    expect(result.score).toBeGreaterThan(0.85);
    expect(result.breakdown.minutes).toBeGreaterThan(0.9);
    expect(result.breakdown.usage).toBeGreaterThan(0.8);
  });

  it('should penalize volatile roles', () => {
    const input = {
      minutes_history: [32, 25, 18, 34, 22],
      usage_rates: [0.25, 0.18, 0.15, 0.28],
      lineup_data: {
        consistency: 0.5,
        recent_changes: [
          { type: 'starter_change', date: new Date('2024-01-01') }
        ]
      },
      injury_report: {
        status: 'questionable',
        impact: 0.5
      },
      role_changes: [
        { type: 'bench', date: new Date('2024-01-01') }
      ]
    };

    const result = calculateRoleStability(input);
    
    expect(result.score).toBeLessThan(0.5);
    expect(result.breakdown.minutes).toBeLessThan(0.5);
    expect(result.breakdown.role_changes).toBeLessThan(0.4);
  });
});

describe('End-to-End Scoring', () => {
  it('should correctly identify S-tier picks', async () => {
    const pick = {
      id: '123',
      odds: -110,
      league: 'NBA',
      stat_type: 'points',
      position: 'PG',
      market_data: mockMarketData
    };

    const context = {
      ...mockContextData,
      role: mockRoleData
    };

    const result = await scorePick(pick, context);
    
    expect(result.tier).toBe('S');
    expect(result.scores.composite).toBeGreaterThan(8.5);
    expect(result.scores.confidence).toBeGreaterThan(0.85);
    expect(result.scores.ev).toBeGreaterThan(0.12);
  });

  it('should maintain consistent scoring across batches', async () => {
    const picks = Array(100).fill(null).map((_, i) => ({
      id: `pick_${i}`,
      odds: -110,
      league: 'NBA',
      stat_type: 'points',
      position: 'PG',
      market_data: mockMarketData
    }));

    const contexts = new Map(
      picks.map(p => [p.id, { ...mockContextData, role: mockRoleData }])
    );

    const batch1 = await processBatch(picks.slice(0, 50), contexts);
    const batch2 = await processBatch(picks.slice(50), contexts);

    const avgDiff = Math.abs(
      batch1.summary.averages.composite - batch2.summary.averages.composite
    );
    
    expect(avgDiff).toBeLessThan(0.1);
    expect(batch1.summary.tier_distribution).toMatchObject(
      batch2.summary.tier_distribution
    );
  });
});

describe('Configuration Management', () => {
  it('should load and apply new configurations', async () => {
    const config = await ConfigManager.getInstance().getConfig();
    
    expect(config.version).toBe('2.0.0');
    expect(config.tiers.S.min_composite).toBe(8.5);
    expect(config.sports.NBA.weights.dvp).toBe(0.35);
  });

  it('should handle configuration updates', async () => {
    const oldConfig = await ConfigManager.getInstance().getConfig();
    
    // Simulate config update
    await updateTestConfig({
      version: '2.0.1',
      tiers: {
        S: { min_composite: 8.7 }
      }
    });

    const newConfig = await ConfigManager.getInstance().getConfig();
    
    expect(newConfig.version).toBe('2.0.1');
    expect(newConfig.tiers.S.min_composite).toBe(8.7);
    expect(newConfig.tiers.S.min_composite).toBeGreaterThan(
      oldConfig.tiers.S.min_composite
    );
  });
}); 
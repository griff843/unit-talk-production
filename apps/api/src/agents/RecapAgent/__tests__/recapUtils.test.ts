/**
 * RecapUtils unit tests — SPRINT-DISCORD-RECAP-VERIFICATION
 *
 * Covers all pure utility functions used by RecapAgent for
 * formatting, calculation, and data validation.
 */
import { describe, it, expect } from 'vitest';

import {
  formatUnits,
  formatROI,
  formatWinRate,
  getStreakEmoji,
  getTierEmoji,
  getOutcomeEmoji,
  calculateHotStreakEmoji,
  formatOdds,
  calculateImpliedProbability,
  formatMarketType,
  getCapperDisplayName,
  calculateStreak,
  formatPickDescription,
  calculateParlayOdds,
  formatParlayOdds,
  calculateProfitDollars,
  getPerformanceColor,
  truncateText,
  groupPicksByParlay,
  calculateWinRate,
  calculateROI,
  getMedalEmoji,
  calculateAverageEdge,
  validatePickData,
  sortCappersByPerformance,
} from '../recapUtils';

// ── formatUnits ──────────────────────────────────────────────────────

describe('formatUnits', () => {
  it('positive units get + prefix', () => {
    expect(formatUnits(3.5)).toBe('+3.5');
  });
  it('negative units get - prefix', () => {
    expect(formatUnits(-2.3)).toBe('-2.3');
  });
  it('zero shows no sign', () => {
    expect(formatUnits(0)).toBe('0.0');
  });
  it('rounds to 1 decimal', () => {
    expect(formatUnits(1.456)).toBe('+1.5');
  });
});

// ── formatROI ────────────────────────────────────────────────────────

describe('formatROI', () => {
  it('positive ROI', () => {
    expect(formatROI(12.5)).toBe('+12.5%');
  });
  it('negative ROI', () => {
    expect(formatROI(-8.3)).toBe('-8.3%');
  });
  it('zero ROI', () => {
    expect(formatROI(0)).toBe('0.0%');
  });
});

// ── formatWinRate ────────────────────────────────────────────────────

describe('formatWinRate', () => {
  it('formats percentage with one decimal', () => {
    expect(formatWinRate(66.667)).toBe('66.7%');
  });
});

// ── getStreakEmoji ────────────────────────────────────────────────────

describe('getStreakEmoji', () => {
  it('5+ win streak → double fire', () => {
    expect(getStreakEmoji(5, 0)).toBe('🔥🔥');
  });
  it('3-4 win streak → fire', () => {
    expect(getStreakEmoji(3, 1)).toBe('🔥');
  });
  it('2 win streak → chart', () => {
    expect(getStreakEmoji(2, 0)).toBe('📈');
  });
  it('1 win → checkmark', () => {
    expect(getStreakEmoji(1, 0)).toBe('✅');
  });
  it('3+ loss streak → cold', () => {
    expect(getStreakEmoji(0, 3)).toBe('❄️');
  });
  it('1-2 loss streak → X', () => {
    expect(getStreakEmoji(0, 2)).toBe('❌');
  });
  it('even record → yellow', () => {
    expect(getStreakEmoji(2, 2)).toBe('🟡');
  });
});

// ── getTierEmoji ─────────────────────────────────────────────────────

describe('getTierEmoji', () => {
  it('S tier → diamond', () => expect(getTierEmoji('S')).toBe('💎'));
  it('A+ tier → fire', () => expect(getTierEmoji('A+')).toBe('🔥'));
  it('unknown tier → default', () => expect(getTierEmoji('X')).toBe('📊'));
});

// ── getOutcomeEmoji ──────────────────────────────────────────────────

describe('getOutcomeEmoji', () => {
  it('win → check', () => expect(getOutcomeEmoji('win')).toBe('✅'));
  it('loss → X', () => expect(getOutcomeEmoji('loss')).toBe('❌'));
  it('push → yellow', () => expect(getOutcomeEmoji('push')).toBe('🟡'));
  it('pending → hourglass', () => expect(getOutcomeEmoji('pending')).toBe('⏳'));
  it('undefined → question', () => expect(getOutcomeEmoji()).toBe('❓'));
});

// ── calculateHotStreakEmoji ──────────────────────────────────────────

describe('calculateHotStreakEmoji', () => {
  it('7+ → triple fire', () => expect(calculateHotStreakEmoji(7)).toBe('🔥🔥🔥'));
  it('5-6 → double fire', () => expect(calculateHotStreakEmoji(5)).toBe('🔥🔥'));
  it('3-4 → single fire', () => expect(calculateHotStreakEmoji(3)).toBe('🔥'));
  it('< 3 → empty', () => expect(calculateHotStreakEmoji(2)).toBe(''));
});

// ── formatOdds ───────────────────────────────────────────────────────

describe('formatOdds', () => {
  it('positive odds get + prefix', () => expect(formatOdds(150)).toBe('+150'));
  it('negative odds stay negative', () => expect(formatOdds(-110)).toBe('-110'));
  it('zero → "0"', () => expect(formatOdds(0)).toBe('0'));
});

// ── calculateImpliedProbability ──────────────────────────────────────

describe('calculateImpliedProbability', () => {
  it('+100 → 0.5 (50%)', () => {
    expect(calculateImpliedProbability(100)).toBeCloseTo(0.5, 4);
  });
  it('-100 → 0.5 (50%)', () => {
    expect(calculateImpliedProbability(-100)).toBeCloseTo(0.5, 4);
  });
  it('+200 → 0.333', () => {
    expect(calculateImpliedProbability(200)).toBeCloseTo(0.3333, 3);
  });
  it('-200 → 0.667', () => {
    expect(calculateImpliedProbability(-200)).toBeCloseTo(0.6667, 3);
  });
});

// ── formatMarketType ─────────────────────────────────────────────────

describe('formatMarketType', () => {
  it('maps known types', () => {
    expect(formatMarketType('points')).toBe('PTS');
    expect(formatMarketType('rebounds')).toBe('REB');
    expect(formatMarketType('moneyline')).toBe('ML');
    expect(formatMarketType('total')).toBe('O/U');
  });
  it('unknown type → uppercased', () => {
    expect(formatMarketType('strikeouts')).toBe('STRIKEOUTS');
  });
});

// ── calculateStreak ──────────────────────────────────────────────────

describe('calculateStreak', () => {
  it('empty array → none/0', () => {
    expect(calculateStreak([])).toEqual({ type: 'none', length: 0 });
  });
  it('all pushes → none/0', () => {
    expect(
      calculateStreak([
        { outcome: 'push', created_at: '2026-01-01' },
        { outcome: 'push', created_at: '2026-01-02' },
      ])
    ).toEqual({ type: 'none', length: 0 });
  });
  it('3 consecutive wins → win/3', () => {
    const picks = [
      { outcome: 'win', created_at: '2026-01-03' },
      { outcome: 'win', created_at: '2026-01-02' },
      { outcome: 'win', created_at: '2026-01-01' },
    ];
    expect(calculateStreak(picks)).toEqual({ type: 'win', length: 3 });
  });
  it('loss breaks win streak', () => {
    const picks = [
      { outcome: 'win', created_at: '2026-01-03' },
      { outcome: 'loss', created_at: '2026-01-02' },
      { outcome: 'win', created_at: '2026-01-01' },
    ];
    expect(calculateStreak(picks)).toEqual({ type: 'win', length: 1 });
  });
  it('ignores pending picks', () => {
    const picks = [
      { outcome: 'pending', created_at: '2026-01-04' },
      { outcome: 'loss', created_at: '2026-01-03' },
      { outcome: 'loss', created_at: '2026-01-02' },
    ];
    expect(calculateStreak(picks)).toEqual({ type: 'loss', length: 2 });
  });
});

// ── calculateParlayOdds ──────────────────────────────────────────────

describe('calculateParlayOdds', () => {
  it('single pick → same decimal odds', () => {
    // +100 → 2.0 decimal
    expect(calculateParlayOdds([{ odds: 100 }])).toBeCloseTo(2.0, 4);
  });
  it('two -110 picks → ~3.47', () => {
    // -110 → 1.909 decimal each; 1.909 * 1.909 ≈ 3.645
    const result = calculateParlayOdds([{ odds: -110 }, { odds: -110 }]);
    expect(result).toBeGreaterThan(3.5);
    expect(result).toBeLessThan(3.7);
  });
  it('empty array → 1 (no multiplier)', () => {
    expect(calculateParlayOdds([])).toBe(1);
  });
});

// ── formatParlayOdds ─────────────────────────────────────────────────

describe('formatParlayOdds', () => {
  it('odds >= 2.0 → positive American', () => {
    expect(formatParlayOdds(3.0)).toBe('+200');
  });
  it('odds < 2.0 → negative American', () => {
    expect(formatParlayOdds(1.5)).toBe('-200');
  });
});

// ── calculateProfitDollars ───────────────────────────────────────────

describe('calculateProfitDollars', () => {
  it('positive units → +$ format', () => {
    expect(calculateProfitDollars(2.5)).toBe('+$250');
  });
  it('negative units → -$ format', () => {
    expect(calculateProfitDollars(-1.5)).toBe('-$150');
  });
  it('custom unit value', () => {
    expect(calculateProfitDollars(1, 50)).toBe('+$50');
  });
});

// ── getPerformanceColor ──────────────────────────────────────────────

describe('getPerformanceColor', () => {
  it('big win (>5) → bright green', () => {
    expect(getPerformanceColor(6)).toBe(0x00ff00);
  });
  it('small win (0-5) → light green', () => {
    expect(getPerformanceColor(2)).toBe(0x90ee90);
  });
  it('break-even → yellow', () => {
    expect(getPerformanceColor(0)).toBe(0xffff00);
  });
  it('small loss → orange', () => {
    expect(getPerformanceColor(-3)).toBe(0xffa500);
  });
  it('big loss → red', () => {
    expect(getPerformanceColor(-6)).toBe(0xff0000);
  });
});

// ── truncateText ─────────────────────────────────────────────────────

describe('truncateText', () => {
  it('short text passes through', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });
  it('long text truncated with ...', () => {
    expect(truncateText('abcdefghij', 8)).toBe('abcde...');
  });
  it('default limit is 1024', () => {
    const longText = 'x'.repeat(2000);
    const result = truncateText(longText);
    expect(result.length).toBe(1024);
    expect(result.endsWith('...')).toBe(true);
  });
});

// ── groupPicksByParlay ───────────────────────────────────────────────

describe('groupPicksByParlay', () => {
  it('groups picks by parlay_id', () => {
    const picks = [
      { id: 1, parlay_id: 'A' },
      { id: 2, parlay_id: 'A' },
      { id: 3, parlay_id: 'B' },
      { id: 4 }, // no parlay
    ];
    const result = groupPicksByParlay(picks);
    expect(result.size).toBe(2);
    expect(result.get('A')!.length).toBe(2);
    expect(result.get('B')!.length).toBe(1);
  });
  it('empty array → empty map', () => {
    expect(groupPicksByParlay([]).size).toBe(0);
  });
});

// ── calculateWinRate ─────────────────────────────────────────────────

describe('calculateWinRate', () => {
  it('50% win rate', () => {
    expect(calculateWinRate(5, 5)).toBe(50);
  });
  it('100% win rate', () => {
    expect(calculateWinRate(10, 0)).toBe(100);
  });
  it('no decisive games → 0', () => {
    expect(calculateWinRate(0, 0)).toBe(0);
  });
});

// ── calculateROI ─────────────────────────────────────────────────────

describe('calculateROI', () => {
  it('positive ROI', () => {
    expect(calculateROI(5, 10)).toBe(50);
  });
  it('negative ROI', () => {
    expect(calculateROI(-3, 10)).toBe(-30);
  });
  it('zero total units → 0', () => {
    expect(calculateROI(5, 0)).toBe(0);
  });
});

// ── getMedalEmoji ────────────────────────────────────────────────────

describe('getMedalEmoji', () => {
  it('1st → gold', () => expect(getMedalEmoji(1)).toBe('🥇'));
  it('2nd → silver', () => expect(getMedalEmoji(2)).toBe('🥈'));
  it('3rd → bronze', () => expect(getMedalEmoji(3)).toBe('🥉'));
  it('4th+ → bullet', () => expect(getMedalEmoji(4)).toBe('•'));
});

// ── calculateAverageEdge ─────────────────────────────────────────────

describe('calculateAverageEdge', () => {
  it('averages edge_score values', () => {
    const picks = [{ edge_score: 10 }, { edge_score: 20 }, { edge_score: 30 }];
    expect(calculateAverageEdge(picks)).toBe(20);
  });
  it('ignores picks without edge_score', () => {
    const picks = [{ edge_score: 10 }, { name: 'no edge' }, { edge_score: 30 }];
    expect(calculateAverageEdge(picks)).toBe(20);
  });
  it('empty array → 0', () => {
    expect(calculateAverageEdge([])).toBe(0);
  });
});

// ── validatePickData ─────────────────────────────────────────────────

describe('validatePickData', () => {
  it('valid pick with player_name', () => {
    expect(
      validatePickData({ player_name: 'LeBron', market_type: 'points', line: 25.5, odds: -110 })
    ).toBe(true);
  });
  it('valid pick with team_name', () => {
    expect(
      validatePickData({ team_name: 'Lakers', market_type: 'moneyline', line: 0, odds: 150 })
    ).toBe(true);
  });
  it('missing name → false', () => {
    expect(validatePickData({ market_type: 'points', line: 25, odds: -110 })).toBe(false);
  });
  it('missing market_type → false', () => {
    expect(validatePickData({ player_name: 'LeBron', line: 25, odds: -110 })).toBe(false);
  });
  it('null → false', () => {
    expect(validatePickData(null)).toBe(false);
  });
});

// ── sortCappersByPerformance ─────────────────────────────────────────

describe('sortCappersByPerformance', () => {
  it('sorts by net units descending, then ROI, then win rate', () => {
    const cappers = [
      { name: 'C', netUnits: 5, roi: 10, winRate: 60 },
      { name: 'A', netUnits: 10, roi: 20, winRate: 70 },
      { name: 'B', netUnits: 10, roi: 20, winRate: 80 },
    ];
    const sorted = sortCappersByPerformance(cappers);
    expect(sorted[0].name).toBe('B'); // same netUnits + ROI, higher winRate
    expect(sorted[1].name).toBe('A');
    expect(sorted[2].name).toBe('C');
  });
});

// ── formatPickDescription ────────────────────────────────────────────

describe('formatPickDescription', () => {
  it('formats pick with player name', () => {
    const pick = { player_name: 'Jokic', market_type: 'points', line: 28.5, odds: -115 };
    expect(formatPickDescription(pick)).toBe('Jokic PTS 28.5 (-115)');
  });
  it('falls back to team_name', () => {
    const pick = { team_name: 'Nuggets', market_type: 'spread', line: -3.5, odds: -110 };
    expect(formatPickDescription(pick)).toBe('Nuggets Spread -3.5 (-110)');
  });
  it('unknown player/team → "Unknown"', () => {
    const pick = { market_type: 'total', line: 220.5, odds: -110 };
    expect(formatPickDescription(pick)).toBe('Unknown O/U 220.5 (-110)');
  });
});

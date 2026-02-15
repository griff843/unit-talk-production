/**
 * EXPOSURE-HARDENING-VERIFY-001: Phase E - Unit Tests for exposure-gate.ts
 *
 * Test coverage:
 * - E1.1: Daily exposure cap block
 * - E1.2: Same-game concentration block
 * - E1.3: Same-player concentration block
 * - E1.4: Sport concentration block
 * - E1.5: Single position exceeded
 * - E1.6: Override bypass + expiry behavior
 * - E1.7: Fail-closed behavior (service unavailable)
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  ExposureGate,
  EXPOSURE_LIMITS,
  createExposureGate,
  type ProposedPick,
  type ExposureCheckResult
} from '../lib/exposure-gate';

// ============================================================
// MOCK SUPABASE CLIENT
// ============================================================

interface MockQueryResult {
  data: any[] | null;
  error: { message: string } | null;
}

function createMockSupabase(mockPicks: any[] = [], shouldError = false) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          gte: (column: string, value: string) => ({
            is: (column: string, value: null) => {
              if (shouldError) {
                return Promise.resolve({ data: null, error: { message: 'Database connection failed' } });
              }
              return Promise.resolve({ data: mockPicks, error: null });
            }
          })
        })
      })
    })
  };
}

function createMockLogger() {
  const logs: { level: string; data: any; msg?: string }[] = [];
  return {
    logs,
    info: (data: any, msg?: string) => logs.push({ level: 'info', data, msg }),
    error: (data: any, msg?: string) => logs.push({ level: 'error', data, msg }),
    warn: (data: any, msg?: string) => logs.push({ level: 'warn', data, msg }),
  };
}

// ============================================================
// TEST SUITE
// ============================================================

describe('ExposureGate', () => {

  // --------------------------------------------------------
  // E1.1: Daily Exposure Cap Block
  // --------------------------------------------------------
  describe('E1.1: Daily Exposure Cap Block', () => {

    it('should APPROVE when daily exposure is under limit', async () => {
      // Current: 100 units = $10,000 (under $50k limit)
      // IMPORTANT: Spread across sports to avoid 40% concentration limit
      const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF'];
      const existingPicks = Array(20).fill(null).map((_, i) => ({
        id: `pick-${i}`,
        units: 5,
        odds: -110,
        sport: sports[i % sports.length], // Rotate sports to stay under 40% concentration
        game_id: `game-${i}`,
        player_name: `Player ${i}`,
      }));

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add to a sport that's already present but under concentration
      const proposedPicks: ProposedPick[] = [{
        units: 5,
        odds: -110,
        sport: 'NBA', // Will be 25 units / 105 total = ~23.8% (under 40%)
        game_id: 'game-new',
        player_name: 'New Player',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, true);
      assert.strictEqual(result.limitingFactor, null);
      assert.strictEqual(result.currentExposure.dailyDollars, 10000); // 100 units * $100
      assert.strictEqual(result.proposedExposure.dailyDollars, 10500); // 105 units * $100
    });

    it('should BLOCK when daily exposure would exceed $50,000 limit', async () => {
      // Current: 495 units = $49,500 (just under limit)
      const existingPicks = Array(99).fill(null).map((_, i) => ({
        id: `pick-${i}`,
        units: 5,
        odds: -110,
        sport: ['NBA', 'NFL', 'MLB'][i % 3], // Spread across sports to avoid concentration
        game_id: `game-${i}`,
        player_name: `Player ${i}`,
      }));

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Propose 10 units = $1,000, which would push to $50,500 (over limit)
      const proposedPicks: ProposedPick[] = [{
        units: 10,
        odds: -110,
        sport: 'NBA',
        game_id: 'game-new',
        player_name: 'New Player',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'daily_exposure_exceeded');
      assert.ok(result.reason.includes('$50,000'));
    });

  });

  // --------------------------------------------------------
  // E1.2: Same-Game Concentration Block
  // --------------------------------------------------------
  describe('E1.2: Same-Game Concentration Block', () => {

    it('should APPROVE when same-game positions are at limit (4)', async () => {
      const gameId = 'game-same';
      // Add other sports to avoid sport concentration limit
      const existingPicks = [
        // 3 NBA picks on same game
        { id: 'pick-0', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 0' },
        { id: 'pick-1', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 1' },
        { id: 'pick-2', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 2' },
        // Balance with other sports (7 units in other sports)
        { id: 'pick-3', units: 3, odds: -110, sport: 'NFL', game_id: 'game-nfl-1', player_name: 'NFL Player 1' },
        { id: 'pick-4', units: 4, odds: -110, sport: 'MLB', game_id: 'game-mlb-1', player_name: 'MLB Player 1' },
      ];
      // Current: 10 total units, 3 NBA = 30% (under 40%)

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add 4th NBA position (at limit, should pass)
      // Proposed: 11 total units, 4 NBA = 36% (still under 40%)
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: gameId,
        player_name: 'Player 3',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, true);
      assert.strictEqual(result.limitingFactor, null);
    });

    it('should BLOCK when same-game positions exceed 4', async () => {
      const gameId = 'game-same';
      // Add other sports to avoid sport concentration limit
      const existingPicks = [
        // 4 NBA picks on same game (at limit)
        { id: 'pick-0', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 0' },
        { id: 'pick-1', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 1' },
        { id: 'pick-2', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 2' },
        { id: 'pick-3', units: 1, odds: -110, sport: 'NBA', game_id: gameId, player_name: 'Player 3' },
        // Balance with other sports (8 units in other sports)
        { id: 'pick-4', units: 4, odds: -110, sport: 'NFL', game_id: 'game-nfl-1', player_name: 'NFL Player 1' },
        { id: 'pick-5', units: 4, odds: -110, sport: 'MLB', game_id: 'game-mlb-1', player_name: 'MLB Player 1' },
      ];
      // Current: 12 total units, 4 NBA = 33% (under 40%)

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add 5th position (over same-game limit)
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: gameId,
        player_name: 'Player 4',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'same_game_limit_exceeded');
      assert.ok(result.reason.includes('5 positions'));
      assert.ok(result.reason.includes('limit of 4'));
    });

  });

  // --------------------------------------------------------
  // E1.3: Same-Player Concentration Block
  // --------------------------------------------------------
  describe('E1.3: Same-Player Concentration Block', () => {

    it('should APPROVE when same-player positions are at limit (2)', async () => {
      const playerId = 'player-same';
      // Add other sports to avoid sport concentration limit
      const existingPicks = [
        // 1 NBA pick for same player
        { id: 'pick-1', units: 1, odds: -110, sport: 'NBA', game_id: 'game-1', player_id: playerId, player_name: 'Same Player' },
        // Balance with other sports
        { id: 'pick-2', units: 3, odds: -110, sport: 'NFL', game_id: 'game-nfl', player_name: 'NFL Player' },
        { id: 'pick-3', units: 3, odds: -110, sport: 'MLB', game_id: 'game-mlb', player_name: 'MLB Player' },
      ];
      // Current: 7 total units, 1 NBA = 14% (under 40%)

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add 2nd position for same player (at limit, should pass)
      // Proposed: 8 total units, 2 NBA = 25% (under 40%)
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'game-2',
        player_id: playerId,
        player_name: 'Same Player',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, true);
      assert.strictEqual(result.limitingFactor, null);
    });

    it('should BLOCK when same-player positions exceed 2', async () => {
      const playerId = 'player-same';
      // Add other sports to avoid sport concentration limit
      const existingPicks = [
        // 2 NBA picks for same player (at limit)
        { id: 'pick-0', units: 1, odds: -110, sport: 'NBA', game_id: 'game-0', player_id: playerId, player_name: 'Same Player' },
        { id: 'pick-1', units: 1, odds: -110, sport: 'NBA', game_id: 'game-1', player_id: playerId, player_name: 'Same Player' },
        // Balance with other sports
        { id: 'pick-2', units: 4, odds: -110, sport: 'NFL', game_id: 'game-nfl', player_name: 'NFL Player' },
        { id: 'pick-3', units: 4, odds: -110, sport: 'MLB', game_id: 'game-mlb', player_name: 'MLB Player' },
      ];
      // Current: 10 total units, 2 NBA = 20% (under 40%)

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add 3rd position (over player limit)
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'game-3',
        player_id: playerId,
        player_name: 'Same Player',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'same_player_limit_exceeded');
      assert.ok(result.reason.includes('3 positions'));
      assert.ok(result.reason.includes('limit of 2'));
    });

    it('should use player_name as fallback when player_id is missing', async () => {
      const playerName = 'LeBron James';
      // Add other sports to avoid sport concentration limit
      const existingPicks = [
        // 2 NBA picks for same player name (at limit)
        { id: 'pick-0', units: 1, odds: -110, sport: 'NBA', game_id: 'game-0', player_name: playerName },
        { id: 'pick-1', units: 1, odds: -110, sport: 'NBA', game_id: 'game-1', player_name: playerName },
        // Balance with other sports
        { id: 'pick-2', units: 4, odds: -110, sport: 'NFL', game_id: 'game-nfl', player_name: 'NFL Player' },
        { id: 'pick-3', units: 4, odds: -110, sport: 'MLB', game_id: 'game-mlb', player_name: 'MLB Player' },
      ];

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'game-3',
        player_name: playerName, // Same player name
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'same_player_limit_exceeded');
    });

  });

  // --------------------------------------------------------
  // E1.4: Sport Concentration Block
  // --------------------------------------------------------
  describe('E1.4: Sport Concentration Block', () => {

    it('should APPROVE when sport concentration is under 40%', async () => {
      // Current: 10 units total, 3 NBA = 30%
      const existingPicks = [
        { id: 'pick-1', units: 3, sport: 'NBA', game_id: 'g1', player_name: 'P1' },
        { id: 'pick-2', units: 3, sport: 'NFL', game_id: 'g2', player_name: 'P2' },
        { id: 'pick-3', units: 4, sport: 'MLB', game_id: 'g3', player_name: 'P3' },
      ];

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add 1 NBA unit: NBA would be 4/11 = 36.4% (under 40%)
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'g4',
        player_name: 'P4',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, true);
      assert.strictEqual(result.limitingFactor, null);
    });

    it('should BLOCK when sport concentration exceeds 40%', async () => {
      // Current: 10 units total, 4 NBA = 40%
      const existingPicks = [
        { id: 'pick-1', units: 4, sport: 'NBA', game_id: 'g1', player_name: 'P1' },
        { id: 'pick-2', units: 3, sport: 'NFL', game_id: 'g2', player_name: 'P2' },
        { id: 'pick-3', units: 3, sport: 'MLB', game_id: 'g3', player_name: 'P3' },
      ];

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add 2 NBA units: NBA would be 6/12 = 50% (over 40%)
      const proposedPicks: ProposedPick[] = [{
        units: 2,
        odds: -110,
        sport: 'NBA',
        game_id: 'g4',
        player_name: 'P4',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'sport_concentration_exceeded');
      assert.ok(result.reason.includes('NBA'));
      assert.ok(result.reason.includes('40%'));
    });

  });

  // --------------------------------------------------------
  // E1.5: Single Position Size Block
  // --------------------------------------------------------
  describe('E1.5: Single Position Size Block', () => {

    it('should APPROVE when single position is under 25% of daily budget', async () => {
      // Create balanced portfolio to avoid concentration limits
      const existingPicks = [
        { id: 'pick-1', units: 10, odds: -110, sport: 'NFL', game_id: 'g1', player_name: 'NFL Player 1' },
        { id: 'pick-2', units: 10, odds: -110, sport: 'MLB', game_id: 'g2', player_name: 'MLB Player 1' },
        { id: 'pick-3', units: 10, odds: -110, sport: 'NHL', game_id: 'g3', player_name: 'NHL Player 1' },
      ];
      // Current: 30 units spread across 3 sports

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Add NBA pick - 10 units is under 25% of daily budget (125 units)
      // Portfolio: 40 units total, NBA = 25% (at limit for concentration, under for position)
      const proposedPicks: ProposedPick[] = [{
        units: 10, // Under 125 units (25% of 500 unit budget)
        odds: -110,
        sport: 'NBA',
        game_id: 'g4',
        player_name: 'NBA Player 1',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, true);
      assert.strictEqual(result.limitingFactor, null);
    });

    it('should BLOCK when single position exceeds MAX_UNITS (10)', async () => {
      const supabase = createMockSupabase([]);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Note: This hits the MAX_UNITS limit first (10) before single_position check
      const proposedPicks: ProposedPick[] = [{
        units: 15, // Over MAX_UNITS
        odds: -110,
        sport: 'NBA',
        game_id: 'g1',
        player_name: 'P1',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'var_limit_exceeded');
    });

  });

  // --------------------------------------------------------
  // E1.6: Override Bypass + Expiry Behavior
  // --------------------------------------------------------
  describe('E1.6: Override Bypass + Expiry Behavior', () => {

    it('should allow temporarily overriding limits', async () => {
      // Create portfolio that hits same-game limit but stays under sport concentration
      const existingPicks = [
        // 4 NBA picks on same game (at limit)
        { id: 'pick-0', units: 1, odds: -110, sport: 'NBA', game_id: 'game-same', player_name: 'Player 0' },
        { id: 'pick-1', units: 1, odds: -110, sport: 'NBA', game_id: 'game-same', player_name: 'Player 1' },
        { id: 'pick-2', units: 1, odds: -110, sport: 'NBA', game_id: 'game-same', player_name: 'Player 2' },
        { id: 'pick-3', units: 1, odds: -110, sport: 'NBA', game_id: 'game-same', player_name: 'Player 3' },
        // Balance with other sports (8 units in other sports)
        { id: 'pick-4', units: 4, odds: -110, sport: 'NFL', game_id: 'game-nfl', player_name: 'NFL Player' },
        { id: 'pick-5', units: 4, odds: -110, sport: 'MLB', game_id: 'game-mlb', player_name: 'MLB Player' },
      ];
      // Current: 12 total units, 4 NBA = 33% (under 40%)

      const supabase = createMockSupabase(existingPicks);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      // Without override: should be blocked (5th position on same game)
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'game-same',
        player_name: 'Player 4',
      }];

      const resultBefore = await gate.checkExposure('capper-123', proposedPicks);
      assert.strictEqual(resultBefore.approved, false);
      assert.strictEqual(resultBefore.limitingFactor, 'same_game_limit_exceeded');

      // Apply override to increase same-game limit
      const override = gate.withOverride(
        { MAX_SAME_GAME_POSITIONS: 10 },
        {
          operatorId: 'operator-1',
          reason: 'Special event coverage',
          maxDurationMinutes: 1
        }
      );

      // With override: should pass
      const resultDuring = await gate.checkExposure('capper-123', proposedPicks);
      assert.strictEqual(resultDuring.approved, true);
      assert.strictEqual(resultDuring.limitingFactor, null);

      // Restore limits
      override.restore();

      // After restore: should be blocked again
      const resultAfter = await gate.checkExposure('capper-123', proposedPicks);
      assert.strictEqual(resultAfter.approved, false);
      assert.strictEqual(resultAfter.limitingFactor, 'same_game_limit_exceeded');
    });

    it('should log EXPOSURE_OVERRIDE_APPLIED event', async () => {
      const supabase = createMockSupabase([]);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const override = gate.withOverride(
        { DAILY_EXPOSURE_DOLLARS: 100000 },
        {
          operatorId: 'operator-1',
          reason: 'High-volume event',
          maxDurationMinutes: 30
        }
      );

      const applyEvent = logger.logs.find(
        log => log.data?.event === 'EXPOSURE_OVERRIDE_APPLIED'
      );

      assert.ok(applyEvent, 'EXPOSURE_OVERRIDE_APPLIED event should be logged');
      assert.strictEqual(applyEvent!.data.operatorId, 'operator-1');
      assert.strictEqual(applyEvent!.data.reason, 'High-volume event');
      assert.strictEqual(applyEvent!.data.maxDurationMinutes, 30);

      override.restore();
    });

    it('should log EXPOSURE_OVERRIDE_MANUAL_RESTORED event on restore', async () => {
      const supabase = createMockSupabase([]);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const override = gate.withOverride(
        { DAILY_EXPOSURE_DOLLARS: 100000 },
        { operatorId: 'operator-1', reason: 'Test' }
      );

      override.restore();

      const restoreEvent = logger.logs.find(
        log => log.data?.event === 'EXPOSURE_OVERRIDE_MANUAL_RESTORED'
      );

      assert.ok(restoreEvent, 'EXPOSURE_OVERRIDE_MANUAL_RESTORED event should be logged');
      assert.strictEqual(restoreEvent!.data.operatorId, 'operator-1');
    });

    it('should return expiresAt timestamp for time-boxing', async () => {
      const supabase = createMockSupabase([]);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const now = Date.now();
      const override = gate.withOverride(
        { DAILY_EXPOSURE_DOLLARS: 100000 },
        { operatorId: 'operator-1', reason: 'Test', maxDurationMinutes: 60 }
      );

      // expiresAt should be ~60 minutes from now
      const expectedExpiry = now + 60 * 60 * 1000;
      const actualExpiry = override.expiresAt.getTime();

      // Allow 1 second tolerance
      assert.ok(
        Math.abs(actualExpiry - expectedExpiry) < 1000,
        `expiresAt should be ~60 minutes from now`
      );

      override.restore();
    });

    it('should track hasActiveOverride correctly', async () => {
      const supabase = createMockSupabase([]);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      assert.strictEqual(gate.hasActiveOverride(), false);

      const override = gate.withOverride(
        { DAILY_EXPOSURE_DOLLARS: 100000 },
        { operatorId: 'operator-1', reason: 'Test' }
      );

      assert.strictEqual(gate.hasActiveOverride(), true);

      override.restore();

      assert.strictEqual(gate.hasActiveOverride(), false);
    });

  });

  // --------------------------------------------------------
  // E1.7: Fail-Closed Behavior (Service Unavailable)
  // --------------------------------------------------------
  describe('E1.7: Fail-Closed Behavior (Service Unavailable)', () => {

    it('should BLOCK with service_unavailable when database query fails', async () => {
      const supabase = createMockSupabase([], true); // shouldError = true
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'g1',
        player_name: 'P1',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.approved, false);
      assert.strictEqual(result.limitingFactor, 'service_unavailable');
      assert.ok(result.reason.includes('fail-closed'));
    });

    it('should log error on service unavailable', async () => {
      const supabase = createMockSupabase([], true);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'g1',
        player_name: 'P1',
      }];

      await gate.checkExposure('capper-123', proposedPicks);

      const errorLog = logger.logs.find(log => log.level === 'error');
      assert.ok(errorLog, 'Error should be logged');
      assert.ok(errorLog!.msg?.includes('EXPOSURE-GATE'));
    });

    it('should return empty snapshot on error', async () => {
      const supabase = createMockSupabase([], true);
      const logger = createMockLogger();
      const gate = new ExposureGate(supabase as any, logger);

      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NBA',
        game_id: 'g1',
        player_name: 'P1',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);

      assert.strictEqual(result.currentExposure.dailyUnits, 0);
      assert.strictEqual(result.currentExposure.dailyDollars, 0);
      assert.strictEqual(result.currentExposure.pickCount, 0);
    });

  });

  // --------------------------------------------------------
  // E1.8: Factory Function
  // --------------------------------------------------------
  describe('E1.8: Factory Function', () => {

    it('should create ExposureGate instance via factory', async () => {
      const supabase = createMockSupabase([]);
      const gate = createExposureGate(supabase as any);

      assert.ok(gate instanceof ExposureGate);
    });

    it('should use console as default logger', async () => {
      // Create balanced portfolio to avoid concentration limits
      const existingPicks = [
        { id: 'pick-1', units: 3, odds: -110, sport: 'NBA', game_id: 'g1', player_name: 'NBA Player' },
        { id: 'pick-2', units: 3, odds: -110, sport: 'NFL', game_id: 'g2', player_name: 'NFL Player' },
        { id: 'pick-3', units: 3, odds: -110, sport: 'MLB', game_id: 'g3', player_name: 'MLB Player' },
      ];
      // Current: 9 units, NBA = 33%

      const supabase = createMockSupabase(existingPicks);
      const gate = createExposureGate(supabase as any);

      // Add to NHL (new sport) to stay under concentration
      const proposedPicks: ProposedPick[] = [{
        units: 1,
        odds: -110,
        sport: 'NHL', // New sport, will be 10% of portfolio
        game_id: 'g4',
        player_name: 'NHL Player',
      }];

      const result = await gate.checkExposure('capper-123', proposedPicks);
      assert.strictEqual(result.approved, true);
    });

  });

  // --------------------------------------------------------
  // E1.9: Limit Constants Validation
  // --------------------------------------------------------
  describe('E1.9: Limit Constants Validation', () => {

    it('should export EXPOSURE_LIMITS with correct values', () => {
      assert.strictEqual(EXPOSURE_LIMITS.MIN_UNITS, 0.5);
      assert.strictEqual(EXPOSURE_LIMITS.MAX_UNITS, 10);
      assert.strictEqual(EXPOSURE_LIMITS.MAX_SAME_GAME_POSITIONS, 4);
      assert.strictEqual(EXPOSURE_LIMITS.MAX_SAME_PLAYER_POSITIONS, 2);
      assert.strictEqual(EXPOSURE_LIMITS.DAILY_EXPOSURE_DOLLARS, 50000);
      assert.strictEqual(EXPOSURE_LIMITS.HIGH_CONCENTRATION_THRESHOLD, 0.40);
      assert.strictEqual(EXPOSURE_LIMITS.MAX_SINGLE_POSITION, 0.25);
    });

    it('should return current limits via getCurrentLimits', () => {
      const supabase = createMockSupabase([]);
      const gate = new ExposureGate(supabase as any);

      const limits = gate.getCurrentLimits();

      assert.strictEqual(limits.DAILY_EXPOSURE_DOLLARS, 50000);
      assert.strictEqual(limits.MAX_SAME_GAME_POSITIONS, 4);
    });

  });

});

// ============================================================
// RUN TESTS
// ============================================================
console.log('='.repeat(60));
console.log('EXPOSURE-HARDENING-VERIFY-001: Phase E - Unit Tests');
console.log('='.repeat(60));
console.log('Running exposure-gate.ts unit tests...\n');

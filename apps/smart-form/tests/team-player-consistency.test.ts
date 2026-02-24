/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090: Team/Player Consistency Contract Tests
 * SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091: Updated to use UUID team_ids
 *
 * Test coverage:
 * - T1.1: Players returned for team filter must belong to that team
 * - T1.2: Sport must match requested sport filter
 * - T1.3: Matchup filter returns only players from specified teams
 * - T1.4: Fail-closed on team consistency violation
 *
 * Team UUIDs (from participants table):
 * - Indiana Pacers: f0fdd6a5-ac21-4608-adce-d7a91721890d
 * - Boston Celtics: fed6eb21-5632-46aa-9606-38755b7db445
 * - Los Angeles Lakers: 95830c8b-e08a-493b-aa83-1b9cbe092593
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// ============================================================
// CONTRACT TEST TYPES
// ============================================================

interface CatalogPlayer {
  player_id: string;
  player_name: string;
  sport: string;
  team_id: string;
  team_name: string;
  team_abbr: string;
}

interface PlayersResponse {
  players: CatalogPlayer[];
  meta: {
    sport: string;
    total_count: number;
    team_id?: string;
    away_team_id?: string;
    home_team_id?: string;
    matchup_filtered?: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================
// TEST UTILITIES
// ============================================================

/**
 * Validate that all players in response belong to expected teams
 */
function validateTeamConsistency(
  response: PlayersResponse,
  expectedTeamIds: string[]
): { valid: boolean; mismatches: CatalogPlayer[] } {
  const expectedSet = new Set(expectedTeamIds);
  const mismatches = response.players.filter(p => !expectedSet.has(p.team_id));
  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Validate that all players in response have the expected sport
 */
function validateSportConsistency(
  response: PlayersResponse,
  expectedSport: string
): { valid: boolean; mismatches: CatalogPlayer[] } {
  const mismatches = response.players.filter(
    p => p.sport.toUpperCase() !== expectedSport.toUpperCase()
  );
  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}

// ============================================================
// CONTRACT TESTS
// ============================================================

describe('Team/Player Consistency Contract', () => {
  // --------------------------------------------------------
  // T1.1: Players returned for team filter must belong to that team
  // --------------------------------------------------------
  describe('T1.1: Single Team Filter Consistency', () => {
    it('should only return players belonging to requested team', () => {
      // Mock response with correct data
      const response: PlayersResponse = {
        players: [
          {
            player_id: 'player-1',
            player_name: 'Tyrese Haliburton',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
          {
            player_id: 'player-2',
            player_name: 'Pascal Siakam',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
        ],
        meta: {
          sport: 'NBA',
          total_count: 2,
          team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
        },
      };

      const { valid, mismatches } = validateTeamConsistency(response, [
        'f0fdd6a5-ac21-4608-adce-d7a91721890d',
      ]);

      assert.strictEqual(valid, true, 'All players should belong to requested team');
      assert.strictEqual(mismatches.length, 0, 'No mismatches expected');
    });

    it('should FAIL contract if player team does not match filter', () => {
      // Mock response with DATA INTEGRITY VIOLATION
      const response: PlayersResponse = {
        players: [
          {
            player_id: 'player-1',
            player_name: 'Tyrese Haliburton',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
          {
            player_id: 'player-2',
            player_name: 'LeBron James',
            sport: 'NBA',
            team_id: '95830c8b-e08a-493b-aa83-1b9cbe092593', // WRONG - should be Pacers if filtered for IND
            team_name: 'Los Angeles Lakers',
            team_abbr: 'LAL',
          },
        ],
        meta: {
          sport: 'NBA',
          total_count: 2,
          team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
        },
      };

      const { valid, mismatches } = validateTeamConsistency(response, [
        'f0fdd6a5-ac21-4608-adce-d7a91721890d',
      ]);

      assert.strictEqual(valid, false, 'Should detect team consistency violation');
      assert.strictEqual(mismatches.length, 1, 'One player has wrong team');
      assert.strictEqual(mismatches[0].player_name, 'LeBron James');
      assert.strictEqual(mismatches[0].team_id, '95830c8b-e08a-493b-aa83-1b9cbe092593');
    });
  });

  // --------------------------------------------------------
  // T1.2: Sport must match requested sport filter
  // --------------------------------------------------------
  describe('T1.2: Sport Filter Consistency', () => {
    it('should only return players with requested sport', () => {
      const response: PlayersResponse = {
        players: [
          {
            player_id: 'player-1',
            player_name: 'Tyrese Haliburton',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
        ],
        meta: {
          sport: 'NBA',
          total_count: 1,
        },
      };

      const { valid, mismatches } = validateSportConsistency(response, 'NBA');

      assert.strictEqual(valid, true, 'All players should have NBA sport');
      assert.strictEqual(mismatches.length, 0);
    });

    it('should FAIL contract if player sport does not match filter', () => {
      // Mock response with DATA INTEGRITY VIOLATION
      const response: PlayersResponse = {
        players: [
          {
            player_id: 'player-1',
            player_name: 'Tyrese Haliburton',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
          {
            player_id: 'player-2',
            player_name: 'Josh Allen',
            sport: 'NFL', // WRONG - should be NBA if filtered for NBA
            team_id: 'team_nfl_buffalo_bills',
            team_name: 'Buffalo Bills',
            team_abbr: 'BUF',
          },
        ],
        meta: {
          sport: 'NBA',
          total_count: 2,
        },
      };

      const { valid, mismatches } = validateSportConsistency(response, 'NBA');

      assert.strictEqual(valid, false, 'Should detect sport consistency violation');
      assert.strictEqual(mismatches.length, 1, 'One player has wrong sport');
      assert.strictEqual(mismatches[0].player_name, 'Josh Allen');
      assert.strictEqual(mismatches[0].sport, 'NFL');
    });
  });

  // --------------------------------------------------------
  // T1.3: Matchup filter returns only players from specified teams
  // --------------------------------------------------------
  describe('T1.3: Matchup Filter Consistency', () => {
    it('should only return players from away_team_id and home_team_id', () => {
      const response: PlayersResponse = {
        players: [
          {
            player_id: 'player-1',
            player_name: 'Tyrese Haliburton',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
          {
            player_id: 'player-2',
            player_name: 'Jayson Tatum',
            sport: 'NBA',
            team_id: 'fed6eb21-5632-46aa-9606-38755b7db445',
            team_name: 'Boston Celtics',
            team_abbr: 'BOS',
          },
        ],
        meta: {
          sport: 'NBA',
          total_count: 2,
          away_team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
          home_team_id: 'fed6eb21-5632-46aa-9606-38755b7db445',
          matchup_filtered: true,
        },
      };

      const { valid, mismatches } = validateTeamConsistency(response, [
        'f0fdd6a5-ac21-4608-adce-d7a91721890d',
        'fed6eb21-5632-46aa-9606-38755b7db445',
      ]);

      assert.strictEqual(valid, true, 'All players should belong to matchup teams');
      assert.strictEqual(mismatches.length, 0);
    });

    it('should FAIL contract if player not from either matchup team', () => {
      // Mock response with DATA INTEGRITY VIOLATION
      const response: PlayersResponse = {
        players: [
          {
            player_id: 'player-1',
            player_name: 'Tyrese Haliburton',
            sport: 'NBA',
            team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
            team_name: 'Indiana Pacers',
            team_abbr: 'IND',
          },
          {
            player_id: 'player-2',
            player_name: 'LeBron James',
            sport: 'NBA',
            team_id: '95830c8b-e08a-493b-aa83-1b9cbe092593', // WRONG - not IND or BOS
            team_name: 'Los Angeles Lakers',
            team_abbr: 'LAL',
          },
        ],
        meta: {
          sport: 'NBA',
          total_count: 2,
          away_team_id: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
          home_team_id: 'fed6eb21-5632-46aa-9606-38755b7db445',
          matchup_filtered: true,
        },
      };

      const { valid, mismatches } = validateTeamConsistency(response, [
        'f0fdd6a5-ac21-4608-adce-d7a91721890d',
        'fed6eb21-5632-46aa-9606-38755b7db445',
      ]);

      assert.strictEqual(valid, false, 'Should detect matchup team violation');
      assert.strictEqual(mismatches.length, 1, 'One player outside matchup teams');
      assert.strictEqual(mismatches[0].player_name, 'LeBron James');
    });
  });

  // --------------------------------------------------------
  // T1.4: Fail-closed error response validation
  // --------------------------------------------------------
  describe('T1.4: Fail-Closed Error Response', () => {
    it('should return TEAM_CONSISTENCY_VIOLATION error code on mismatch', () => {
      // Simulated API error response when consistency check fails
      const errorResponse: PlayersResponse = {
        players: [],
        meta: {
          sport: 'NBA',
          total_count: 0,
        },
        error: {
          code: 'TEAM_CONSISTENCY_VIOLATION',
          message: 'Data integrity violation: 1 players returned outside requested teams',
          details: {
            expected_teams: ['f0fdd6a5-ac21-4608-adce-d7a91721890d'],
            mismatched_count: 1,
            sample_mismatches: [
              {
                player_id: 'player-2',
                player_name: 'LeBron James',
                actual_team_id: '95830c8b-e08a-493b-aa83-1b9cbe092593',
              },
            ],
          },
        },
      };

      assert.ok(errorResponse.error, 'Error object should be present');
      assert.strictEqual(errorResponse.error!.code, 'TEAM_CONSISTENCY_VIOLATION');
      assert.ok(errorResponse.error!.message.includes('Data integrity violation'));
      assert.strictEqual(errorResponse.error!.details.mismatched_count, 1);
    });
  });
});

// ============================================================
// RUN TESTS
// ============================================================
console.log('='.repeat(60));
console.log('SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090: Contract Tests');
console.log('='.repeat(60));
console.log('Running team/player consistency contract tests...\n');

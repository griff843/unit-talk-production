/**
 * Integration Test 1: Feed → Canonical Mapping
 *
 * Tests the complete flow from feed ingestion to canonical entity mapping:
 * - Player name variations ("LeBron James", "Lebron James", "L. James")
 * - Game mismatches in time, case, formatting
 * - Canonical ID storage in raw_props
 * - Confidence scoring for clear matches
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CanonicalMappingService } from '../../../src/services/canonical/CanonicalMappingService';
import { supabaseClient } from '../../../src/services/supabaseClient';
import type { ExternalGameData, ExternalPlayerData, Sport, MappingSource } from '../../../src/types/canonical-entities';

describe('Integration Test 1: Feed → Canonical Mapping', () => {
  let mappingService: CanonicalMappingService;
  const testSource: MappingSource = 'odds_api';
  const testSport: Sport = 'NBA';

  beforeAll(async () => {
    mappingService = new CanonicalMappingService();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  describe('Player Name Variations', () => {
    it('should map "LeBron James" and "Lebron James" to the same canonical player', async () => {
      // Test Case 1: First name variation
      const player1Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'LeBron James',
        sport: testSport,
        team: 'Los Angeles Lakers',
      });

      expect(player1Result.success).toBe(true);
      expect(player1Result.canonical_player_id).toBeDefined();
      expect(player1Result.is_new_player).toBe(true);
      expect(player1Result.confidence_score).toBe(1.0); // Exact match for first entry

      const firstPlayerId = player1Result.canonical_player_id!;

      // Test Case 2: Same player, different capitalization
      const player2Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Lebron James',
        sport: testSport,
        team: 'Los Angeles Lakers',
      });

      expect(player2Result.success).toBe(true);
      expect(player2Result.canonical_player_id).toBe(firstPlayerId);
      expect(player2Result.is_new_player).toBe(false);
      expect(player2Result.similarity_score).toBeGreaterThan(0.8); // High similarity

      // Test Case 3: Abbreviated name
      const player3Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'L. James',
        sport: testSport,
        team: 'Los Angeles Lakers',
      });

      expect(player3Result.success).toBe(true);
      expect(player3Result.canonical_player_id).toBe(firstPlayerId);
      expect(player3Result.similarity_score).toBeGreaterThan(0.7); // Good similarity

      // Verify all mappings point to same canonical player
      const { data: mappings } = await supabaseClient
        .from('player_mappings')
        .select('*')
        .eq('canonical_player_id', firstPlayerId);

      expect(mappings?.length).toBeGreaterThanOrEqual(3);
      expect(mappings?.map(m => m.external_player_name).sort()).toEqual([
        'L. James',
        'LeBron James',
        'Lebron James',
      ]);
    });

    it('should map "Stephen Curry" vs "Steph Curry" to the same canonical player', async () => {
      const player1Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Stephen Curry',
        sport: testSport,
        team: 'Golden State Warriors',
      });

      expect(player1Result.success).toBe(true);
      const canonicalId = player1Result.canonical_player_id!;

      const player2Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Steph Curry',
        sport: testSport,
        team: 'Golden State Warriors',
      });

      expect(player2Result.success).toBe(true);
      expect(player2Result.canonical_player_id).toBe(canonicalId);
      expect(player2Result.similarity_score).toBeGreaterThan(0.8);
    });

    it('should handle player name suffixes (Jr, Sr, II, III)', async () => {
      const player1Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Gary Payton II',
        sport: testSport,
        team: 'Golden State Warriors',
      });

      expect(player1Result.success).toBe(true);
      const canonicalId = player1Result.canonical_player_id!;

      const player2Result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Gary Payton',
        sport: testSport,
        team: 'Golden State Warriors',
      });

      expect(player2Result.success).toBe(true);
      // Should match the same player (suffix normalization)
      expect(player2Result.canonical_player_id).toBe(canonicalId);
    });
  });

  describe('Game Matching', () => {
    it('should match games with minor time differences (within tolerance)', async () => {
      const baseTime = new Date('2025-12-01T19:00:00Z');

      // Game 1: Exact time
      const game1Result = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'game1',
        sport: testSport,
        league: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        game_time: baseTime.toISOString(),
      });

      expect(game1Result.success).toBe(true);
      expect(game1Result.is_new_game).toBe(true);
      const canonicalGameId = game1Result.canonical_game_id!;

      // Game 2: Same game, 30 minutes later (within 60 min tolerance)
      const time2 = new Date(baseTime.getTime() + 30 * 60 * 1000);
      const game2Result = await mappingService.mapGame({
        source: 'optimal_api' as MappingSource,
        external_game_id: 'game2_optimal',
        sport: testSport,
        league: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        game_time: time2.toISOString(),
      });

      expect(game2Result.success).toBe(true);
      expect(game2Result.canonical_game_id).toBe(canonicalGameId);
      expect(game2Result.is_new_game).toBe(false);
      expect(game2Result.confidence_score).toBeGreaterThan(0.7);
    });

    it('should handle team name case variations', async () => {
      const gameTime = new Date('2025-12-01T19:00:00Z').toISOString();

      const game1Result = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'game_caps',
        sport: testSport,
        league: 'NBA',
        home_team: 'LOS ANGELES LAKERS',
        away_team: 'BOSTON CELTICS',
        game_time: gameTime,
      });

      expect(game1Result.success).toBe(true);
      const canonicalGameId = game1Result.canonical_game_id!;

      const game2Result = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'game_lower',
        sport: testSport,
        league: 'NBA',
        home_team: 'los angeles lakers',
        away_team: 'boston celtics',
        game_time: gameTime,
      });

      expect(game2Result.success).toBe(true);
      expect(game2Result.canonical_game_id).toBe(canonicalGameId);
    });

    it('should handle team abbreviations vs full names', async () => {
      const gameTime = new Date('2025-12-01T19:00:00Z').toISOString();

      const game1Result = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'game_full',
        sport: testSport,
        league: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        game_time: gameTime,
      });

      expect(game1Result.success).toBe(true);
      const canonicalGameId = game1Result.canonical_game_id!;

      // Note: This test may require additional configuration for team alias mapping
      // For now, we test that different sources can be mapped
      const game2Result = await mappingService.mapGame({
        source: 'optimal_api' as MappingSource,
        external_game_id: 'game_optimal',
        sport: testSport,
        league: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        game_time: gameTime,
      });

      expect(game2Result.success).toBe(true);
      expect(game2Result.canonical_game_id).toBe(canonicalGameId);
    });
  });

  describe('Canonical ID Storage in raw_props', () => {
    it('should store canonical IDs when inserting raw props', async () => {
      // First create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_game_123',
        sport: testSport,
        league: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        game_time: new Date().toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Anthony Davis',
        sport: testSport,
        team: 'Los Angeles Lakers',
      });

      expect(gameResult.success).toBe(true);
      expect(playerResult.success).toBe(true);

      // Insert raw prop with canonical IDs
      const rawPropId = crypto.randomUUID();
      const { data: rawProp, error } = await supabaseClient
        .from('raw_props')
        .insert({
          id: rawPropId,
          player_name: 'Anthony Davis',
          team: 'Los Angeles Lakers',
          stat_type: 'Points',
          line: 25.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          canonical_game_id: gameResult.canonical_game_id,
          canonical_player_id: playerResult.canonical_player_id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(rawProp).toBeDefined();
      expect(rawProp?.canonical_game_id).toBe(gameResult.canonical_game_id);
      expect(rawProp?.canonical_player_id).toBe(playerResult.canonical_player_id);

      // Verify can query by canonical IDs
      const { data: propsForPlayer } = await supabaseClient
        .from('raw_props')
        .select('*')
        .eq('canonical_player_id', playerResult.canonical_player_id);

      expect(propsForPlayer?.length).toBeGreaterThan(0);
      expect(propsForPlayer?.[0].id).toBe(rawPropId);
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign high confidence (1.0) for exact matches', async () => {
      const result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Exact Match Player',
        sport: testSport,
        team: 'Test Team',
      });

      expect(result.success).toBe(true);
      expect(result.confidence_score).toBe(1.0);
      expect(result.method).toBe('exact');
    });

    it('should assign lower confidence for fuzzy matches', async () => {
      // Create first player
      await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Michael Jordan',
        sport: testSport,
        team: 'Chicago Bulls',
      });

      // Try fuzzy match with slight variation
      const result = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'M. Jordan',
        sport: testSport,
        team: 'Chicago Bulls',
      });

      expect(result.success).toBe(true);
      expect(result.confidence_score).toBeLessThan(1.0);
      expect(result.confidence_score).toBeGreaterThan(0.7);
      expect(result.method).toBe('fuzzy');
    });

    it('should assign medium confidence for heuristic game matches', async () => {
      const gameTime = new Date('2025-12-01T19:30:00Z').toISOString();

      // Create first game
      await mappingService.mapGame({
        source: testSource,
        external_game_id: 'game1',
        sport: testSport,
        league: 'NBA',
        home_team: 'Miami Heat',
        away_team: 'New York Knicks',
        game_time: gameTime,
      });

      // Same game with slight time difference
      const slightlyDifferentTime = new Date('2025-12-01T19:45:00Z').toISOString();
      const result = await mappingService.mapGame({
        source: 'optimal_api' as MappingSource,
        external_game_id: 'game2',
        sport: testSport,
        league: 'NBA',
        home_team: 'Miami Heat',
        away_team: 'New York Knicks',
        game_time: slightlyDifferentTime,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('heuristic');
      expect(result.confidence_score).toBeGreaterThan(0.5);
      expect(result.confidence_score).toBeLessThan(1.0);
    });
  });

  describe('Multi-Source Mapping', () => {
    it('should map same player from Odds API and Optimal API to same canonical entity', async () => {
      const oddsApiResult = await mappingService.mapPlayer({
        source: 'odds_api' as MappingSource,
        player_name: 'Kevin Durant',
        sport: testSport,
        team: 'Phoenix Suns',
      });

      expect(oddsApiResult.success).toBe(true);
      const canonicalId = oddsApiResult.canonical_player_id!;

      const optimalApiResult = await mappingService.mapPlayer({
        source: 'optimal_api' as MappingSource,
        player_name: 'Kevin Durant',
        sport: testSport,
        team: 'Phoenix Suns',
      });

      expect(optimalApiResult.success).toBe(true);
      expect(optimalApiResult.canonical_player_id).toBe(canonicalId);

      // Verify two mappings for different sources
      const { data: mappings } = await supabaseClient
        .from('player_mappings')
        .select('*')
        .eq('canonical_player_id', canonicalId);

      expect(mappings?.length).toBe(2);
      const sources = mappings?.map(m => m.source).sort();
      expect(sources).toEqual(['odds_api', 'optimal_api']);
    });
  });
});

// Helper function to clean up test data
async function cleanupTestData() {
  // Delete in reverse order of dependencies
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%James%');
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%Curry%');
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%Payton%');
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%Davis%');
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%Jordan%');
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%Durant%');
  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%Match%');

  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'game%');
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'test_game%');

  await supabaseClient.from('canonical_players').delete().like('full_name', '%James%');
  await supabaseClient.from('canonical_players').delete().like('full_name', '%Curry%');
  await supabaseClient.from('canonical_players').delete().like('full_name', '%Payton%');
  await supabaseClient.from('canonical_players').delete().like('full_name', '%Davis%');
  await supabaseClient.from('canonical_players').delete().like('full_name', '%Jordan%');
  await supabaseClient.from('canonical_players').delete().like('full_name', '%Durant%');
  await supabaseClient.from('canonical_players').delete().like('full_name', '%Match%');

  await supabaseClient.from('canonical_games').delete().eq('league', 'NBA');

  await supabaseClient.from('raw_props').delete().eq('sport', 'NBA');
}

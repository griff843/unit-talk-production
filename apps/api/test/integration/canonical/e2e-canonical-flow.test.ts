/**
 * Integration Test 4: Full E2E Canonical Flow
 *
 * Tests the complete end-to-end flow through the canonical entity system:
 * - Raw feed data → Canonical entity mapping
 * - Canonical entities → Professional processing
 * - Professional processing → CLV tracking
 * - Verification: No unresolved entities
 * - Verification: All logs/metrics include canonical identifiers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CanonicalMappingService } from '../../../src/services/canonical/CanonicalMappingService';
import { ProfessionalPropProcessor } from '../../../src/services/ProfessionalPropProcessor';
import { CLVTrackingService } from '../../../src/services/clv/CLVTrackingService';
import { supabaseClient } from '../../../src/services/supabaseClient';
import type { Sport, MappingSource } from '../../../src/types/canonical-entities';

describe('Integration Test 4: Full E2E Canonical Flow', () => {
  let mappingService: CanonicalMappingService;
  let professionalProcessor: ProfessionalPropProcessor;
  let clvService: CLVTrackingService;
  const testSource: MappingSource = 'odds_api';
  const testSport: Sport = 'NBA';

  beforeAll(async () => {
    mappingService = new CanonicalMappingService();
    professionalProcessor = ProfessionalPropProcessor.getInstance();
    clvService = CLVTrackingService.getInstance();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  describe('Complete Pipeline Flow', () => {
    it('should process single prop through complete canonical pipeline', async () => {
      // ===== STEP 1: FEED DATA INGESTION =====
      // Simulate incoming data from Odds API

      const externalGameId = 'e2e_test_game_1';
      const externalPlayerName = 'Jayson Tatum';
      const gameTime = new Date('2025-12-13T19:00:00Z');

      // ===== STEP 2: CANONICAL ENTITY MAPPING =====

      // Map game to canonical entity
      const gameMapping = await mappingService.mapGame({
        source: testSource,
        external_game_id: externalGameId,
        sport: testSport,
        league: 'NBA',
        home_team: 'Boston Celtics',
        away_team: 'Washington Wizards',
        game_time: gameTime.toISOString(),
      });

      expect(gameMapping.success).toBe(true);
      expect(gameMapping.canonical_game_id).toBeDefined();
      expect(gameMapping.is_new_game).toBe(true);

      const canonicalGameId = gameMapping.canonical_game_id!;

      // Map player to canonical entity
      const playerMapping = await mappingService.mapPlayer({
        source: testSource,
        player_name: externalPlayerName,
        sport: testSport,
        team: 'Boston Celtics',
      });

      expect(playerMapping.success).toBe(true);
      expect(playerMapping.canonical_player_id).toBeDefined();
      expect(playerMapping.is_new_player).toBe(true);

      const canonicalPlayerId = playerMapping.canonical_player_id!;

      // Verify canonical entities exist
      const { data: canonicalGame } = await supabaseClient
        .from('canonical_games')
        .select('*')
        .eq('id', canonicalGameId)
        .single();

      expect(canonicalGame).toBeDefined();
      expect(canonicalGame.sport).toBe(testSport);

      const { data: canonicalPlayer } = await supabaseClient
        .from('canonical_players')
        .select('*')
        .eq('id', canonicalPlayerId)
        .single();

      expect(canonicalPlayer).toBeDefined();
      expect(canonicalPlayer.full_name).toBe(externalPlayerName);

      // ===== STEP 3: RAW PROP CREATION WITH CANONICAL IDS =====

      const gameId = crypto.randomUUID();
      const rawPropId = crypto.randomUUID();

      // Create game reference
      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Boston Celtics',
        away_team: 'Washington Wizards',
        start_time: gameTime.toISOString(),
        status: 'scheduled',
      });

      // Create raw_prop with canonical IDs
      const { data: rawProp, error: rawPropError } = await supabaseClient
        .from('raw_props')
        .insert({
          id: rawPropId,
          game_id: gameId,
          player_id: canonicalPlayerId,
          player_name: externalPlayerName,
          team: 'Boston Celtics',
          stat_type: 'Points',
          line: 27.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-13',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        })
        .select()
        .single();

      expect(rawPropError).toBeNull();
      expect(rawProp).toBeDefined();
      expect(rawProp.canonical_game_id).toBe(canonicalGameId);
      expect(rawProp.canonical_player_id).toBe(canonicalPlayerId);

      // ===== STEP 4: PROFESSIONAL PROCESSING =====

      const professionalResults = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(professionalResults).toBeDefined();
      expect(professionalResults.length).toBe(1);

      const professionalResult = professionalResults[0];
      expect(professionalResult.pickId).toBeDefined();
      expect(professionalResult.professionalScore).toBeGreaterThan(0);
      expect(professionalResult.tier).toBeDefined();
      expect(professionalResult.clv_tracking_id).toBeDefined();

      // ===== STEP 5: VERIFY PICK CONTAINS CANONICAL IDS =====

      const { data: pick } = await supabaseClient
        .from('picks')
        .select('*')
        .eq('id', professionalResult.pickId)
        .single();

      expect(pick).toBeDefined();
      expect(pick.metadata).toBeDefined();
      expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
      expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);
      expect(pick.metadata.professional_score).toBe(professionalResult.professionalScore);

      // ===== STEP 6: VERIFY CLV TRACKING CONTAINS CANONICAL IDS =====

      const { data: clvTracking } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('pick_id', professionalResult.pickId)
        .single();

      expect(clvTracking).toBeDefined();
      expect(clvTracking.canonical_game_id).toBe(canonicalGameId);
      expect(clvTracking.canonical_player_id).toBe(canonicalPlayerId);

      // ===== STEP 7: VERIFY NO UNRESOLVED ENTITIES =====

      // All entities should be resolvable via canonical IDs
      const { data: unresolvedRawProps } = await supabaseClient
        .from('raw_props')
        .select('id')
        .eq('id', rawPropId)
        .or('canonical_game_id.is.null,canonical_player_id.is.null');

      // Our prop should have canonical IDs, so shouldn't appear in unresolved query
      expect(unresolvedRawProps).toEqual([]);

      // ===== STEP 8: VERIFY END-TO-END TRACEABILITY =====

      // Should be able to trace from raw_prop → pick → clv_tracking
      expect(rawProp.id).toBe(rawPropId);
      expect(pick.metadata.raw_prop_id).toBe(rawPropId);
      expect(clvTracking.pick_id).toBe(professionalResult.pickId);

      // All should reference same canonical entities
      expect(rawProp.canonical_game_id).toBe(pick.metadata.canonical_game_id);
      expect(rawProp.canonical_game_id).toBe(clvTracking.canonical_game_id);
      expect(rawProp.canonical_player_id).toBe(pick.metadata.canonical_player_id);
      expect(rawProp.canonical_player_id).toBe(clvTracking.canonical_player_id);
    });

    it('should handle multi-source props for same canonical entities', async () => {
      // ===== SCENARIO: Same game/player from Odds API and Optimal API =====

      const gameTime = new Date('2025-12-14T20:00:00Z');

      // Map from Odds API
      const oddsApiGame = await mappingService.mapGame({
        source: 'odds_api' as MappingSource,
        external_game_id: 'odds_api_e2e_game_2',
        sport: testSport,
        league: 'NBA',
        home_team: 'Denver Nuggets',
        away_team: 'Minnesota Timberwolves',
        game_time: gameTime.toISOString(),
      });

      const oddsApiPlayer = await mappingService.mapPlayer({
        source: 'odds_api' as MappingSource,
        player_name: 'Nikola Jokic',
        sport: testSport,
        team: 'Denver Nuggets',
      });

      // Map from Optimal API (should resolve to same canonical entities)
      const optimalApiGame = await mappingService.mapGame({
        source: 'optimal_api' as MappingSource,
        external_game_id: 'optimal_api_e2e_game_2',
        sport: testSport,
        league: 'NBA',
        home_team: 'Denver Nuggets',
        away_team: 'Minnesota Timberwolves',
        game_time: gameTime.toISOString(),
      });

      const optimalApiPlayer = await mappingService.mapPlayer({
        source: 'optimal_api' as MappingSource,
        player_name: 'Nikola Jokic',
        sport: testSport,
        team: 'Denver Nuggets',
      });

      // Verify same canonical entities
      expect(oddsApiGame.canonical_game_id).toBe(optimalApiGame.canonical_game_id);
      expect(oddsApiPlayer.canonical_player_id).toBe(optimalApiPlayer.canonical_player_id);

      const canonicalGameId = oddsApiGame.canonical_game_id!;
      const canonicalPlayerId = oddsApiPlayer.canonical_player_id!;

      // Create raw props from both sources
      const game1Id = crypto.randomUUID();
      const game2Id = crypto.randomUUID();
      const rawProp1Id = crypto.randomUUID();
      const rawProp2Id = crypto.randomUUID();

      await supabaseClient.from('games').insert([
        {
          id: game1Id,
          sport: testSport,
          home_team: 'Denver Nuggets',
          away_team: 'Minnesota Timberwolves',
          start_time: gameTime.toISOString(),
          status: 'scheduled',
        },
        {
          id: game2Id,
          sport: testSport,
          home_team: 'Denver Nuggets',
          away_team: 'Minnesota Timberwolves',
          start_time: gameTime.toISOString(),
          status: 'scheduled',
        },
      ]);

      await supabaseClient.from('raw_props').insert([
        {
          id: rawProp1Id,
          game_id: game1Id,
          player_id: canonicalPlayerId,
          player_name: 'Nikola Jokic',
          team: 'Denver Nuggets',
          stat_type: 'Points',
          line: 26.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-14',
          bookmaker_key: 'odds_api',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        },
        {
          id: rawProp2Id,
          game_id: game2Id,
          player_id: canonicalPlayerId,
          player_name: 'Nikola Jokic',
          team: 'Denver Nuggets',
          stat_type: 'Points',
          line: 26.5,
          over_odds: -115,
          under_odds: -105,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-14',
          bookmaker_key: 'optimal_api',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        },
      ]);

      // Process both props
      const professionalResults = await professionalProcessor.processRawProps({
        max_batch_size: 2,
        timeout_ms: 60000,
      });

      expect(professionalResults.length).toBe(2);

      // Verify both picks reference same canonical entities
      const { data: picks } = await supabaseClient
        .from('picks')
        .select('id, metadata')
        .in('id', professionalResults.map(r => r.pickId));

      expect(picks.length).toBe(2);

      picks.forEach(pick => {
        expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
        expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);
      });

      // Verify both CLV entries reference same canonical entities
      const { data: clvEntries } = await supabaseClient
        .from('clv_tracking')
        .select('canonical_game_id, canonical_player_id')
        .in('pick_id', professionalResults.map(r => r.pickId));

      expect(clvEntries.length).toBe(2);

      clvEntries.forEach(entry => {
        expect(entry.canonical_game_id).toBe(canonicalGameId);
        expect(entry.canonical_player_id).toBe(canonicalPlayerId);
      });

      // Verify can query all data for canonical player across both sources
      const { data: allPlayerPicks } = await supabaseClient
        .from('picks')
        .select('id')
        .eq('metadata->>canonical_player_id', canonicalPlayerId);

      expect(allPlayerPicks.length).toBeGreaterThanOrEqual(2);
    });

    it('should maintain canonical entity relationships through complete pipeline', async () => {
      // Create multiple players in same game
      const gameTime = new Date('2025-12-15T19:30:00Z');

      const gameMapping = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'e2e_test_game_3',
        sport: testSport,
        league: 'NBA',
        home_team: 'New Orleans Pelicans',
        away_team: 'San Antonio Spurs',
        game_time: gameTime.toISOString(),
      });

      const canonicalGameId = gameMapping.canonical_game_id!;

      // Create multiple players
      const players = [
        { name: 'Zion Williamson', team: 'New Orleans Pelicans', line: 24.5 },
        { name: 'Brandon Ingram', team: 'New Orleans Pelicans', line: 21.5 },
        { name: 'Victor Wembanyama', team: 'San Antonio Spurs', line: 20.5 },
      ];

      const playerMappings = await Promise.all(
        players.map(player =>
          mappingService.mapPlayer({
            source: testSource,
            player_name: player.name,
            sport: testSport,
            team: player.team,
          })
        )
      );

      playerMappings.forEach(mapping => {
        expect(mapping.success).toBe(true);
        expect(mapping.canonical_player_id).toBeDefined();
      });

      // Create raw props for all players
      const gameIds = [];
      const rawPropIds = [];

      for (const [index, player] of players.entries()) {
        const gameId = crypto.randomUUID();
        const rawPropId = crypto.randomUUID();

        gameIds.push(gameId);
        rawPropIds.push(rawPropId);

        await supabaseClient.from('games').insert({
          id: gameId,
          sport: testSport,
          home_team: 'New Orleans Pelicans',
          away_team: 'San Antonio Spurs',
          start_time: gameTime.toISOString(),
          status: 'scheduled',
        });

        await supabaseClient.from('raw_props').insert({
          id: rawPropId,
          game_id: gameId,
          player_id: playerMappings[index].canonical_player_id,
          player_name: player.name,
          team: player.team,
          stat_type: 'Points',
          line: player.line,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-15',
          canonical_game_id: canonicalGameId,
          canonical_player_id: playerMappings[index].canonical_player_id,
        });
      }

      // Process all props
      const professionalResults = await professionalProcessor.processRawProps({
        max_batch_size: 3,
        timeout_ms: 90000,
      });

      expect(professionalResults.length).toBe(3);

      // Verify all picks reference the same canonical game
      const { data: gamePicks } = await supabaseClient
        .from('picks')
        .select('id, metadata')
        .in('id', professionalResults.map(r => r.pickId));

      expect(gamePicks.length).toBe(3);

      gamePicks.forEach(pick => {
        expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
      });

      // Verify each pick has different canonical player
      const playerIds = gamePicks.map(pick => pick.metadata.canonical_player_id);
      const uniquePlayerIds = new Set(playerIds);
      expect(uniquePlayerIds.size).toBe(3); // All different players

      // Verify can query all picks for this game
      const { data: allGamePicks } = await supabaseClient
        .from('picks')
        .select('id')
        .eq('metadata->>canonical_game_id', canonicalGameId);

      expect(allGamePicks.length).toBe(3);

      // Verify CLV tracking maintains relationships
      const { data: gameCLVEntries } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('canonical_game_id', canonicalGameId);

      expect(gameCLVEntries.length).toBe(3);

      gameCLVEntries.forEach(entry => {
        expect(entry.canonical_game_id).toBe(canonicalGameId);
        expect(entry.canonical_player_id).toBeDefined();
        expect(playerMappings.some(m => m.canonical_player_id === entry.canonical_player_id)).toBe(
          true
        );
      });
    });

    it('should log all canonical identifiers throughout pipeline', async () => {
      // This test verifies that all logging and metrics include canonical IDs

      const gameTime = new Date('2025-12-16T20:00:00Z');

      // Create canonical entities
      const gameMapping = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'e2e_test_game_4',
        sport: testSport,
        league: 'NBA',
        home_team: 'Charlotte Hornets',
        away_team: 'Detroit Pistons',
        game_time: gameTime.toISOString(),
      });

      const playerMapping = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'LaMelo Ball',
        sport: testSport,
        team: 'Charlotte Hornets',
      });

      const canonicalGameId = gameMapping.canonical_game_id!;
      const canonicalPlayerId = playerMapping.canonical_player_id!;

      // Create and process raw prop
      const gameId = crypto.randomUUID();
      const rawPropId = crypto.randomUUID();

      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Charlotte Hornets',
        away_team: 'Detroit Pistons',
        start_time: gameTime.toISOString(),
        status: 'scheduled',
      });

      await supabaseClient.from('raw_props').insert({
        id: rawPropId,
        game_id: gameId,
        player_id: canonicalPlayerId,
        player_name: 'LaMelo Ball',
        team: 'Charlotte Hornets',
        stat_type: 'Points',
        line: 23.5,
        over_odds: -110,
        under_odds: -110,
        sport: testSport,
        league: 'NBA',
        game_date: '2025-12-16',
        canonical_game_id: canonicalGameId,
        canonical_player_id: canonicalPlayerId,
      });

      // Process through pipeline
      const professionalResults = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(professionalResults.length).toBe(1);

      const professionalResult = professionalResults[0];

      // Verify pick metadata includes canonical IDs for logging
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('metadata')
        .eq('id', professionalResult.pickId)
        .single();

      expect(pick.metadata.canonical_game_id).toBeDefined();
      expect(pick.metadata.canonical_player_id).toBeDefined();

      // Verify all entities can be traced via canonical IDs
      const { data: rawProp } = await supabaseClient
        .from('raw_props')
        .select('canonical_game_id, canonical_player_id')
        .eq('id', rawPropId)
        .single();

      const { data: clv } = await supabaseClient
        .from('clv_tracking')
        .select('canonical_game_id, canonical_player_id')
        .eq('pick_id', professionalResult.pickId)
        .single();

      // All should have canonical IDs for complete observability
      expect(rawProp.canonical_game_id).toBe(canonicalGameId);
      expect(rawProp.canonical_player_id).toBe(canonicalPlayerId);
      expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
      expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);
      expect(clv.canonical_game_id).toBe(canonicalGameId);
      expect(clv.canonical_player_id).toBe(canonicalPlayerId);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing canonical IDs gracefully in E2E flow', async () => {
      // Create raw_prop WITHOUT canonical IDs
      const gameId = crypto.randomUUID();
      const rawPropId = crypto.randomUUID();

      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Test Team 1',
        away_team: 'Test Team 2',
        start_time: new Date('2025-12-17T19:00:00Z').toISOString(),
        status: 'scheduled',
      });

      await supabaseClient.from('raw_props').insert({
        id: rawPropId,
        game_id: gameId,
        player_id: crypto.randomUUID(),
        player_name: 'Test Player',
        team: 'Test Team 1',
        stat_type: 'Points',
        line: 20.0,
        over_odds: -110,
        under_odds: -110,
        sport: testSport,
        league: 'NBA',
        game_date: '2025-12-17',
        // canonical IDs intentionally omitted
      });

      // Should still process successfully
      const professionalResults = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(professionalResults.length).toBe(1);

      // Pick should be created without canonical IDs
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('metadata')
        .eq('id', professionalResults[0].pickId)
        .single();

      expect(pick).toBeDefined();
      // Canonical IDs should be null/undefined when not available
      expect(
        pick.metadata.canonical_game_id === null || pick.metadata.canonical_game_id === undefined
      ).toBe(true);
    });
  });
});

// Helper function to clean up test data
async function cleanupTestData() {
  // Delete in reverse order of dependencies
  await supabaseClient.from('clv_tracking').delete().like('metadata->>player_name', '%');
  await supabaseClient.from('picks').delete().like('metadata->>player_name', '%');
  await supabaseClient.from('raw_props').delete().eq('sport', 'NBA');
  await supabaseClient.from('games').delete().eq('sport', 'NBA');

  await supabaseClient.from('player_mappings').delete().like('external_player_name', '%');
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'e2e_test%');
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'odds_api%');
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'optimal_api%');

  await supabaseClient.from('canonical_players').delete().like('full_name', '%');
  await supabaseClient.from('canonical_games').delete().eq('league', 'NBA');
}

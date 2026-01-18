/**
 * Integration Test 2: Canonical → Professional Processor
 *
 * Tests that canonical entity IDs flow correctly through the professional processing pipeline:
 * - Raw props with canonical IDs → ProfessionalPropProcessor
 * - Canonical IDs stored in pick metadata
 * - Canonical IDs passed to CLV tracking
 * - No fallback to string-based name matching
 * - Professional features receive canonical identifiers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ProfessionalPropProcessor } from '../../../src/services/ProfessionalPropProcessor';
import { CanonicalMappingService } from '../../../src/services/canonical/CanonicalMappingService';
import { supabaseClient } from '../../../src/services/supabaseClient';
import type { Sport, MappingSource } from '../../../src/types/canonical-entities';

describe('Integration Test 2: Canonical → Professional Processor', () => {
  let professionalProcessor: ProfessionalPropProcessor;
  let mappingService: CanonicalMappingService;
  const testSource: MappingSource = 'odds_api';
  const testSport: Sport = 'NBA';

  beforeAll(async () => {
    professionalProcessor = ProfessionalPropProcessor.getInstance();
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

  describe('Canonical ID Propagation', () => {
    it('should propagate canonical IDs from raw_props through professional processing', async () => {
      // Step 1: Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_prof_game_1',
        sport: testSport,
        league: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        game_time: new Date('2025-12-01T19:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Anthony Davis',
        sport: testSport,
        team: 'Los Angeles Lakers',
      });

      expect(gameResult.success).toBe(true);
      expect(playerResult.success).toBe(true);

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Step 2: Create raw_prop with canonical IDs
      const rawPropId = crypto.randomUUID();
      const gameId = crypto.randomUUID();

      // First create the game reference
      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        start_time: new Date('2025-12-01T19:00:00Z').toISOString(),
        status: 'scheduled',
      });

      const { data: rawProp, error: rawPropError } = await supabaseClient
        .from('raw_props')
        .insert({
          id: rawPropId,
          game_id: gameId,
          player_id: playerResult.canonical_player_id,
          player_name: 'Anthony Davis',
          team: 'Los Angeles Lakers',
          stat_type: 'Points',
          line: 25.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-01',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        })
        .select()
        .single();

      expect(rawPropError).toBeNull();
      expect(rawProp).toBeDefined();
      expect(rawProp.canonical_game_id).toBe(canonicalGameId);
      expect(rawProp.canonical_player_id).toBe(canonicalPlayerId);

      // Step 3: Process through professional pipeline
      const results = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(results).toBeDefined();
      expect(results.length).toBe(1);

      const professionalResult = results[0];
      expect(professionalResult.pickId).toBeDefined();

      // Step 4: Verify pick metadata contains canonical IDs
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('*')
        .eq('id', professionalResult.pickId)
        .single();

      expect(pick).toBeDefined();
      expect(pick.metadata).toBeDefined();
      expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
      expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);

      // Step 5: Verify CLV tracking has canonical IDs
      const { data: clvTracking } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('pick_id', professionalResult.pickId)
        .single();

      expect(clvTracking).toBeDefined();
      expect(clvTracking.canonical_game_id).toBe(canonicalGameId);
      expect(clvTracking.canonical_player_id).toBe(canonicalPlayerId);
    });

    it('should handle raw_props without canonical IDs gracefully', async () => {
      // Create raw_prop WITHOUT canonical IDs to test graceful handling
      const rawPropId = crypto.randomUUID();
      const gameId = crypto.randomUUID();

      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Miami Heat',
        away_team: 'New York Knicks',
        start_time: new Date('2025-12-02T19:00:00Z').toISOString(),
        status: 'scheduled',
      });

      const { data: rawProp, error: rawPropError } = await supabaseClient
        .from('raw_props')
        .insert({
          id: rawPropId,
          game_id: gameId,
          player_id: crypto.randomUUID(),
          player_name: 'Jimmy Butler',
          team: 'Miami Heat',
          stat_type: 'Points',
          line: 22.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-02',
          // NOTE: canonical IDs intentionally omitted
        })
        .select()
        .single();

      expect(rawPropError).toBeNull();
      expect(rawProp).toBeDefined();
      expect(rawProp.canonical_game_id).toBeNull();
      expect(rawProp.canonical_player_id).toBeNull();

      // Process should still succeed
      const results = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(results).toBeDefined();
      expect(results.length).toBe(1);

      const professionalResult = results[0];
      expect(professionalResult.pickId).toBeDefined();

      // Verify pick created without canonical IDs (null/undefined acceptable)
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('*')
        .eq('id', professionalResult.pickId)
        .single();

      expect(pick).toBeDefined();
      // Canonical IDs should be null or undefined when not available
      expect(
        pick.metadata.canonical_game_id === null ||
        pick.metadata.canonical_game_id === undefined
      ).toBe(true);
    });
  });

  describe('No String-Based Fallback', () => {
    it('should NOT use string-based name matching when canonical IDs are present', async () => {
      // Create canonical entity with specific name
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_prof_game_2',
        sport: testSport,
        league: 'NBA',
        home_team: 'Golden State Warriors',
        away_team: 'Dallas Mavericks',
        game_time: new Date('2025-12-03T19:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Stephen Curry',
        sport: testSport,
        team: 'Golden State Warriors',
      });

      expect(gameResult.success).toBe(true);
      expect(playerResult.success).toBe(true);

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Create raw_prop with canonical IDs BUT different player name variation
      const rawPropId = crypto.randomUUID();
      const gameId = crypto.randomUUID();

      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Golden State Warriors',
        away_team: 'Dallas Mavericks',
        start_time: new Date('2025-12-03T19:00:00Z').toISOString(),
        status: 'scheduled',
      });

      const { data: rawProp } = await supabaseClient
        .from('raw_props')
        .insert({
          id: rawPropId,
          game_id: gameId,
          player_id: playerResult.canonical_player_id,
          player_name: 'Steph Curry', // NOTE: Different name variation
          team: 'Golden State Warriors',
          stat_type: 'Points',
          line: 28.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-03',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        })
        .select()
        .single();

      expect(rawProp).toBeDefined();

      // Process through professional pipeline
      const results = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(results.length).toBe(1);

      const professionalResult = results[0];

      // Verify pick uses canonical ID, not string-based player name matching
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('*')
        .eq('id', professionalResult.pickId)
        .single();

      expect(pick).toBeDefined();
      expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);

      // The player_name in metadata reflects the raw_prop value
      expect(pick.metadata.player_name).toBe('Steph Curry');

      // But the canonical ID should resolve to "Stephen Curry" in canonical_players
      const { data: canonicalPlayer } = await supabaseClient
        .from('canonical_players')
        .select('full_name')
        .eq('id', canonicalPlayerId)
        .single();

      expect(canonicalPlayer).toBeDefined();
      expect(canonicalPlayer.full_name).toBe('Stephen Curry');
    });
  });

  describe('Professional Features with Canonical IDs', () => {
    it('should include canonical IDs in professional grading metadata', async () => {
      // Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_prof_game_3',
        sport: testSport,
        league: 'NBA',
        home_team: 'Phoenix Suns',
        away_team: 'Denver Nuggets',
        game_time: new Date('2025-12-04T20:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Kevin Durant',
        sport: testSport,
        team: 'Phoenix Suns',
      });

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Create raw_prop
      const rawPropId = crypto.randomUUID();
      const gameId = crypto.randomUUID();

      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Phoenix Suns',
        away_team: 'Denver Nuggets',
        start_time: new Date('2025-12-04T20:00:00Z').toISOString(),
        status: 'scheduled',
      });

      await supabaseClient.from('raw_props').insert({
        id: rawPropId,
        game_id: gameId,
        player_id: playerResult.canonical_player_id,
        player_name: 'Kevin Durant',
        team: 'Phoenix Suns',
        stat_type: 'Points',
        line: 27.5,
        over_odds: -115,
        under_odds: -105,
        sport: testSport,
        league: 'NBA',
        game_date: '2025-12-04',
        canonical_game_id: canonicalGameId,
        canonical_player_id: canonicalPlayerId,
      });

      // Process through professional pipeline
      const results = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(results.length).toBe(1);

      const professionalResult = results[0];

      // Verify professional features received canonical identifiers
      expect(professionalResult.professionalScore).toBeGreaterThan(0);
      expect(professionalResult.tier).toBeDefined();
      expect(['S', 'A', 'B', 'C', 'D']).toContain(professionalResult.tier);

      // Verify pick metadata includes all required professional data
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('*')
        .eq('id', professionalResult.pickId)
        .single();

      expect(pick).toBeDefined();
      expect(pick.metadata).toBeDefined();

      // Verify canonical IDs are present
      expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
      expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);

      // Verify professional features are present
      expect(pick.metadata.professional_score).toBe(professionalResult.professionalScore);
      expect(pick.metadata.tier).toBe(professionalResult.tier);
      expect(pick.metadata.devigged_edge).toBeDefined();
      expect(pick.metadata.kelly_fraction).toBeDefined();
      expect(pick.metadata.professional_insights).toBeDefined();
      expect(pick.metadata.feature_contributions).toBeDefined();

      // Verify CLV tracking was initiated
      expect(professionalResult.clv_tracking_id).toBeDefined();
    });

    it('should maintain canonical ID consistency across pick lifecycle', async () => {
      // Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_prof_game_4',
        sport: testSport,
        league: 'NBA',
        home_team: 'Milwaukee Bucks',
        away_team: 'Cleveland Cavaliers',
        game_time: new Date('2025-12-05T19:30:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Giannis Antetokounmpo',
        sport: testSport,
        team: 'Milwaukee Bucks',
      });

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Create raw_prop
      const rawPropId = crypto.randomUUID();
      const gameId = crypto.randomUUID();

      await supabaseClient.from('games').insert({
        id: gameId,
        sport: testSport,
        home_team: 'Milwaukee Bucks',
        away_team: 'Cleveland Cavaliers',
        start_time: new Date('2025-12-05T19:30:00Z').toISOString(),
        status: 'scheduled',
      });

      await supabaseClient.from('raw_props').insert({
        id: rawPropId,
        game_id: gameId,
        player_id: playerResult.canonical_player_id,
        player_name: 'Giannis Antetokounmpo',
        team: 'Milwaukee Bucks',
        stat_type: 'Points',
        line: 30.5,
        over_odds: -110,
        under_odds: -110,
        sport: testSport,
        league: 'NBA',
        game_date: '2025-12-05',
        canonical_game_id: canonicalGameId,
        canonical_player_id: canonicalPlayerId,
      });

      // Process through professional pipeline
      const results = await professionalProcessor.processRawProps({
        max_batch_size: 1,
        timeout_ms: 30000,
      });

      expect(results.length).toBe(1);

      const professionalResult = results[0];
      const pickId = professionalResult.pickId;

      // Verify canonical IDs are consistent across all tables

      // 1. Check raw_props
      const { data: rawProp } = await supabaseClient
        .from('raw_props')
        .select('canonical_game_id, canonical_player_id')
        .eq('id', rawPropId)
        .single();

      expect(rawProp.canonical_game_id).toBe(canonicalGameId);
      expect(rawProp.canonical_player_id).toBe(canonicalPlayerId);

      // 2. Check picks
      const { data: pick } = await supabaseClient
        .from('picks')
        .select('metadata')
        .eq('id', pickId)
        .single();

      expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
      expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);

      // 3. Check CLV tracking
      const { data: clv } = await supabaseClient
        .from('clv_tracking')
        .select('canonical_game_id, canonical_player_id')
        .eq('pick_id', pickId)
        .single();

      expect(clv.canonical_game_id).toBe(canonicalGameId);
      expect(clv.canonical_player_id).toBe(canonicalPlayerId);

      // All three sources should have identical canonical IDs
      expect(rawProp.canonical_game_id).toBe(pick.metadata.canonical_game_id);
      expect(rawProp.canonical_game_id).toBe(clv.canonical_game_id);
      expect(rawProp.canonical_player_id).toBe(pick.metadata.canonical_player_id);
      expect(rawProp.canonical_player_id).toBe(clv.canonical_player_id);
    });
  });

  describe('Multi-Feed Processing', () => {
    it('should process props from different feeds with same canonical entities', async () => {
      // Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: 'odds_api' as MappingSource,
        external_game_id: 'odds_api_game_123',
        sport: testSport,
        league: 'NBA',
        home_team: 'Toronto Raptors',
        away_team: 'Atlanta Hawks',
        game_time: new Date('2025-12-06T19:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: 'odds_api' as MappingSource,
        player_name: 'Scottie Barnes',
        sport: testSport,
        team: 'Toronto Raptors',
      });

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Create second mapping from different source
      const gameResult2 = await mappingService.mapGame({
        source: 'optimal_api' as MappingSource,
        external_game_id: 'optimal_api_game_456',
        sport: testSport,
        league: 'NBA',
        home_team: 'Toronto Raptors',
        away_team: 'Atlanta Hawks',
        game_time: new Date('2025-12-06T19:00:00Z').toISOString(),
      });

      const playerResult2 = await mappingService.mapPlayer({
        source: 'optimal_api' as MappingSource,
        player_name: 'Scottie Barnes',
        sport: testSport,
        team: 'Toronto Raptors',
      });

      // Should map to same canonical entities
      expect(gameResult2.canonical_game_id).toBe(canonicalGameId);
      expect(playerResult2.canonical_player_id).toBe(canonicalPlayerId);

      // Create two raw_props from different sources
      const gameId1 = crypto.randomUUID();
      const gameId2 = crypto.randomUUID();

      await supabaseClient.from('games').insert([
        {
          id: gameId1,
          sport: testSport,
          home_team: 'Toronto Raptors',
          away_team: 'Atlanta Hawks',
          start_time: new Date('2025-12-06T19:00:00Z').toISOString(),
          status: 'scheduled',
        },
        {
          id: gameId2,
          sport: testSport,
          home_team: 'Toronto Raptors',
          away_team: 'Atlanta Hawks',
          start_time: new Date('2025-12-06T19:00:00Z').toISOString(),
          status: 'scheduled',
        },
      ]);

      const rawProp1Id = crypto.randomUUID();
      const rawProp2Id = crypto.randomUUID();

      await supabaseClient.from('raw_props').insert([
        {
          id: rawProp1Id,
          game_id: gameId1,
          player_id: playerResult.canonical_player_id,
          player_name: 'Scottie Barnes',
          team: 'Toronto Raptors',
          stat_type: 'Points',
          line: 18.5,
          over_odds: -110,
          under_odds: -110,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-06',
          bookmaker_key: 'odds_api',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        },
        {
          id: rawProp2Id,
          game_id: gameId2,
          player_id: playerResult2.canonical_player_id,
          player_name: 'Scottie Barnes',
          team: 'Toronto Raptors',
          stat_type: 'Points',
          line: 18.5,
          over_odds: -115,
          under_odds: -105,
          sport: testSport,
          league: 'NBA',
          game_date: '2025-12-06',
          bookmaker_key: 'optimal_api',
          canonical_game_id: canonicalGameId,
          canonical_player_id: canonicalPlayerId,
        },
      ]);

      // Process both props
      const results = await professionalProcessor.processRawProps({
        max_batch_size: 2,
        timeout_ms: 60000,
      });

      expect(results.length).toBe(2);

      // Both picks should reference the same canonical entities
      const { data: picks } = await supabaseClient
        .from('picks')
        .select('id, metadata')
        .in('id', results.map(r => r.pickId));

      expect(picks).toBeDefined();
      expect(picks.length).toBe(2);

      picks.forEach(pick => {
        expect(pick.metadata.canonical_game_id).toBe(canonicalGameId);
        expect(pick.metadata.canonical_player_id).toBe(canonicalPlayerId);
      });

      // Verify we can query all picks for this canonical player
      const { data: playerPicks } = await supabaseClient
        .from('picks')
        .select('id')
        .eq('metadata->>canonical_player_id', canonicalPlayerId);

      expect(playerPicks.length).toBeGreaterThanOrEqual(2);
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
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'test_prof%');
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'odds_api%');
  await supabaseClient.from('game_mappings').delete().like('external_game_id', 'optimal_api%');

  await supabaseClient.from('canonical_players').delete().like('full_name', '%');
  await supabaseClient.from('canonical_games').delete().eq('league', 'NBA');
}

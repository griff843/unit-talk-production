import { IngestionAgent } from '../../apps/api/src/agents/IngestionAgent';
import { supabase } from '../../apps/api/src/services/supabaseClient';
import { Database } from '../../apps/api/src/db/types/supabase';
import { jest } from '@jest/globals';

/**
 * Integration tests for IngestionAgent E2E workflow
 * Tests: single game → cache.book_quotes + unified_picks upserts
 */
describe('IngestionAgent Integration Tests', () => {
  let ingestionAgent: IngestionAgent;
  const testGameId = 'test_nfl_game_2024_001';
  const testPropId = 'test_prop_mahomes_passing_yards';

  beforeAll(async () => {
    // Initialize agent with test configuration
    ingestionAgent = new IngestionAgent({
      name: 'test-ingestion-agent',
      enabled: true,
      interval: 60000,
      healthCheckInterval: 30000,
      maxRetries: 3
    }, {
      supabase,
      logger: console
    });

    // Clean test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('E2E Single Game Processing', () => {
    test('processes single game through complete pipeline', async () => {
      const startTime = Date.now();
      
      // Mock game data from optimal API
      const mockGameData = {
        external_game_id: testGameId,
        sport: 'nfl',
        home_team: 'Kansas City Chiefs',
        away_team: 'Buffalo Bills',
        game_date: '2024-01-21',
        props: [
          {
            external_prop_id: testPropId,
            player_name: 'Patrick Mahomes',
            market: 'passing_yards',
            line: 275.5,
            odds_over: -110,
            odds_under: -110,
            team: 'Kansas City Chiefs',
            opponent: 'Buffalo Bills'
          }
        ]
      };

      // Process game through ingestion pipeline
      const result = await ingestionAgent.processGame(mockGameData);

      expect(result.success).toBe(true);
      expect(result.propsProcessed).toBe(1);
      expect(result.cacheEntriesCreated).toBe(1);
      expect(result.unifiedPicksUpserted).toBe(1);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // < 5 second target
    });

    test('creates cache.book_quotes entries correctly', async () => {
      // Verify cache entries were created
      const { data: cacheEntries, error } = await supabase
        .from('cache.book_quotes')
        .select('*')
        .eq('external_game_id', testGameId)
        .eq('external_prop_id', testPropId);

      expect(error).toBeNull();
      expect(cacheEntries).toBeDefined();
      expect(cacheEntries!.length).toBeGreaterThan(0);

      const entry = cacheEntries![0];
      expect(entry.book_name).toBe('optimal');
      expect(entry.odds_over).toBe(-110);
      expect(entry.odds_under).toBe(-110);
      expect(entry.line).toBe(275.5);
      expect(entry.ttl_expires_at).toBeDefined();
      expect(new Date(entry.ttl_expires_at) > new Date()).toBe(true);
    });

    test('creates unified_picks entries with required fields', async () => {
      const { data: unifiedPicks, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('external_game_id', testGameId)
        .eq('external_prop_id', testPropId);

      expect(error).toBeNull();
      expect(unifiedPicks).toBeDefined();
      expect(unifiedPicks!.length).toBe(1);

      const pick = unifiedPicks![0];
      
      // Core identification fields
      expect(pick.external_game_id).toBe(testGameId);
      expect(pick.external_prop_id).toBe(testPropId);
      expect(pick.source).toBe('optimal');
      expect(pick.sport).toBe('nfl');
      
      // Business logic fields
      expect(pick.player_name).toBe('Patrick Mahomes');
      expect(pick.market).toBe('passing_yards');
      expect(pick.line).toBe(275.5);
      expect(pick.odds_over).toBe(-110);
      expect(pick.odds_under).toBe(-110);
      expect(pick.team).toBe('Kansas City Chiefs');
      expect(pick.opponent).toBe('Buffalo Bills');
      
      // Processing metadata
      expect(pick.processing_time).toBeGreaterThan(0);
      expect(pick.created_at).toBeDefined();
      expect(pick.updated_at).toBeDefined();
    });
  });

  describe('Deduplication and Upsert Logic', () => {
    test('handles duplicate props correctly', async () => {
      const mockGameData = {
        external_game_id: testGameId,
        sport: 'nfl',
        home_team: 'Kansas City Chiefs', 
        away_team: 'Buffalo Bills',
        game_date: '2024-01-21',
        props: [
          {
            external_prop_id: testPropId,
            player_name: 'Patrick Mahomes',
            market: 'passing_yards',
            line: 280.5, // Updated line
            odds_over: -115, // Updated odds
            odds_under: -105,
            team: 'Kansas City Chiefs',
            opponent: 'Buffalo Bills'
          }
        ]
      };

      // Process updated data
      const result = await ingestionAgent.processGame(mockGameData);
      expect(result.success).toBe(true);
      expect(result.unifiedPicksUpserted).toBe(1);

      // Verify only one record exists with updated values
      const { data: picks, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('external_game_id', testGameId)
        .eq('external_prop_id', testPropId);

      expect(error).toBeNull();
      expect(picks!.length).toBe(1);
      expect(picks![0].line).toBe(280.5);
      expect(picks![0].odds_over).toBe(-115);
      expect(picks![0].odds_under).toBe(-105);
    });

    test('preserves existing professional grading data during updates', async () => {
      // Add professional grading data
      const { error: updateError } = await supabase
        .from('unified_picks')
        .update({
          professional_score: 0.85,
          feature_contributions: { steam: 0.3, clv: 0.4, model: 0.15 },
          devigged_edge: 0.08,
          kelly_fraction: 0.15
        })
        .eq('external_prop_id', testPropId);

      expect(updateError).toBeNull();

      // Process line movement update
      const mockGameData = {
        external_game_id: testGameId,
        sport: 'nfl',
        home_team: 'Kansas City Chiefs',
        away_team: 'Buffalo Bills', 
        game_date: '2024-01-21',
        props: [
          {
            external_prop_id: testPropId,
            player_name: 'Patrick Mahomes',
            market: 'passing_yards',
            line: 285.5, // Another line move
            odds_over: -120,
            odds_under: -100,
            team: 'Kansas City Chiefs',
            opponent: 'Buffalo Bills'
          }
        ]
      };

      await ingestionAgent.processGame(mockGameData);

      // Verify professional data preserved
      const { data: pick, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('external_prop_id', testPropId)
        .single();

      expect(error).toBeNull();
      expect(pick.line).toBe(285.5); // Updated
      expect(pick.odds_over).toBe(-120); // Updated
      expect(pick.professional_score).toBe(0.85); // Preserved
      expect(pick.devigged_edge).toBe(0.08); // Preserved
      expect(pick.kelly_fraction).toBe(0.15); // Preserved
    });
  });

  describe('Error Handling and Resilience', () => {
    test('handles malformed prop data gracefully', async () => {
      const malformedGameData = {
        external_game_id: 'malformed_game',
        sport: 'nfl',
        props: [
          {
            external_prop_id: 'malformed_prop',
            player_name: null, // Invalid
            market: '', // Invalid
            line: 'not_a_number', // Invalid
            odds_over: -110,
            odds_under: -110
          }
        ]
      };

      const result = await ingestionAgent.processGame(malformedGameData);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.propsProcessed).toBe(0);
    });

    test('continues processing other props when one fails', async () => {
      const mixedGameData = {
        external_game_id: 'mixed_game',
        sport: 'nfl',
        props: [
          {
            external_prop_id: 'valid_prop',
            player_name: 'Valid Player',
            market: 'passing_yards',
            line: 275.5,
            odds_over: -110,
            odds_under: -110,
            team: 'Team A',
            opponent: 'Team B'
          },
          {
            external_prop_id: 'invalid_prop',
            player_name: null, // Invalid
            market: 'passing_yards',
            line: 275.5,
            odds_over: -110,
            odds_under: -110
          }
        ]
      };

      const result = await ingestionAgent.processGame(mixedGameData);
      
      expect(result.success).toBe(true); // Partial success
      expect(result.propsProcessed).toBe(1);
      expect(result.propsSkipped).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('Performance Benchmarks', () => {
    test('processes 100 props within performance target', async () => {
      const startTime = Date.now();
      
      // Generate 100 test props
      const props = Array.from({ length: 100 }, (_, i) => ({
        external_prop_id: `perf_test_prop_${i}`,
        player_name: `Player ${i}`,
        market: 'passing_yards',
        line: 250 + i,
        odds_over: -110,
        odds_under: -110,
        team: 'Team A',
        opponent: 'Team B'
      }));

      const largeGameData = {
        external_game_id: 'perf_test_game',
        sport: 'nfl',
        home_team: 'Team A',
        away_team: 'Team B',
        game_date: '2024-01-21',
        props
      };

      const result = await ingestionAgent.processGame(largeGameData);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.propsProcessed).toBe(100);
      expect(processingTime).toBeLessThan(10000); // < 10 seconds for 100 props
      expect(processingTime / 100).toBeLessThan(100); // < 100ms per prop average

      // Cleanup
      await supabase
        .from('unified_picks')
        .delete()
        .eq('external_game_id', 'perf_test_game');
    });
  });

  // Helper function to clean up test data
  async function cleanupTestData() {
    await supabase
      .from('unified_picks')
      .delete()
      .in('external_game_id', [testGameId, 'malformed_game', 'mixed_game']);
      
    await supabase
      .from('cache.book_quotes')
      .delete()
      .in('external_game_id', [testGameId, 'malformed_game', 'mixed_game']);
  }
});

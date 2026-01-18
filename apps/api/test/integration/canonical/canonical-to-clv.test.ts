/**
 * Integration Test 3: Canonical → CLV Tracking
 *
 * Tests that canonical entity IDs flow correctly through CLV (Closing Line Value) tracking:
 * - Canonical IDs stored in clv_tracking table
 * - CLV updates maintain canonical references
 * - Cross-source CLV analysis using canonical IDs
 * - Accurate closing line tracking across multiple feeds
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CLVTrackingService } from '../../../src/services/clv/CLVTrackingService';
import { CanonicalMappingService } from '../../../src/services/canonical/CanonicalMappingService';
import { supabaseClient } from '../../../src/services/supabaseClient';
import type { Sport, MappingSource } from '../../../src/types/canonical-entities';

describe('Integration Test 3: Canonical → CLV Tracking', () => {
  let clvService: CLVTrackingService;
  let mappingService: CanonicalMappingService;
  const testSource: MappingSource = 'odds_api';
  const testSport: Sport = 'NBA';
  const testTenantId = 'test-tenant-clv';

  beforeAll(async () => {
    clvService = CLVTrackingService.getInstance();
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

  describe('CLV Initialization with Canonical IDs', () => {
    it('should store canonical IDs when tracking a new pick', async () => {
      // Step 1: Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_clv_game_1',
        sport: testSport,
        league: 'NBA',
        home_team: 'Philadelphia 76ers',
        away_team: 'Brooklyn Nets',
        game_time: new Date('2025-12-07T19:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Joel Embiid',
        sport: testSport,
        team: 'Philadelphia 76ers',
      });

      expect(gameResult.success).toBe(true);
      expect(playerResult.success).toBe(true);

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Step 2: Track pick with canonical IDs
      const pickId = crypto.randomUUID();

      const trackingId = await clvService.trackPick({
        tenantId: testTenantId,
        pickId,
        bookmaker: 'test_book',
        submittedLine: 28.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId,
        metadata: {
          sport: testSport,
          player_name: 'Joel Embiid',
          market: 'Points',
        },
      });

      expect(trackingId).toBeDefined();

      // Step 3: Verify canonical IDs are stored in clv_tracking
      const { data: clvEntry, error } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('id', trackingId)
        .single();

      expect(error).toBeNull();
      expect(clvEntry).toBeDefined();
      expect(clvEntry.canonical_game_id).toBe(canonicalGameId);
      expect(clvEntry.canonical_player_id).toBe(canonicalPlayerId);
      expect(clvEntry.pick_id).toBe(pickId);
      expect(clvEntry.tenant_id).toBe(testTenantId);
    });

    it('should handle CLV tracking without canonical IDs gracefully', async () => {
      // Track pick WITHOUT canonical IDs
      const pickId = crypto.randomUUID();

      const trackingId = await clvService.trackPick({
        tenantId: testTenantId,
        pickId,
        bookmaker: 'test_book',
        submittedLine: 25.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        // NOTE: canonical IDs intentionally omitted
        metadata: {
          sport: testSport,
          player_name: 'Test Player',
          market: 'Points',
        },
      });

      expect(trackingId).toBeDefined();

      // Verify entry exists with null canonical IDs
      const { data: clvEntry } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('id', trackingId)
        .single();

      expect(clvEntry).toBeDefined();
      expect(clvEntry.canonical_game_id).toBeNull();
      expect(clvEntry.canonical_player_id).toBeNull();
    });

    it('should maintain canonical IDs through CLV updates', async () => {
      // Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_clv_game_2',
        sport: testSport,
        league: 'NBA',
        home_team: 'Memphis Grizzlies',
        away_team: 'Portland Trail Blazers',
        game_time: new Date('2025-12-08T20:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Ja Morant',
        sport: testSport,
        team: 'Memphis Grizzlies',
      });

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Track pick
      const pickId = crypto.randomUUID();

      const trackingId = await clvService.trackPick({
        tenantId: testTenantId,
        pickId,
        bookmaker: 'test_book',
        submittedLine: 26.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId,
      });

      // Update closing line
      const updatedEntry = await clvService.updateClosingLine(
        pickId,
        27.0, // closing line
        -115  // closing odds
      );

      expect(updatedEntry).toBeDefined();
      expect(updatedEntry.canonical_game_id).toBe(canonicalGameId);
      expect(updatedEntry.canonical_player_id).toBe(canonicalPlayerId);
      expect(updatedEntry.closing_line).toBe(27.0);
      expect(updatedEntry.closing_odds).toBe(-115);
      expect(updatedEntry.beat_closing_line).toBeDefined();
    });
  });

  describe('Cross-Source CLV Analysis', () => {
    it('should aggregate CLV across multiple feeds using canonical player ID', async () => {
      // Create canonical player mapped from multiple sources
      const oddsApiPlayer = await mappingService.mapPlayer({
        source: 'odds_api' as MappingSource,
        player_name: 'Luka Doncic',
        sport: testSport,
        team: 'Dallas Mavericks',
      });

      const optimalApiPlayer = await mappingService.mapPlayer({
        source: 'optimal_api' as MappingSource,
        player_name: 'Luka Doncic',
        sport: testSport,
        team: 'Dallas Mavericks',
      });

      // Should map to same canonical player
      expect(oddsApiPlayer.canonical_player_id).toBe(optimalApiPlayer.canonical_player_id);

      const canonicalPlayerId = oddsApiPlayer.canonical_player_id!;

      // Create game for context
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_clv_game_3',
        sport: testSport,
        league: 'NBA',
        home_team: 'Dallas Mavericks',
        away_team: 'Sacramento Kings',
        game_time: new Date('2025-12-09T19:30:00Z').toISOString(),
      });

      const canonicalGameId = gameResult.canonical_game_id!;

      // Track picks from different sources for same canonical player
      const pick1Id = crypto.randomUUID();
      const pick2Id = crypto.randomUUID();

      await clvService.trackPick({
        tenantId: testTenantId,
        pickId: pick1Id,
        bookmaker: 'odds_api_book',
        submittedLine: 30.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId,
        metadata: { source: 'odds_api' },
      });

      await clvService.trackPick({
        tenantId: testTenantId,
        pickId: pick2Id,
        bookmaker: 'optimal_api_book',
        submittedLine: 31.0,
        submittedOdds: -115,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId,
        metadata: { source: 'optimal_api' },
      });

      // Update both with closing lines
      await clvService.updateClosingLine(pick1Id, 31.5, -120);
      await clvService.updateClosingLine(pick2Id, 31.5, -120);

      // Query all CLV entries for this canonical player
      const { data: playerCLVEntries } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('canonical_player_id', canonicalPlayerId)
        .not('closing_line', 'is', null);

      expect(playerCLVEntries).toBeDefined();
      expect(playerCLVEntries.length).toBeGreaterThanOrEqual(2);

      // All entries should reference the same canonical player
      playerCLVEntries.forEach(entry => {
        expect(entry.canonical_player_id).toBe(canonicalPlayerId);
      });

      // Calculate aggregate CLV for canonical player
      const totalCLV = playerCLVEntries.reduce((sum, entry) => {
        return sum + (entry.clv_percentage || 0);
      }, 0);
      const avgCLV = totalCLV / playerCLVEntries.length;

      expect(avgCLV).toBeDefined();
      expect(typeof avgCLV).toBe('number');
    });

    it('should query CLV by canonical game ID across multiple feeds', async () => {
      // Create canonical game mapped from multiple sources
      const oddsApiGame = await mappingService.mapGame({
        source: 'odds_api' as MappingSource,
        external_game_id: 'odds_api_game_789',
        sport: testSport,
        league: 'NBA',
        home_team: 'Chicago Bulls',
        away_team: 'Indiana Pacers',
        game_time: new Date('2025-12-10T19:00:00Z').toISOString(),
      });

      const optimalApiGame = await mappingService.mapGame({
        source: 'optimal_api' as MappingSource,
        external_game_id: 'optimal_api_game_012',
        sport: testSport,
        league: 'NBA',
        home_team: 'Chicago Bulls',
        away_team: 'Indiana Pacers',
        game_time: new Date('2025-12-10T19:00:00Z').toISOString(),
      });

      // Should map to same canonical game
      expect(oddsApiGame.canonical_game_id).toBe(optimalApiGame.canonical_game_id);

      const canonicalGameId = oddsApiGame.canonical_game_id!;

      // Create players for the game
      const player1 = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Zach LaVine',
        sport: testSport,
        team: 'Chicago Bulls',
      });

      const player2 = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Tyrese Haliburton',
        sport: testSport,
        team: 'Indiana Pacers',
      });

      // Track picks for different players in same game
      const pick1Id = crypto.randomUUID();
      const pick2Id = crypto.randomUUID();

      await clvService.trackPick({
        tenantId: testTenantId,
        pickId: pick1Id,
        bookmaker: 'test_book',
        submittedLine: 24.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId: player1.canonical_player_id,
      });

      await clvService.trackPick({
        tenantId: testTenantId,
        pickId: pick2Id,
        bookmaker: 'test_book',
        submittedLine: 22.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId: player2.canonical_player_id,
      });

      // Update with closing lines
      await clvService.updateClosingLine(pick1Id, 25.0, -115);
      await clvService.updateClosingLine(pick2Id, 23.0, -115);

      // Query all CLV entries for this canonical game
      const { data: gameCLVEntries } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('canonical_game_id', canonicalGameId)
        .not('closing_line', 'is', null);

      expect(gameCLVEntries).toBeDefined();
      expect(gameCLVEntries.length).toBeGreaterThanOrEqual(2);

      // All entries should reference the same canonical game
      gameCLVEntries.forEach(entry => {
        expect(entry.canonical_game_id).toBe(canonicalGameId);
      });
    });
  });

  describe('CLV Performance Metrics with Canonical IDs', () => {
    it('should calculate player-specific CLV metrics using canonical player ID', async () => {
      // Create canonical player
      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Damian Lillard',
        sport: testSport,
        team: 'Milwaukee Bucks',
      });

      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Create game
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_clv_game_4',
        sport: testSport,
        league: 'NBA',
        home_team: 'Milwaukee Bucks',
        away_team: 'Minnesota Timberwolves',
        game_time: new Date('2025-12-11T20:00:00Z').toISOString(),
      });

      const canonicalGameId = gameResult.canonical_game_id!;

      // Track multiple picks for same player with varying CLV
      const picks = [
        { line: 25.5, odds: -110, closingLine: 26.5, closingOdds: -115 }, // Beat closing
        { line: 26.5, odds: -110, closingLine: 26.0, closingOdds: -105 }, // Lost closing
        { line: 27.5, odds: -110, closingLine: 28.0, closingOdds: -120 }, // Beat closing
      ];

      for (const [index, pick] of picks.entries()) {
        const pickId = crypto.randomUUID();

        await clvService.trackPick({
          tenantId: testTenantId,
          pickId,
          bookmaker: 'test_book',
          submittedLine: pick.line,
          submittedOdds: pick.odds,
          submittedAt: new Date(Date.now() - (picks.length - index) * 60000), // Stagger times
          canonicalGameId,
          canonicalPlayerId,
        });

        await clvService.updateClosingLine(pickId, pick.closingLine, pick.closingOdds);
      }

      // Query CLV stats for this canonical player
      const { data: playerCLVEntries } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('canonical_player_id', canonicalPlayerId)
        .not('closing_line', 'is', null);

      expect(playerCLVEntries.length).toBe(3);

      // Calculate stats
      const beatsClosing = playerCLVEntries.filter(e => e.beat_closing_line === true).length;
      const totalPicks = playerCLVEntries.length;
      const beatRate = beatsClosing / totalPicks;

      expect(beatRate).toBeGreaterThan(0.5); // Should beat closing more than 50%

      const avgCLV =
        playerCLVEntries.reduce((sum, e) => sum + (e.clv_percentage || 0), 0) / totalPicks;

      expect(avgCLV).toBeDefined();
      expect(typeof avgCLV).toBe('number');
    });

    it('should enable CLV trend analysis by canonical player over time', async () => {
      // Create canonical player
      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Devin Booker',
        sport: testSport,
        team: 'Phoenix Suns',
      });

      const canonicalPlayerId = playerResult.canonical_player_id!;

      // Create multiple games over time
      const games = [];
      for (let i = 0; i < 3; i++) {
        const gameResult = await mappingService.mapGame({
          source: testSource,
          external_game_id: `test_clv_game_trend_${i}`,
          sport: testSport,
          league: 'NBA',
          home_team: 'Phoenix Suns',
          away_team: 'Utah Jazz',
          game_time: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
        });
        games.push(gameResult.canonical_game_id!);
      }

      // Track picks across multiple games
      for (const [index, gameId] of games.entries()) {
        const pickId = crypto.randomUUID();

        await clvService.trackPick({
          tenantId: testTenantId,
          pickId,
          bookmaker: 'test_book',
          submittedLine: 27.5 + index * 0.5, // Increasing lines
          submittedOdds: -110,
          submittedAt: new Date(Date.now() - (games.length - index) * 24 * 60 * 60 * 1000),
          canonicalGameId: gameId,
          canonicalPlayerId,
        });

        await clvService.updateClosingLine(pickId, 28.0 + index * 0.5, -115);
      }

      // Query CLV entries ordered by submission time
      const { data: clvTrend } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('canonical_player_id', canonicalPlayerId)
        .not('closing_line', 'is', null)
        .order('submitted_at', { ascending: true });

      expect(clvTrend).toBeDefined();
      expect(clvTrend.length).toBe(3);

      // Verify trend can be analyzed
      const clvValues = clvTrend.map(entry => entry.clv_percentage || 0);
      expect(clvValues.length).toBe(3);

      // All entries should have the same canonical player ID
      clvTrend.forEach(entry => {
        expect(entry.canonical_player_id).toBe(canonicalPlayerId);
      });
    });
  });

  describe('CLV Idempotency with Canonical IDs', () => {
    it('should handle duplicate CLV tracking requests idempotently', async () => {
      // Create canonical entities
      const gameResult = await mappingService.mapGame({
        source: testSource,
        external_game_id: 'test_clv_game_5',
        sport: testSport,
        league: 'NBA',
        home_team: 'Oklahoma City Thunder',
        away_team: 'Houston Rockets',
        game_time: new Date('2025-12-12T19:00:00Z').toISOString(),
      });

      const playerResult = await mappingService.mapPlayer({
        source: testSource,
        player_name: 'Shai Gilgeous-Alexander',
        sport: testSport,
        team: 'Oklahoma City Thunder',
      });

      const canonicalGameId = gameResult.canonical_game_id!;
      const canonicalPlayerId = playerResult.canonical_player_id!;

      const pickId = crypto.randomUUID();

      // Track pick first time
      const trackingId1 = await clvService.trackPick({
        tenantId: testTenantId,
        pickId,
        bookmaker: 'test_book',
        submittedLine: 29.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId,
      });

      expect(trackingId1).toBeDefined();

      // Track same pick again (should be idempotent)
      const trackingId2 = await clvService.trackPick({
        tenantId: testTenantId,
        pickId,
        bookmaker: 'test_book',
        submittedLine: 29.5,
        submittedOdds: -110,
        submittedAt: new Date(),
        canonicalGameId,
        canonicalPlayerId,
      });

      expect(trackingId2).toBeDefined();
      // Should return same tracking ID or handle duplicate gracefully
      expect(trackingId2).toBe(trackingId1);

      // Verify only one entry exists
      const { data: clvEntries } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('pick_id', pickId);

      expect(clvEntries).toBeDefined();
      expect(clvEntries.length).toBe(1);
      expect(clvEntries[0].canonical_game_id).toBe(canonicalGameId);
      expect(clvEntries[0].canonical_player_id).toBe(canonicalPlayerId);
    });
  });
});

// Helper function to clean up test data
async function cleanupTestData() {
  // Delete CLV tracking entries for test tenant
  await supabaseClient
    .from('clv_tracking')
    .delete()
    .eq('tenant_id', 'test-tenant-clv');

  // Clean up mappings
  await supabaseClient
    .from('player_mappings')
    .delete()
    .like('external_player_name', '%');
  await supabaseClient
    .from('game_mappings')
    .delete()
    .like('external_game_id', 'test_clv%');
  await supabaseClient
    .from('game_mappings')
    .delete()
    .like('external_game_id', 'odds_api%');
  await supabaseClient
    .from('game_mappings')
    .delete()
    .like('external_game_id', 'optimal_api%');

  // Clean up canonical entities
  await supabaseClient
    .from('canonical_players')
    .delete()
    .like('full_name', '%');
  await supabaseClient
    .from('canonical_games')
    .delete()
    .eq('league', 'NBA');
}

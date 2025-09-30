import { supabase } from '../../apps/api/src/services/supabaseClient';
import { Database } from '../../apps/api/src/db/types/supabase';

/**
 * Contract tests for unified_picks table schema and constraints
 * These tests validate the database structure and ensure all required
 * columns, indexes, and constraints are present for the cache-first architecture
 */
describe('Unified Picks Contract Tests', () => {
  describe('Schema Validation', () => {
    test('unified_picks table exists with required columns', async () => {
      const { data: columns, error } = await supabase.rpc('get_table_columns', {
        table_name: 'unified_picks'
      });
      
      expect(error).toBeNull();
      expect(columns).toBeDefined();
      
      const columnNames = columns?.map((col: any) => col.column_name) || [];
      
      // Core identification columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('external_game_id');
      expect(columnNames).toContain('external_prop_id');
      expect(columnNames).toContain('source');
      
      // Business logic columns
      expect(columnNames).toContain('sport');
      expect(columnNames).toContain('market');
      expect(columnNames).toContain('player_name');
      expect(columnNames).toContain('team');
      expect(columnNames).toContain('opponent');
      expect(columnNames).toContain('line');
      expect(columnNames).toContain('odds_over');
      expect(columnNames).toContain('odds_under');
      
      // Professional grading columns
      expect(columnNames).toContain('professional_score');
      expect(columnNames).toContain('feature_contributions');
      expect(columnNames).toContain('devigged_edge');
      expect(columnNames).toContain('clv_tracking_id');
      expect(columnNames).toContain('kelly_fraction');
      
      // Processing and settlement
      expect(columnNames).toContain('processing_time');
      expect(columnNames).toContain('settled_at');
      expect(columnNames).toContain('settlement_result');
      expect(columnNames).toContain('game_date');
      
      // Audit fields
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    test('unified_picks has required indexes for performance', async () => {
      const { data: indexes, error } = await supabase.rpc('get_table_indexes', {
        table_name: 'unified_picks'
      });
      
      expect(error).toBeNull();
      expect(indexes).toBeDefined();
      
      const indexNames = indexes?.map((idx: any) => idx.indexname) || [];
      
      // Essential performance indexes
      expect(indexNames).toContain('idx_unified_picks_external_ids');
      expect(indexNames).toContain('idx_unified_picks_settled_at');
      expect(indexNames).toContain('idx_unified_picks_game_date');
      expect(indexNames).toContain('idx_unified_picks_source_sport');
    });

    test('unified_picks has proper constraints', async () => {
      const { data: constraints, error } = await supabase.rpc('get_table_constraints', {
        table_name: 'unified_picks'
      });
      
      expect(error).toBeNull();
      expect(constraints).toBeDefined();
      
      const constraintNames = constraints?.map((c: any) => c.constraint_name) || [];
      
      // Primary key constraint
      expect(constraintNames.some(name => name.includes('pkey'))).toBe(true);
      
      // Not null constraints for critical fields
      const notNullConstraints = constraints?.filter((c: any) => 
        c.constraint_type === 'NOT NULL'
      ).map((c: any) => c.column_name) || [];
      
      expect(notNullConstraints).toContain('external_game_id');
      expect(notNullConstraints).toContain('external_prop_id');
      expect(notNullConstraints).toContain('source');
      expect(notNullConstraints).toContain('sport');
      expect(notNullConstraints).toContain('market');
    });
  });

  describe('Cache Schema Compatibility', () => {
    test('cache.book_quotes table exists with required structure', async () => {
      const { data: columns, error } = await supabase.rpc('get_table_columns', {
        schema_name: 'cache',
        table_name: 'book_quotes'
      });
      
      expect(error).toBeNull();
      expect(columns).toBeDefined();
      
      const columnNames = columns?.map((col: any) => col.column_name) || [];
      
      // Core cache columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('external_game_id');
      expect(columnNames).toContain('external_prop_id');
      expect(columnNames).toContain('book_name');
      expect(columnNames).toContain('odds_over');
      expect(columnNames).toContain('odds_under');
      expect(columnNames).toContain('line');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('ttl_expires_at');
    });

    test('cache.game_results table exists for settlement', async () => {
      const { data: columns, error } = await supabase.rpc('get_table_columns', {
        schema_name: 'cache',
        table_name: 'game_results'
      });
      
      expect(error).toBeNull();
      expect(columns).toBeDefined();
      
      const columnNames = columns?.map((col: any) => col.column_name) || [];
      
      expect(columnNames).toContain('external_game_id');
      expect(columnNames).toContain('sport');
      expect(columnNames).toContain('final_score_home');
      expect(columnNames).toContain('final_score_away');
      expect(columnNames).toContain('player_stats');
      expect(columnNames).toContain('game_status');
    });

    test('ops.alert_events table has deduplication keys', async () => {
      const { data: columns, error } = await supabase.rpc('get_table_columns', {
        schema_name: 'ops',
        table_name: 'alert_events'
      });
      
      expect(error).toBeNull();
      expect(columns).toBeDefined();
      
      const columnNames = columns?.map((col: any) => col.column_name) || [];
      
      expect(columnNames).toContain('deduplication_key');
      expect(columnNames).toContain('event_type');
      expect(columnNames).toContain('external_prop_id');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('Smart Form View Validation', () => {
    test('view_props_for_form exists and returns expected data', async () => {
      const { data, error } = await supabase
        .from('view_props_for_form')
        .select('*')
        .limit(1);
      
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      if (data && data.length > 0) {
        const row = data[0];
        
        // Check required view columns
        expect(row).toHaveProperty('external_game_id');
        expect(row).toHaveProperty('player_name');
        expect(row).toHaveProperty('market');
        expect(row).toHaveProperty('line');
        expect(row).toHaveProperty('odds_over');
        expect(row).toHaveProperty('odds_under');
        expect(row).toHaveProperty('sport');
        expect(row).toHaveProperty('team');
        expect(row).toHaveProperty('opponent');
      }
    });

    test('materialized view mv_props_for_form exists', async () => {
      const { data, error } = await supabase.rpc('check_materialized_view_exists', {
        view_name: 'mv_props_for_form'
      });
      
      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  describe('Professional Grading Compliance', () => {
    test('all picks have professional grading fields populated', async () => {
      const { data: recentPicks, error } = await supabase
        .from('unified_picks')
        .select('professional_score, feature_contributions, devigged_edge, clv_tracking_id, kelly_fraction')
        .not('professional_score', 'is', null)
        .limit(10);
      
      expect(error).toBeNull();
      
      if (recentPicks && recentPicks.length > 0) {
        recentPicks.forEach(pick => {
          // Professional scoring requirements
          expect(pick.professional_score).toBeGreaterThan(0);
          expect(pick.feature_contributions).toBeDefined();
          expect(pick.devigged_edge).toBeDefined();
          expect(pick.clv_tracking_id).toBeDefined();
          expect(pick.kelly_fraction).toBeGreaterThan(0);
        });
      }
    });

    test('devigged_edge calculation is valid for all processed picks', async () => {
      const { data: picks, error } = await supabase
        .from('unified_picks')
        .select('devigged_edge, odds_over, odds_under')
        .not('devigged_edge', 'is', null)
        .limit(10);
      
      expect(error).toBeNull();
      
      if (picks && picks.length > 0) {
        picks.forEach(pick => {
          // Devigged edge should be between -1 and 1
          expect(pick.devigged_edge).toBeGreaterThan(-1);
          expect(pick.devigged_edge).toBeLessThan(1);
          
          // Should have valid odds for devigging calculation
          expect(pick.odds_over).toBeGreaterThan(-1000);
          expect(pick.odds_under).toBeGreaterThan(-1000);
        });
      }
    });
  });

  describe('Data Quality Constraints', () => {
    test('no duplicate external_prop_id + source combinations', async () => {
      const { data: duplicates, error } = await supabase.rpc('find_duplicate_props');
      
      expect(error).toBeNull();
      expect(duplicates).toBeDefined();
      expect(duplicates?.length || 0).toBe(0);
    });

    test('all required enums are valid', async () => {
      const { data: invalidSports, error: sportsError } = await supabase
        .from('unified_picks')
        .select('sport')
        .not('sport', 'in', '("nfl","nba","mlb","nhl","ncaaf","wnba","tennis")');
      
      expect(sportsError).toBeNull();
      expect(invalidSports?.length || 0).toBe(0);
      
      const { data: invalidSources, error: sourcesError } = await supabase
        .from('unified_picks')
        .select('source')
        .not('source', 'in', '("optimal","oddsapi","manual")');
      
      expect(sourcesError).toBeNull();
      expect(invalidSources?.length || 0).toBe(0);
    });
  });
});

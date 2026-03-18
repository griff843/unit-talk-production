/**
 * Capper Performance Views — Schema Contract Tests
 * SPRINT-CAPPER-PERFORMANCE-MV-CREATION
 *
 * Validates:
 *   1. Migration SQL file exists and has expected structure
 *   2. MV columns match the contract in packages/contracts/src/supabase.ts
 *   3. View columns match the contract
 *   4. Refresh function is defined
 *   5. Required indexes exist
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, it, expect } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../../supabase/migrations/20260318120000_capper_performance_views.sql'
);

describe('Capper performance views migration', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  it('migration file exists', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  // ── mv_capper_daily_rollup ──────────────────────────────────────────────

  describe('mv_capper_daily_rollup', () => {
    it('creates materialized view', () => {
      expect(sql).toContain('CREATE MATERIALIZED VIEW');
      expect(sql).toContain('mv_capper_daily_rollup');
    });

    it('selects from unified_picks with settlement filter', () => {
      expect(sql).toContain('FROM unified_picks');
      expect(sql).toContain("settlement_status = 'settled'");
      expect(sql).toContain('capper_id IS NOT NULL');
    });

    it('includes all required columns per type contract', () => {
      // Columns from packages/contracts/src/supabase.ts mv_capper_daily_rollup Row
      const requiredColumns = [
        'capper_id',
        'capper_name',
        'day',
        'picks',
        'wins',
        'losses',
        'pushes',
        'units_wagered',
        'units_profit',
        'roi',
      ];
      for (const col of requiredColumns) {
        expect(sql).toContain(col);
      }
    });

    it('joins users table for capper_name', () => {
      expect(sql).toContain('LEFT JOIN users');
      expect(sql).toContain('username AS capper_name');
    });

    it('groups by capper_id and day', () => {
      expect(sql).toContain('GROUP BY up.capper_id, u.username, DATE(up.settled_at)');
    });

    it('has unique index on capper_id + day', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX');
      expect(sql).toContain('idx_mv_capper_rollup_pk');
      expect(sql).toContain('(capper_id, day)');
    });

    it('has day DESC index for range queries', () => {
      expect(sql).toContain('idx_mv_capper_rollup_day');
      expect(sql).toContain('(day DESC)');
    });

    it('calculates profit correctly for win/loss/push', () => {
      // Win: units * (odds_decimal - 1)
      expect(sql).toContain("WHEN up.settlement_result = 'win'");
      expect(sql).toContain('COALESCE(up.odds_decimal, 2.0) - 1');
      // Loss: -units
      expect(sql).toContain("WHEN up.settlement_result = 'loss'");
      expect(sql).toContain('-COALESCE(up.units, 1)');
      // Push: 0
      expect(sql).toContain("WHEN up.settlement_result = 'push' THEN 0");
    });
  });

  // ── v_capper_streaks ────────────────────────────────────────────────────

  describe('v_capper_streaks', () => {
    it('creates view (not materialized)', () => {
      expect(sql).toContain('CREATE OR REPLACE VIEW v_capper_streaks');
    });

    it('includes all required columns per type contract', () => {
      const requiredColumns = [
        'capper_id',
        'capper_name',
        'current_streak_type',
        'current_streak_len',
        'last_10_wins',
        'last_10_losses',
        'last_10_pushes',
        'last_10_summary',
      ];
      for (const col of requiredColumns) {
        expect(sql).toContain(col);
      }
    });

    it('computes streaks from settled picks', () => {
      expect(sql).toContain("settlement_status = 'settled'");
      expect(sql).toContain("settlement_result IN ('win', 'loss', 'push')");
    });

    it('uses ROW_NUMBER ordered by settled_at DESC', () => {
      expect(sql).toContain('ROW_NUMBER()');
      expect(sql).toContain('ORDER BY up.settled_at DESC');
    });
  });

  // ── Refresh function ────────────────────────────────────────────────────

  describe('refresh_capper_daily_rollup()', () => {
    it('creates refresh function', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION refresh_capper_daily_rollup()');
    });

    it('uses REFRESH MATERIALIZED VIEW CONCURRENTLY', () => {
      expect(sql).toContain('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_capper_daily_rollup');
    });

    it('grants execute to service_role', () => {
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION refresh_capper_daily_rollup()');
      expect(sql).toContain('service_role');
    });
  });

  // ── Initial population ──────────────────────────────────────────────────

  it('includes initial MV population', () => {
    // Non-concurrent refresh for first population (no unique index populated yet)
    expect(sql).toContain('REFRESH MATERIALIZED VIEW mv_capper_daily_rollup');
  });
});

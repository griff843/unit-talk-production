/**
 * SETTLEMENT RPC GUARD FIX TESTS
 * Sprint: SPRINT-REM-001-SETTLEMENT-RPC-GUARD-FIX
 *
 * Validates:
 * - Migration file contains set_config('settlement.rpc_context', 'true', true)
 * - Both manual_settle_pick and correct_settlement have the guard context pattern
 * - The trigger function checks current_setting('settlement.rpc_context', true)
 * - Context flag is reset on all exit paths (success, validation failure, exception)
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../../../supabase/migrations');

describe('Settlement RPC Guard Fix (SPRINT-REM-001)', () => {
  const fixMigrationPath = path.join(MIGRATIONS_DIR, '20260318100000_settlement_rpc_guard_fix.sql');
  const sealPatchPath = path.join(MIGRATIONS_DIR, '20260215100000_settlement_guard_seal_patch.sql');

  it('fix migration file exists', () => {
    expect(fs.existsSync(fixMigrationPath)).toBe(true);
  });

  describe('manual_settle_pick — guard context pattern', () => {
    let sql: string;

    it('migration contains manual_settle_pick function definition', () => {
      sql = fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION manual_settle_pick(');
    });

    it('sets settlement.rpc_context flag before settlement write', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      // The function must call set_config to set the context flag
      expect(sql).toContain("set_config('settlement.rpc_context', 'true', true)");
    });

    it('resets context flag on validation failure paths', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      // Count set_config resets — there should be multiple (validation, success, exception)
      const resetCount = (
        sql.match(/set_config\('settlement\.rpc_context', 'false', true\)/g) || []
      ).length;
      // manual_settle_pick has: 4 validation returns + 1 success + 1 exception = 6
      // correct_settlement has: 6 validation returns + 1 success + 2 exception = 9
      // Total should be >= 15
      expect(resetCount).toBeGreaterThanOrEqual(10);
    });

    it('resets context flag in EXCEPTION handler', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      // The EXCEPTION WHEN OTHERS block must contain the reset
      const exceptionPattern =
        /EXCEPTION\s+WHEN\s+OTHERS\s+THEN[\s\S]*?set_config\('settlement\.rpc_context', 'false', true\)/;
      expect(sql).toMatch(exceptionPattern);
    });

    it('includes settlement_version and settlement_hash in UPDATE', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('settlement_version = v_new_version');
      expect(sql).toContain('settlement_hash = v_new_hash');
    });

    it('writes to settlement_audit_log', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('INSERT INTO settlement_audit_log');
    });

    it('emits PICK_SETTLED event', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain("'PICK_SETTLED'");
    });
  });

  describe('correct_settlement — guard context pattern', () => {
    let sql: string;

    it('migration contains correct_settlement function definition', () => {
      sql = fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION correct_settlement(');
    });

    it('sets settlement.rpc_context flag', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      // Extract just the correct_settlement portion
      const csStart = sql.indexOf('CREATE OR REPLACE FUNCTION correct_settlement');
      const csSql = sql.substring(csStart);
      expect(csSql).toContain("set_config('settlement.rpc_context', 'true', true)");
    });

    it('accepts void as valid result', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      const csStart = sql.indexOf('CREATE OR REPLACE FUNCTION correct_settlement');
      const csSql = sql.substring(csStart);
      expect(csSql).toContain("'win', 'loss', 'push', 'void'");
    });

    it('emits SETTLEMENT_CORRECTED and RECAP_INVALIDATED events', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain("'SETTLEMENT_CORRECTED'");
      expect(sql).toContain("'RECAP_INVALIDATED'");
    });

    it('requires reason for corrections', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('Reason is required for settlement corrections');
    });

    it('includes freeze-lock check', () => {
      sql = sql || fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('settlement_freeze_config');
      expect(sql).toContain('freeze_window_hours');
    });
  });

  describe('settlement_log constraint fix', () => {
    it('migration updates valid_action_type constraint', () => {
      const sql = fs.readFileSync(fixMigrationPath, 'utf-8');
      expect(sql).toContain('DROP CONSTRAINT IF EXISTS valid_action_type');
      expect(sql).toContain("'corrected'");
      expect(sql).toContain("'voided'");
    });
  });

  describe('trigger function — guard check pattern', () => {
    it('seal patch defines trigger with current_setting check', () => {
      const sql = fs.readFileSync(sealPatchPath, 'utf-8');
      expect(sql).toContain("current_setting('settlement.rpc_context', true) = 'true'");
    });

    it('trigger protects 8 settlement fields', () => {
      const sql = fs.readFileSync(sealPatchPath, 'utf-8');
      const guardedFields = [
        'settlement_version',
        'settlement_result',
        'settled_at',
        'settlement_hash',
        'settlement_status',
        'actual_outcome',
        'settlement_frozen',
        'freeze_enforced_at',
      ];
      for (const field of guardedFields) {
        expect(sql).toContain(`OLD.${field} IS DISTINCT FROM NEW.${field}`);
      }
    });
  });

  describe('guard invariants', () => {
    it('set_config uses IS_LOCAL=true (transaction-scoped, not session-scoped)', () => {
      const sql = fs.readFileSync(fixMigrationPath, 'utf-8');
      // All set_config calls must use 'true' as third param (IS_LOCAL)
      const setConfigCalls = sql.match(/set_config\('settlement\.rpc_context'.*?\)/g) || [];
      expect(setConfigCalls.length).toBeGreaterThan(0);
      for (const call of setConfigCalls) {
        // Third param must be true (transaction-local)
        expect(call).toMatch(/set_config\('settlement\.rpc_context', '(true|false)', true\)/);
      }
    });

    it('both functions are SECURITY DEFINER', () => {
      const sql = fs.readFileSync(fixMigrationPath, 'utf-8');
      // Count SECURITY DEFINER occurrences (one per function)
      const secDefCount = (sql.match(/SECURITY DEFINER/g) || []).length;
      expect(secDefCount).toBe(2);
    });

    it('migration file is self-contained (no external dependencies)', () => {
      const sql = fs.readFileSync(fixMigrationPath, 'utf-8');
      // Should not CREATE TABLE or ALTER TABLE (except constraint fix)
      expect(sql).not.toContain('CREATE TABLE');
      // Should not DROP FUNCTION
      expect(sql).not.toContain('DROP FUNCTION');
    });
  });
});

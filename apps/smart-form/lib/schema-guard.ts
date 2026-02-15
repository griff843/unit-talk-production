/**
 * SMART-FORM-DATA-CONTRACT-APPLY-001: Schema Guard
 *
 * Runtime guardrail that detects if contract columns exist before writing.
 * This prevents Smart Form downtime when migrations are pending.
 *
 * Usage:
 *   import { schemaGuard, hasContractColumns } from '@/lib/schema-guard';
 *   await schemaGuard.init(supabase);
 *   if (schemaGuard.hasContractColumns()) { ... write contract fields ... }
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Contract columns added by migration 20260211000001_smart_form_data_contract.sql
const CONTRACT_COLUMNS = [
  'pick_type',
  'selection_type',
  'leg_index',
  'total_ticket_odds_american',
  'total_ticket_odds_decimal',
  'total_units',
  'matchup',
  'game_start_time',
  'odds_decimal',
  'units',
] as const;

type ContractColumn = typeof CONTRACT_COLUMNS[number];

interface SchemaCheckResult {
  checked: boolean;
  hasAllColumns: boolean;
  presentColumns: ContractColumn[];
  missingColumns: ContractColumn[];
  checkedAt: string | null;
  error: string | null;
}

class SchemaGuard {
  private _result: SchemaCheckResult = {
    checked: false,
    hasAllColumns: false,
    presentColumns: [],
    missingColumns: [],
    checkedAt: null,
    error: null,
  };
  private _initPromise: Promise<void> | null = null;

  /**
   * Initialize the schema guard by checking column existence.
   * This is cached and only runs once per process lifetime.
   */
  async init(supabase: SupabaseClient): Promise<SchemaCheckResult> {
    // If already checking, wait for that check
    if (this._initPromise) {
      await this._initPromise;
      return this._result;
    }

    // If already checked, return cached result
    if (this._result.checked) {
      return this._result;
    }

    this._initPromise = this._checkSchema(supabase);
    await this._initPromise;
    return this._result;
  }

  private async _checkSchema(supabase: SupabaseClient): Promise<void> {
    try {
      // Query a single row to get column names
      const { data: samplePick, error: queryError } = await supabase
        .from('unified_picks')
        .select('*')
        .limit(1);

      let existingColumns: string[] = [];

      if (queryError) {
        // If query fails completely, assume columns don't exist
        console.warn('[SCHEMA-GUARD] Failed to query unified_picks:', queryError.message);
        this._result = {
          checked: true,
          hasAllColumns: false,
          presentColumns: [],
          missingColumns: [...CONTRACT_COLUMNS],
          checkedAt: new Date().toISOString(),
          error: queryError.message,
        };
        return;
      }

      if (samplePick && samplePick.length > 0) {
        existingColumns = Object.keys(samplePick[0]);
      } else {
        // No data - probe columns individually
        for (const col of CONTRACT_COLUMNS) {
          const { error: probeError } = await supabase
            .from('unified_picks')
            .select(col)
            .limit(0);

          if (!probeError) {
            existingColumns.push(col);
          }
        }
      }

      const presentColumns = CONTRACT_COLUMNS.filter(col => existingColumns.includes(col));
      const missingColumns = CONTRACT_COLUMNS.filter(col => !existingColumns.includes(col));

      this._result = {
        checked: true,
        hasAllColumns: missingColumns.length === 0,
        presentColumns: presentColumns as ContractColumn[],
        missingColumns: missingColumns as ContractColumn[],
        checkedAt: new Date().toISOString(),
        error: null,
      };

      // Log the result for debugging
      if (this._result.hasAllColumns) {
        console.log('[SCHEMA-GUARD] Contract columns present:', presentColumns.length + '/' + CONTRACT_COLUMNS.length);
      } else {
        console.warn(
          '[SCHEMA-GUARD] WARNING: Contract columns MISSING - using legacy mode.',
          '\n  Missing:', missingColumns.join(', ')
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[SCHEMA-GUARD] Schema check failed:', errorMsg);
      this._result = {
        checked: true,
        hasAllColumns: false,
        presentColumns: [],
        missingColumns: [...CONTRACT_COLUMNS],
        checkedAt: new Date().toISOString(),
        error: errorMsg,
      };
    }
  }

  /**
   * Returns true if all contract columns are present.
   * Must call init() first.
   */
  hasContractColumns(): boolean {
    if (!this._result.checked) {
      console.warn('[SCHEMA-GUARD] Warning: hasContractColumns() called before init()');
      return false; // Fail-safe: don't write contract columns if not checked
    }
    return this._result.hasAllColumns;
  }

  /**
   * Returns the full schema check result.
   */
  getResult(): SchemaCheckResult {
    return { ...this._result };
  }

  /**
   * Force a re-check on next init() call.
   * Useful for testing or after migration.
   */
  reset(): void {
    this._result = {
      checked: false,
      hasAllColumns: false,
      presentColumns: [],
      missingColumns: [],
      checkedAt: null,
      error: null,
    };
    this._initPromise = null;
  }
}

// Singleton instance
export const schemaGuard = new SchemaGuard();

// Convenience function
export function hasContractColumns(): boolean {
  return schemaGuard.hasContractColumns();
}

// Export the type for testing
export type { SchemaCheckResult };

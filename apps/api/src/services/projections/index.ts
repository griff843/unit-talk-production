/* eslint-disable max-lines-per-function, complexity, max-depth, no-console, security/detect-object-injection */
/**
 * Projections Service
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Provides projection lookup from player_projections table.
 * Supports NBA/MLB baseline models with versioning.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Current active model versions by sport */
const ACTIVE_MODEL_VERSIONS: Record<string, string> = {
  NBA: 'v1.0.0-nba-baseline',
  MLB: 'v1.0.0-mlb-baseline',
  NFL: 'v1.0.0-nfl-baseline',
  NHL: 'v1.0.0-nhl-baseline',
};

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function isProjectionsEnabled(): boolean {
  return process.env.PROJECTIONS_ENABLED !== 'false';
}

// ============================================================================
// TYPES
// ============================================================================

/** Database row from player_projections table */
export interface ProjectionRow {
  id: string;
  sport: string;
  player_name: string;
  participant_id: string | null;
  stat_type: string;
  game_date: string;
  projected_value: number;
  confidence: number;
  model_version: string;
  computed_at: string;
  opponent: string | null;
  venue: string | null;
  source_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Result returned by getProjection */
export interface ProjectionResult {
  player: string;
  marketType: string;
  projectedLine: number;
  confidence: number;
  source: string;
  timestamp: string;
  modelVersion: string;
  sourceData: Record<string, unknown>;
}

/** Options for getProjection */
export interface ProjectionOptions {
  sport?: string;
  date?: string;
  modelVersion?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function rowToResult(row: ProjectionRow): ProjectionResult {
  return {
    player: row.player_name,
    marketType: row.stat_type,
    projectedLine: row.projected_value,
    confidence: row.confidence,
    source: `projection:${row.model_version}`,
    timestamp: row.computed_at,
    modelVersion: row.model_version,
    sourceData: row.source_data || {},
  };
}

function normalizeStatType(statType: string): string {
  return statType.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function getModelVersion(
  sport: string | undefined,
  options?: ProjectionOptions
): string | undefined {
  if (options?.modelVersion) return options.modelVersion;
  if (sport) return ACTIVE_MODEL_VERSIONS[sport];
  return undefined;
}

// ============================================================================
// PROJECTION ENGINE
// ============================================================================

export class ProjectionEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get projection for a player/market combination
   */
  async getProjection(
    player: string,
    marketType: string,
    options?: ProjectionOptions
  ): Promise<ProjectionResult | null> {
    if (!isProjectionsEnabled()) return null;

    const sport = options?.sport?.toUpperCase();
    const gameDate = options?.date || new Date().toISOString().split('T')[0];
    const modelVersion = getModelVersion(sport, options);

    try {
      let query = this.supabase
        .from('player_projections')
        .select('*')
        .ilike('player_name', player.trim())
        .eq('stat_type', normalizeStatType(marketType))
        .eq('game_date', gameDate);

      if (sport) query = query.eq('sport', sport);
      if (modelVersion) query = query.eq('model_version', modelVersion);

      const { data, error } = await query.order('computed_at', { ascending: false }).limit(1);

      if (error) {
        console.error('[ProjectionEngine] Query error:', error.message);
        return null;
      }

      if (!data || data.length === 0) return null;
      return rowToResult(data[0] as ProjectionRow);
    } catch (err) {
      console.error('[ProjectionEngine] Unexpected error:', err);
      return null;
    }
  }

  /**
   * Get multiple projections for a batch of players
   */
  async getProjectionsBatch(
    requests: Array<{ player: string; marketType: string }>,
    options?: ProjectionOptions
  ): Promise<Map<string, ProjectionResult>> {
    const results = new Map<string, ProjectionResult>();
    if (!isProjectionsEnabled() || requests.length === 0) return results;

    const sport = options?.sport?.toUpperCase();
    const gameDate = options?.date || new Date().toISOString().split('T')[0];
    const modelVersion = getModelVersion(sport, options);
    const statTypes = [...new Set(requests.map(r => normalizeStatType(r.marketType)))];

    try {
      let query = this.supabase
        .from('player_projections')
        .select('*')
        .in('stat_type', statTypes)
        .eq('game_date', gameDate);

      if (sport) query = query.eq('sport', sport);
      if (modelVersion) query = query.eq('model_version', modelVersion);

      const { data, error } = await query;
      if (error) {
        console.error('[ProjectionEngine] Batch query error:', error.message);
        return results;
      }
      if (!data) return results;

      // Build lookup map (most recent per player+stat_type)
      const rowMap = new Map<string, ProjectionRow>();
      for (const row of data as ProjectionRow[]) {
        const key = `${row.player_name.toLowerCase()}:${row.stat_type}`;
        const existing = rowMap.get(key);
        if (!existing || new Date(row.computed_at) > new Date(existing.computed_at)) {
          rowMap.set(key, row);
        }
      }

      // Match to requests
      for (const req of requests) {
        const key = `${req.player.trim().toLowerCase()}:${normalizeStatType(req.marketType)}`;
        const row = rowMap.get(key);
        if (row) {
          results.set(`${req.player}:${req.marketType}`, rowToResult(row));
        }
      }

      return results;
    } catch (err) {
      console.error('[ProjectionEngine] Batch unexpected error:', err);
      return results;
    }
  }

  /**
   * Check if projections are available for a sport
   */
  isAvailable(sport: string): boolean {
    if (!isProjectionsEnabled()) return false;
    return sport.toUpperCase() in ACTIVE_MODEL_VERSIONS;
  }

  /**
   * Get the active model version for a sport
   */
  getActiveModelVersion(sport: string): string | undefined {
    return ACTIVE_MODEL_VERSIONS[sport.toUpperCase()];
  }

  /**
   * Get coverage stats for a specific date and sport
   */
  async getCoverage(
    sport: string,
    date: string
  ): Promise<{
    total: number;
    byStatType: Record<string, number>;
    modelVersion: string | undefined;
  }> {
    const modelVersion = ACTIVE_MODEL_VERSIONS[sport.toUpperCase()];
    if (!isProjectionsEnabled() || !modelVersion) {
      return { total: 0, byStatType: {}, modelVersion: undefined };
    }

    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('stat_type')
        .eq('sport', sport.toUpperCase())
        .eq('game_date', date)
        .eq('model_version', modelVersion);

      if (error || !data) {
        return { total: 0, byStatType: {}, modelVersion };
      }

      const byStatType: Record<string, number> = {};
      for (const row of data) {
        byStatType[row.stat_type] = (byStatType[row.stat_type] || 0) + 1;
      }

      return { total: data.length, byStatType, modelVersion };
    } catch (err) {
      console.error('[ProjectionEngine] Coverage query error:', err);
      return { total: 0, byStatType: {}, modelVersion };
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _projectionEngine: ProjectionEngine | null = null;

export function getProjectionEngine(supabase: SupabaseClient): ProjectionEngine {
  if (!_projectionEngine) {
    _projectionEngine = new ProjectionEngine(supabase);
  }
  return _projectionEngine;
}

export function resetProjectionEngine(): void {
  _projectionEngine = null;
}

export { ACTIVE_MODEL_VERSIONS, isProjectionsEnabled };

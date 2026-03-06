/* eslint-disable max-lines-per-function, no-console, security/detect-object-injection */
/**
 * Projection Agent
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Orchestrates projection computation and storage for player props.
 * Supports NBA/MLB baseline models with deterministic calculations.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { MlbCalculator, MLB_MODEL_VERSION } from './mlbCalculator';
import { NbaCalculator, NBA_MODEL_VERSION } from './nbaCalculator';
import {
  PlayerStatsInput,
  ProjectionCalculation,
  ProjectionCalculator,
  ComputeJobResult,
  CoverageEntry,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Calculator registry by sport */
const CALCULATORS: Record<string, ProjectionCalculator> = {
  NBA: NbaCalculator,
  MLB: MlbCalculator,
};

/** Model versions by sport */
export const MODEL_VERSIONS: Record<string, string> = {
  NBA: NBA_MODEL_VERSION,
  MLB: MLB_MODEL_VERSION,
};

// ============================================================================
// PROJECTION AGENT
// ============================================================================

export class ProjectionAgent {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Compute projection for a single player/stat
   *
   * @param input - Player stats input
   * @returns Projection calculation result
   */
  compute(input: PlayerStatsInput): ProjectionCalculation | null {
    const calculator = CALCULATORS[input.sport];

    if (!calculator) {
      console.warn(`[ProjectionAgent] No calculator for sport: ${input.sport}`);
      return null;
    }

    const normalizedStatType = input.statType.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!calculator.supportedStatTypes.includes(normalizedStatType)) {
      console.warn(`[ProjectionAgent] Unsupported stat type for ${input.sport}: ${input.statType}`);
      return null;
    }

    return calculator.calculate({
      ...input,
      statType: normalizedStatType,
    });
  }

  /**
   * Compute and persist projection to database
   *
   * @param input - Player stats input
   * @returns Projection calculation result or null on failure
   */
  async computeAndPersist(input: PlayerStatsInput): Promise<ProjectionCalculation | null> {
    const projection = this.compute(input);

    if (!projection) {
      return null;
    }

    try {
      const { error } = await this.supabase.from('player_projections').upsert(
        {
          sport: projection.sport,
          player_name: projection.playerName,
          stat_type: projection.statType,
          game_date: projection.gameDate,
          projected_value: projection.projectedValue,
          confidence: projection.confidence,
          model_version: projection.modelVersion,
          computed_at: new Date().toISOString(),
          opponent: input.opponent ?? null,
          venue: input.venue ?? null,
          source_data: projection.sourceData,
        },
        {
          onConflict: 'sport,player_name,stat_type,game_date,model_version',
        }
      );

      if (error) {
        console.error(
          `[ProjectionAgent] Persist error for ${projection.playerName}:`,
          error.message
        );
        return null;
      }

      return projection;
    } catch (err) {
      console.error(`[ProjectionAgent] Unexpected persist error:`, err);
      return null;
    }
  }

  /**
   * Batch compute and persist projections
   *
   * @param inputs - Array of player stats inputs
   * @returns Array of successful projection calculations
   */
  async computeBatch(inputs: PlayerStatsInput[]): Promise<ProjectionCalculation[]> {
    const results: ProjectionCalculation[] = [];

    for (const input of inputs) {
      const projection = await this.computeAndPersist(input);
      if (projection) {
        results.push(projection);
      }
    }

    return results;
  }

  /**
   * Run compute job for a sport and date
   *
   * @param sport - Sport code (NBA, MLB)
   * @param gameDate - Game date (YYYY-MM-DD)
   * @param playerInputs - Array of player stats inputs (must be provided)
   * @returns Compute job result
   */
  async runComputeJob(
    sport: string,
    gameDate: string,
    playerInputs: PlayerStatsInput[]
  ): Promise<ComputeJobResult> {
    const startTime = Date.now();
    const normalizedSport = sport.toUpperCase();

    const result: ComputeJobResult = {
      sport: normalizedSport,
      gameDate,
      playersProcessed: 0,
      projectionsCreated: 0,
      projectionsSkipped: 0,
      errors: 0,
      duration: 0,
      coverage: [],
    };

    if (!CALCULATORS[normalizedSport]) {
      console.error(`[ProjectionAgent] No calculator for sport: ${normalizedSport}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    // Filter inputs for this sport and date
    const filteredInputs = playerInputs.filter(
      input => input.sport.toUpperCase() === normalizedSport && input.gameDate === gameDate
    );

    result.playersProcessed = filteredInputs.length;

    // Track coverage by stat type
    const coverageMap = new Map<
      string,
      { total: number; projected: number; confidenceSum: number }
    >();

    for (const input of filteredInputs) {
      try {
        const projection = await this.computeAndPersist(input);

        const statType = input.statType.toLowerCase();
        const entry = coverageMap.get(statType) || { total: 0, projected: 0, confidenceSum: 0 };
        entry.total++;

        if (projection) {
          result.projectionsCreated++;
          entry.projected++;
          entry.confidenceSum += projection.confidence;
        } else {
          result.projectionsSkipped++;
        }

        coverageMap.set(statType, entry);
      } catch (err) {
        console.error(`[ProjectionAgent] Error processing ${input.playerName}:`, err);
        result.errors++;
      }
    }

    // Build coverage report
    for (const [statType, entry] of coverageMap) {
      const coverageEntry: CoverageEntry = {
        sport: normalizedSport,
        statType,
        totalPlayers: entry.total,
        withProjection: entry.projected,
        coveragePct: entry.total > 0 ? (entry.projected / entry.total) * 100 : 0,
        avgConfidence: entry.projected > 0 ? entry.confidenceSum / entry.projected : 0,
      };
      result.coverage.push(coverageEntry);
    }

    result.duration = Date.now() - startTime;

    console.log(
      `[ProjectionAgent] Compute job complete for ${normalizedSport} ${gameDate}: ` +
        `${result.projectionsCreated} created, ${result.projectionsSkipped} skipped, ${result.errors} errors ` +
        `(${result.duration}ms)`
    );

    return result;
  }

  /**
   * Get supported sports
   */
  getSupportedSports(): string[] {
    return Object.keys(CALCULATORS);
  }

  /**
   * Get supported stat types for a sport
   */
  getSupportedStatTypes(sport: string): string[] {
    const calculator = CALCULATORS[sport.toUpperCase()];
    return calculator?.supportedStatTypes ?? [];
  }

  /**
   * Get model version for a sport
   */
  getModelVersion(sport: string): string | undefined {
    return MODEL_VERSIONS[sport.toUpperCase()];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _projectionAgent: ProjectionAgent | null = null;

export function getProjectionAgent(supabase: SupabaseClient): ProjectionAgent {
  if (!_projectionAgent) {
    _projectionAgent = new ProjectionAgent(supabase);
  }
  return _projectionAgent;
}

/**
 * Reset the singleton (for testing)
 */
export function resetProjectionAgent(): void {
  _projectionAgent = null;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { NbaCalculator, NBA_MODEL_VERSION } from './nbaCalculator';
export { MlbCalculator, MLB_MODEL_VERSION } from './mlbCalculator';
export * from './types';

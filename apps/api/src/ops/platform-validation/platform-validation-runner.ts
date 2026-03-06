/**
 * Platform Validation Runner — SPRINT-041A
 *
 * Orchestrates all 8 operational health checks into a single deterministic report.
 * This is the primary entry point for the platform validation module.
 *
 * Usage:
 *   import { generatePlatformValidationReport } from '../ops/platform-validation';
 *   const report = generatePlatformValidationReport(input);
 */

import {
  checkIngestionHealth,
  checkScoringHealth,
  checkPromotionHealth,
  checkDiscordHealth,
  checkSettlementHealth,
  checkRecapHealth,
  checkTemporalHealth,
  checkModelPerformance,
  determineProductionReadiness,
} from './platform-validation-report';
import { PLATFORM_VALIDATION_VERSION } from './platform-validation-types';

import type {
  IngestionSnapshot,
  ScoringSnapshot,
  PromotionSnapshot,
  DiscordSnapshot,
  SettlementSnapshot,
  RecapSnapshot,
  TemporalSnapshot,
  PerformanceRecord,
  PlatformValidationReport,
} from './platform-validation-types';

/** All snapshot data needed to produce the validation report. */
export interface PlatformValidationInput {
  ingestion: IngestionSnapshot;
  scoring: ScoringSnapshot;
  promotion: PromotionSnapshot;
  discord: DiscordSnapshot;
  settlement: SettlementSnapshot;
  recap: RecapSnapshot;
  temporal: TemporalSnapshot;
  performanceRecords: PerformanceRecord[];
}

/**
 * Generate a complete platform validation report.
 *
 * Deterministic: same inputs always produce the same output
 * (except for the `generated_at` timestamp).
 *
 * @param input - Snapshot data from all pipeline stages.
 * @param timestamp - Optional fixed timestamp for deterministic output.
 */
export function generatePlatformValidationReport(
  input: PlatformValidationInput,
  timestamp?: string
): PlatformValidationReport {
  const ingestionHealth = checkIngestionHealth(input.ingestion);
  const scoringHealth = checkScoringHealth(input.scoring);
  const promotionHealth = checkPromotionHealth(input.promotion);
  const discordHealth = checkDiscordHealth(input.discord);
  const settlementHealth = checkSettlementHealth(input.settlement);
  const recapHealth = checkRecapHealth(input.recap);
  const temporalHealth = checkTemporalHealth(input.temporal);
  const modelPerformance = checkModelPerformance(input.performanceRecords);

  const { productionReady, blockers } = determineProductionReadiness(
    ingestionHealth,
    scoringHealth,
    promotionHealth,
    discordHealth,
    settlementHealth,
    recapHealth,
    temporalHealth,
    modelPerformance
  );

  return {
    report_version: PLATFORM_VALIDATION_VERSION,
    generated_at: timestamp ?? new Date().toISOString(),
    ingestionHealth,
    scoringHealth,
    promotionHealth,
    discordHealth,
    settlementHealth,
    recapHealth,
    temporalHealth,
    modelPerformance,
    productionReady,
    blockers,
  };
}

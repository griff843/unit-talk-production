/**
 * Platform Validation — SPRINT-041A
 *
 * End-to-end operational validation for the Unit Talk platform.
 * Barrel export for the platform-validation module.
 */

export { generatePlatformValidationReport } from './platform-validation-runner';
export type { PlatformValidationInput } from './platform-validation-runner';

export {
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

export {
  PLATFORM_VALIDATION_VERSION,
  type IngestionSnapshot,
  type ScoringSnapshot,
  type PromotionSnapshot,
  type DiscordSnapshot,
  type SettlementSnapshot,
  type RecapSnapshot,
  type TemporalSnapshot,
  type PerformanceRecord,
  type IngestionHealthResult,
  type ScoringHealthResult,
  type PromotionHealthResult,
  type DiscordHealthResult,
  type SettlementHealthResult,
  type RecapHealthResult,
  type TemporalHealthResult,
  type ModelPerformanceResult,
  type BandPerformanceMetrics,
  type PlatformValidationReport,
  type CheckStatus,
} from './platform-validation-types';

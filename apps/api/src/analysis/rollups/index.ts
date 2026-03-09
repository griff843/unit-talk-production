/**
 * Daily Rollups & Drift Detection — SPRINT-038
 *
 * Barrel export for the rollups module.
 */

export {
  generateDailyRollup,
  type DailyRollupRecord,
  type DailyRollupReport,
  type DailyBandSummary,
  type DailyAttributionCounts,
  type DailyDowngradeCounts,
} from './daily-rollup';

export {
  detectDrift,
  DRIFT_THRESHOLDS,
  type DriftFlag,
  type DriftCategory,
  type DriftReport,
} from './drift-detector';

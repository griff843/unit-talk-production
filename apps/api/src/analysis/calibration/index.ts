/**
 * Calibration Module — SPRINT-039
 *
 * Governed probability calibration for the intelligence pipeline.
 * Barrel export for all calibration functionality.
 */

export { calibrate, calibrateBatch } from './calibration-engine';

export {
  computeCalibrationMetrics,
  compareCalibration,
  compareCalibrationByBand,
} from './calibration-analysis';

export {
  CALIBRATION_VERSION,
  DEFAULT_CALIBRATION_PROFILE,
  IDENTITY_CALIBRATION_PROFILE,
} from './calibration-version';

export type {
  CalibrationInput,
  CalibrationOutput,
  CalibrationConfig,
  CalibrationProfile,
  CalibrationBin,
  PlattParams,
  CalibrationMetrics,
  CalibrationComparison,
  CalibrationOutcomeRecord,
  ReliabilityBucket,
} from './calibration-types';

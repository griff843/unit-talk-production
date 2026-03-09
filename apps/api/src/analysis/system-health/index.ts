/**
 * System Health Snapshot — SPRINT-040A
 *
 * Full intelligence pipeline health evaluation.
 * Barrel export for the system-health module.
 */

export { generateSystemHealthReport } from './system-health-runner';

export {
  computeCLVByBand,
  computeROIByBand,
  computeCalibrationCurve,
  computeBandDistribution,
  computeDowngradeEffectiveness,
  computeSuppressionEffectiveness,
  computeDriftStatus,
  computeCalibrationImpact,
} from './system-health-report';

export {
  SYSTEM_HEALTH_REPORT_VERSION,
  type SystemHealthRecord,
  type SystemHealthReport,
  type BandCLVMetrics,
  type BandROIMetrics,
  type BandDistributionSection,
  type BandDistributionMetrics,
  type CalibrationCurveSection,
  type DowngradeEffectivenessSection,
  type SuppressionEffectivenessSection,
  type DriftStatusSection,
  type CalibrationImpactSection,
} from './system-health-types';

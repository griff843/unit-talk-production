/**
 * Edge Validation Module
 * Sprint: SPRINT-PHASE2-CLV-EDGE-VALIDATION
 * Issue: UNI-16
 */

export { analyzeCLV, MIN_CLV_SAMPLE } from './clvAnalyzer';
export type { CLVRecord, CLVSliceSummary, CLVSummary, CLVAnalysisResult } from './clvAnalyzer';

export { validateEdge, MIN_EDGE_SAMPLE_SIZE, DEFAULT_ALPHA } from './edgeValidator';
export type {
  EdgeValidationResult,
  EdgeValidationOk,
  EdgeValidationFail,
  EdgeValidationFailReason,
} from './edgeValidator';

export { computeConfidenceInterval, MIN_CI_SAMPLE } from './edgeCalibrator';
export type { CIResult, CIComputeResult, CIFailReason, ConfidenceLevel } from './edgeCalibrator';

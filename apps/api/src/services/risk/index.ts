/**
 * Risk Domain
 * SPRINT-REPO-TRUTH-LOCK-002: Consolidated risk logic.
 *
 * Contains:
 * - RiskEngine (singleton, fail-closed)
 * - PortfolioRiskManager
 * - DriftEvaluator, ExposureCalculator, RiskAlertEmitter
 * - Edge validation modules
 * - Risk types
 */

export { RiskEngine } from './RiskEngine';
export { portfolioRiskManager } from './PortfolioRiskManager';
export type {
  PortfolioLimits,
  CorrelationAnalysis,
  PortfolioRisk,
  PositionSizingDecision,
} from './PortfolioRiskManager';
export { evaluateDrift, recordDriftSnapshot } from './DriftEvaluator';
export { computeExposure } from './ExposureCalculator';
export {
  computeKellySize,
  computeKellyFraction,
  americanToDecimal,
  DEFAULT_BANKROLL_CONFIG,
} from './KellySizer';
export type { BankrollConfig, KellySizingResult } from './KellySizer';
export { emitExposureBreach, emitDriftThrottle, emitEngineError } from './RiskAlertEmitter';
export * from './risk-types';

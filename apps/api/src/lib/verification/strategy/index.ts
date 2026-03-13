/**
 * VERIFICATION & SIMULATION CONTROL PLANE — Strategy Module
 * Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R5
 *
 * Public API of the R5 strategy evaluation layer.
 * Import from here, not from internal sub-modules.
 */

// Types
export type {
  LineMovementModel,
  LatencyModel,
  SlippageModel,
  LiquidityModel,
  RejectionModel,
  StakingMethod,
  ExecutionSimConfig,
  SimulatedExecution,
  StrategyConfig,
  BankrollStep,
  RiskEventType,
  RiskEvent,
  CorrelationEvent,
  StrategyEvaluationResult,
  StrategyDelta,
  StrategyWinner,
  StrategyComparisonReport,
} from './types';

// ExecutionSimulator
export {
  ExecutionSimulator,
  americanToDecimal,
  decimalToAmerican,
  americanToImpliedProb,
} from './execution-simulator';
export type { ExecutionContext } from './execution-simulator';

// BankrollSimulator
export { BankrollSimulator, normalizePick } from './bankroll-simulator';
export type { NormalizedPick, BankrollSimulationOutput } from './bankroll-simulator';

// StrategyEvaluationEngine
export {
  StrategyEvaluationEngine,
  PREDEFINED_STRATEGIES,
  resolveStrategy,
  normalizePicks,
} from './strategy-evaluation-engine';

// StrategyComparator
export { StrategyComparator } from './strategy-comparator';

// StrategyProofWriter
export { StrategyProofWriter } from './strategy-proof-writer';

/**
 * Phase 7 Risk Management System
 *
 * Fortune 100-grade risk management for Unit Talk syndicate-level ML betting system.
 * Implements comprehensive risk controls including Kelly sizing, correlation management,
 * portfolio optimization, and automated risk controls.
 *
 * @version 1.0.0
 * @author Unit Talk Platform Engineering
 */

export { RiskManagementEngine } from './core/RiskManagementEngine';
export { KellySizingEngine } from './kelly/KellySizingEngine';
export { CorrelationManager } from './correlation/CorrelationManager';
export { PortfolioOptimizer } from './portfolio/PortfolioOptimizer';
export { AutomatedRiskControls } from './controls/AutomatedRiskControls';

// Type exports
export type {
  RiskProfile,
  PortfolioRisk,
  RiskAlert,
  KellyResult,
  CorrelationMatrix,
  PositionRisk,
  RiskMetrics,
  VaRResult,
  ExpectedShortfallResult,
  RiskControlAction
} from './types';

// Configuration exports
export type {
  RiskManagementConfig,
  KellyConfig,
  CorrelationConfig,
  PortfolioConfig,
  AlertConfig
} from './config';
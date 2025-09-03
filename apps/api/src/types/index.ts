// Type definitions index - Explicit exports to avoid conflicts

// Core types
export * from './common';
export * from './validation';

// Agent types (explicit to avoid conflicts)
export {
  AgentConfig as BaseAgentConfig,
  AgentStatus,
  AgentMetrics
} from './agent';

// Activity types
export * from './activities';

// AI types (explicit to avoid conflicts)
export {
  AIProvider,
  AIAdvice,
  ConsensusAdvice,
  MarketContext,
  OpenAIConfig,
  AnthropicConfig,
  CircuitBreakerConfig,
  RateLimiterConfig,
  AIServiceError,
  RateLimitError,
  CircuitBreakerError,
  AIValidationError,
  TimeoutError
} from './ai';

// ML types (explicit to avoid conflicts)
export {
  FeatureSet,
  HistoricalFeatures,
  MarketFeatures,
  ContextFeatures,
  FeatureMetadata,
  ModelConfig as MLModelConfig,
  ModelMetrics,
  PredictionResult,
  ModelPerformance as MLModelPerformance,
  TrainingConfig
} from './ml';

// Adaptive ML types
export * from './adaptive-ml';

// Analytics and monitoring
export * from './analytics';
export {
  AlertLevel,
  SystemComponent,
  MetricStream,
  Alert,
  RecoveryAction,
  MonitoringConfig as MonitoringConfigType,
  HealthStatus as MonitoringHealthStatus,
  SystemStatus
} from './monitoring';

// Business logic types

// Pick types
export * from './pick';
export * from './picks';

// Portfolio types (explicit to avoid conflicts)
export {
  PortfolioConfig,
  PortfolioPosition as PortfolioPositionType,
  OptimizationResult as PortfolioOptimizationResult,
  PositionAdjustment,
  PortfolioStrategy,
  RiskMetrics as PortfolioRiskMetrics,
  PortfolioPerformance,
  PortfolioConstraints,
  PortfolioAllocation,
  RebalancingEvent,
  PortfolioAnalytics
} from './portfolio';

// Risk types (explicit to avoid conflicts)
export {
  RiskLimits,
  RiskMetrics as RiskMetricsType,
  PortfolioPosition as RiskPortfolioPosition,
  OptimizationResult as RiskOptimizationResult
} from './risk';

// Configuration
export * from './config';

// Alerts
export * from './alerts';

// Shared types (explicit to avoid conflicts)
export {
  HealthStatus,
  ValidationResult
} from './shared';

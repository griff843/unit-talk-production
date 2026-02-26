/**
 * Enhanced Health Check System
 * PHASE1-ENFORCEMENT-LOCK-001: Re-exports from split modules for lint compliance
 *
 * This file maintains backwards compatibility with existing imports.
 * Implementation split into:
 * - enhanced-health/types.ts - Type definitions
 * - enhanced-health/dependencies.ts - Dependency configurations
 * - enhanced-health/checker.ts - Main health checker class
 * - enhanced-health/middleware.ts - Express middleware
 */

export {
  HealthCheck,
  SystemHealth,
  DependencyConfig,
  TimeoutHandle,
} from './enhanced-health/types';

export { EnhancedHealthChecker, healthChecker } from './enhanced-health/checker';

export { healthCheckMiddleware, handleHealthCheck } from './enhanced-health/middleware';

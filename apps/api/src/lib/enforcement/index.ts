/**
 * PHASE_9A_ENFORCEMENT_ACTIVATION
 *
 * Enforcement Module Index
 *
 * This module exports all enforcement-related functionality required by
 * Phase 7 and Phase 8 contracts:
 *
 * - FAIL_CLOSED_BOOT_SPEC_v1.0
 * - ROLLOUT_MODE_CANON_v1.0
 * - ENFORCEMENT_ACTIVATION_LAW_v1.0
 *
 * Ratified: 2026-02-27
 */

// Fail-Closed Boot (BP_ENV, BP_SECRET, BP_CONFIG, BP_DB, BP_DEPS)
export {
  enforceFailClosedBoot,
  executeBootSequence,
  generateBootReceipt,
  EXIT_CODES,
  BOOT_PRECONDITIONS,
  type BootCheckResult,
  type BootSequenceResult,
  type ExitCode,
  type BootPrecondition,
} from './fail-closed-boot';

// Rollout Mode Canon
export {
  validateRolloutMode,
  parseRolloutMode,
  parseEnvironment,
  assertNoShadowInProd,
  generateModeValidationReceipt,
  isValidRolloutMode,
  isValidEnvironment,
  ROLLOUT_MODES,
  ENVIRONMENTS,
  UNKNOWN_MODE,
  type RolloutMode,
  type Environment,
  type ModeValidationResult,
  type UnknownMode,
} from './rollout-mode';

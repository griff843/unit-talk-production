/**
 * LIFECYCLE CONTRACT MODULE
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Central module for pick lifecycle management.
 * Exports validators, guards, and utilities.
 */

// Types
export * from './types';

// Errors
export * from './errors';

// Transition Validation
export {
  deriveLifecycleStage,
  deriveLifecycleState,
  isTransitionAllowed,
  getTransitionDefinition,
  assertTransition,
  performTransition,
  validateTimestampInvariants,
  validateStateInvariants,
  validateInvariants,
  getAllowedTransitionsFrom,
  getForbiddenTransitions,
} from './transition-validator';

// Writer Authority
export {
  getFieldAuthority,
  canWriteField,
  isFieldImmutable,
  getAuthorizedFields,
  getAllowedWriters,
  assertWriterAuthority,
  assertImmutability,
  validateWrite,
  getWriterAuthorityMap,
  getFieldsByWriter,
  getImmutableFields,
} from './writer-authority';

// Write Adapter
export {
  lifecycleInsert,
  lifecycleUpdate,
  lifecycleClaimForPosting,
  lifecycleSettle,
} from './write-adapter';
export type { WriteContext, WriteResult } from './write-adapter';

// Idempotency Guards
export {
  checkSubmitIdempotency,
  assertSubmitIdempotency,
  checkPostIdempotency,
  assertPostIdempotency,
  atomicClaimForPost,
  atomicClaimParlayForPost,
  checkSettleIdempotency,
  assertSettleIdempotency,
  atomicClaimForSettle,
  filterDuplicates,
  // Reset operations (Sprint: POSTING-SETTLEMENT-EXACTNESS-040)
  resetPostingClaim,
  resetSettlementForRetry,
} from './idempotency';
export type {
  IdempotencyCheckResult,
  PostingDriftMode,
  SettlementDriftMode,
  ResetContext,
  ResetResult,
} from './idempotency';

// Single-Writer Gate
export { runSingleWriterGate } from './single-writer-gate';
export { isFileAllowlisted, getAllowlistEntry, getAllowlistCount, generateMigrationReport } from './single-writer-allowlist';

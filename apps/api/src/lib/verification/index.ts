/**
 * VERIFICATION & SIMULATION CONTROL PLANE
 * Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R1
 * Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R2
 *
 * Public API of the verification module.
 * Import from here, not from internal sub-modules.
 */

// Clock abstraction
export type { ClockProvider, MutableClockProvider, ClockAdvancement } from './clock';
export { RealClockProvider, VirtualEventClock, resolveNow } from './clock';

// Adapter contracts
export type {
  ExecutionMode,
  PublishReceipt,
  PublishAdapter,
  AlertSeverity,
  NotificationAlert,
  NotificationAdapter,
  FeedEvent,
  FeedAdapter,
  SettlementData,
  SettlementAdapter,
  RecapPeriod,
  RecapOutput,
  RecapAdapter,
  AdapterManifest,
} from './adapters';
export { isProductionMode, isNonProductionMode, assertManifestConsistency } from './adapters';

// Safe non-production adapters
export type { RecordedPublish } from './adapters/recording-publish';
export { RecordingPublishAdapter } from './adapters/recording-publish';

export type { SuppressedAlert } from './adapters/null-notification';
export { NullNotificationAdapter } from './adapters/null-notification';

// RunController
export type { RunConfig, RunManifest } from './run-controller';
export { RunController, parseExecutionMode, VALID_EXECUTION_MODES } from './run-controller';

// R2: Event store
export type { ReplayEvent, ReplayEventType } from './event-store';
export { JournalEventStore, storeFromJsonl } from './event-store';

// R2: Production event recorder
export { ProductionEventRecorder } from './production-event-recorder';
export type {
  GradingSnapshot,
  PostingSnapshot,
  SettlementSnapshot,
} from './production-event-recorder';

// R2: Isolated storage
export { IsolatedPickStore } from './isolated-pick-store';
export type { UpdateCondition, InsertResult, GetResult, UpdateResult } from './isolated-pick-store';

// R2: Replay lifecycle runner
export { ReplayLifecycleRunner } from './replay-lifecycle-runner';
export type { ReplayOperationResult, LifecycleTrace } from './replay-lifecycle-runner';

// R2: Replay orchestrator
export { ReplayOrchestrator } from './replay-orchestrator';
export type { ReplayRunConfig, ReplayResult, ReplayError } from './replay-orchestrator';

// R2: Determinism validator
export { DeterminismValidator } from './determinism-validator';

// R2: Proof writer
export { ReplayProofWriter } from './replay-proof-writer';

// R2: Replay adapters
export { ReplayFeedAdapter } from './adapters/replay-feed';
export { ReplaySettlementAdapter } from './adapters/replay-settlement';
export { NullRecapAdapter } from './adapters/null-recap';
export type { RecordedRecap } from './adapters/recording-recap';
export { RecordingRecapAdapter } from './adapters/recording-recap';

// R3: Shadow mode infrastructure
export { ShadowFeedAdapter } from './adapters/shadow-feed';
export { ShadowPipelineRunner } from './shadow-pipeline-runner';
export type { ShadowPipelineResult, ShadowError } from './shadow-pipeline-runner';
export { ShadowComparator } from './shadow-comparator';
export type { DivergenceEntry, DivergenceReport } from './shadow-comparator';
export { ShadowOrchestrator } from './shadow-orchestrator';
export type { ShadowRunConfig, ShadowResult } from './shadow-orchestrator';
export { ShadowProofWriter } from './shadow-proof-writer';

// R4: Fault injection framework
export * from './fault/index';

// SHADOW-DIVERGENCE-GUARDRAILS: Score-based shadow guardrail layer
export * from './shadow/index';

// R5: Execution simulation + strategy evaluation layer
export * from './strategy/index';

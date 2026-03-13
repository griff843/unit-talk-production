/**
 * VERIFICATION & SIMULATION CONTROL PLANE — ShadowFeedAdapter
 * Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R3
 *
 * Fan-out feed adapter for the shadow execution lane.
 * Thin wrapper over ReplayFeedAdapter with mode='shadow'.
 *
 * Invariants:
 *   - Cannot be instantiated in production mode (throws on construction via inner adapter)
 *   - Sources events from JournalEventStore (same interface as ReplayFeedAdapter)
 *   - Returns events in sequenceNumber order
 */

import { ReplayFeedAdapter } from './replay-feed';

import type { FeedAdapter, FeedEvent, ExecutionMode } from '../adapters';
import type { ClockProvider } from '../clock';
import type { JournalEventStore } from '../event-store';

/**
 * Shadow-lane feed adapter.
 *
 * Wraps JournalEventStore with mode='shadow'.
 * Identical polling behaviour to ReplayFeedAdapter — delivers events
 * in sequenceNumber order up to the current clock position.
 *
 * Used by ShadowOrchestrator to fan out events to the shadow pipeline.
 */
export class ShadowFeedAdapter implements FeedAdapter {
  readonly mode: ExecutionMode = 'shadow';

  private readonly inner: ReplayFeedAdapter;

  constructor(store: JournalEventStore) {
    this.inner = new ReplayFeedAdapter('shadow', store);
  }

  async poll(clock: ClockProvider): Promise<FeedEvent[]> {
    return this.inner.poll(clock);
  }

  /** Reset cursor for re-use across runs. */
  reset(): void {
    this.inner.reset();
  }
}

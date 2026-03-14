/**
 * SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY
 * Layer 2 / Phase 8 — Recovery & Replay
 *
 * Tests for JournalEventStore, storeFromJsonl, getEventsBetween,
 * and ReplayOrchestrator in-memory deterministic replay.
 */

import { describe, expect, it } from 'vitest';

import { JournalEventStore, ReplayOrchestrator, storeFromJsonl, VirtualEventClock } from '../';
import { NullNotificationAdapter } from '../adapters/null-notification';
import { RecordingPublishAdapter } from '../adapters/recording-publish';
import { RecordingRecapAdapter } from '../adapters/recording-recap';
import { ReplayFeedAdapter } from '../adapters/replay-feed';
import { ReplaySettlementAdapter } from '../adapters/replay-settlement';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeAdapters(store: JournalEventStore) {
  return {
    mode: 'replay' as const,
    publish: new RecordingPublishAdapter('replay'),
    notification: new NullNotificationAdapter('replay'),
    feed: new ReplayFeedAdapter('replay', store),
    settlement: new ReplaySettlementAdapter('replay', store),
    recap: new RecordingRecapAdapter('replay'),
  };
}

const PICK_SUBMITTED_EVENT = JSON.stringify({
  eventId: 'evt-001',
  eventType: 'PICK_SUBMITTED',
  pickId: 'pick-aaa',
  timestamp: '2026-03-14T10:00:00.000Z',
  sequenceNumber: 1,
  payload: { status: 'pending', bet_type: 'straight' },
  producedAt: '2026-03-14T10:00:01.000Z',
});

const PICK_GRADED_EVENT = JSON.stringify({
  eventId: 'evt-002',
  eventType: 'PICK_GRADED',
  pickId: 'pick-aaa',
  timestamp: '2026-03-14T11:00:00.000Z',
  sequenceNumber: 2,
  payload: { grade: 'win', kelly_fraction: 0.1 },
  producedAt: '2026-03-14T11:00:01.000Z',
});

const RECAP_EVENT = JSON.stringify({
  eventId: 'evt-003',
  eventType: 'RECAP_TRIGGERED',
  timestamp: '2026-03-14T12:00:00.000Z',
  sequenceNumber: 3,
  payload: { period: 'daily' },
  producedAt: '2026-03-14T12:00:01.000Z',
});

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('JournalEventStore — in-memory', () => {
  it('createInMemory returns an empty store', () => {
    const store = JournalEventStore.createInMemory();
    expect(store.size).toBe(0);
    expect(store.getAllEvents()).toHaveLength(0);
  });

  it('storeFromJsonl loads events from JSONL string', () => {
    const jsonl = [PICK_SUBMITTED_EVENT, PICK_GRADED_EVENT, RECAP_EVENT].join('\n');
    const store = storeFromJsonl(jsonl);

    expect(store.size).toBe(3);

    const events = store.getAllEvents();
    expect(events[0].eventType).toBe('PICK_SUBMITTED');
    expect(events[0].pickId).toBe('pick-aaa');
    expect(events[1].eventType).toBe('PICK_GRADED');
    expect(events[2].eventType).toBe('RECAP_TRIGGERED');
  });

  it('getEventsBetween filters events to the requested window', () => {
    const jsonl = [PICK_SUBMITTED_EVENT, PICK_GRADED_EVENT, RECAP_EVENT].join('\n');
    const store = storeFromJsonl(jsonl);

    // Window: 09:00 – 10:30 → only PICK_SUBMITTED (at 10:00)
    const window = store.getEventsBetween(
      new Date('2026-03-14T09:00:00.000Z'),
      new Date('2026-03-14T10:30:00.000Z')
    );

    expect(window).toHaveLength(1);
    expect(window[0].eventType).toBe('PICK_SUBMITTED');
  });
});

describe('ReplayOrchestrator — deterministic replay', () => {
  it('runs with an in-memory store and produces a 64-char determinism hash', async () => {
    const jsonl = [PICK_SUBMITTED_EVENT, PICK_GRADED_EVENT].join('\n');
    const store = storeFromJsonl(jsonl);

    const clock = new VirtualEventClock(new Date('2026-03-14T09:00:00.000Z'));
    const adapters = makeAdapters(store);

    const orchestrator = new ReplayOrchestrator({
      runId: 'test-run-001',
      eventStore: store,
      clock,
      adapters,
    });

    const result = await orchestrator.run();

    expect(result.mode).toBe('replay');
    expect(result.runId).toBe('test-run-001');
    expect(result.determinismHash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof result.eventsProcessed).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('returns eventsProcessed=0 for an empty store', async () => {
    const store = JournalEventStore.createInMemory();
    const clock = new VirtualEventClock(new Date('2026-03-14T09:00:00.000Z'));
    const adapters = makeAdapters(store);

    const orchestrator = new ReplayOrchestrator({
      runId: 'test-run-empty',
      eventStore: store,
      clock,
      adapters,
    });

    const result = await orchestrator.run();

    expect(result.eventsProcessed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.mode).toBe('replay');
  });
});

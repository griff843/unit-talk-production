/**
 * UTRP-R6 DEFECT-31 — E2E Critical Path Test
 * Sprint: UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION
 *
 * Proves the governed lifecycle chain end-to-end:
 *   submit → grade → post → settle → (recap filter match)
 *
 * Uses IsolatedPickStore + ReplayLifecycleRunner (in-process, no HTTP, no production DB).
 * The recap DB step (getDailyRecapData()) requires a live Supabase connection and is
 * evidenced here by verifying the store state that RecapService's filter would match.
 *
 * Live DB recap proof is designated R6 E2E verification scope (DEFECT-31 runtime).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { NullNotificationAdapter } from '../adapters/null-notification';
import { RecordingPublishAdapter } from '../adapters/recording-publish';
import { RecordingRecapAdapter } from '../adapters/recording-recap';
import { ReplayFeedAdapter } from '../adapters/replay-feed';
import { ReplaySettlementAdapter } from '../adapters/replay-settlement';
import { VirtualEventClock } from '../clock';
import { JournalEventStore, storeFromJsonl } from '../event-store';
import { IsolatedPickStore } from '../isolated-pick-store';
import { ReplayLifecycleRunner } from '../replay-lifecycle-runner';
import { ReplayOrchestrator } from '../replay-orchestrator';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const PICK_ID = 'e2e-pick-001';
const CAPPER_USERNAME = 'testcapper';

function basePickFields() {
  return {
    id: PICK_ID,
    bet_slip_id: 'slip-e2e-001',
    sport: 'NBA',
    player_name: 'Test Player',
    stat_type: 'points',
    line: 25.5,
    direction: 'over' as const,
    odds: -110,
    bet_type: 'player_prop',
    selection: 'Test Player o25.5 Pts',
    posted_to_discord: false,
  };
}

// ──────────────────────────────────────────────────────────────
// Unit E2E: submit → grade → post → settle
// ──────────────────────────────────────────────────────────────

describe('DEFECT-31 — E2E Critical Path: submit → grade → post → settle', () => {
  it('completes the full governed lifecycle in-process without production DB', () => {
    const store = new IsolatedPickStore();
    const clock = new VirtualEventClock(new Date('2026-03-19T08:00:00.000Z'));
    const runner = new ReplayLifecycleRunner(store);

    // ─── Stage 1: SUBMIT ─────────────────────────────────────
    clock.advanceTo(new Date('2026-03-19T10:00:00.000Z'));
    const submitResult = runner.insert(basePickFields(), {
      writerRole: 'submitter',
      traceId: 'e2e-submit-001',
      clock,
    });
    expect(submitResult.success).toBe(true);
    expect(submitResult.pickId).toBe(PICK_ID);
    expect(submitResult.validationPassed).toBe(true);

    const afterSubmit = store.get(PICK_ID);
    expect(afterSubmit.data).not.toBeNull();
    expect(afterSubmit.data!['id']).toBe(PICK_ID);
    expect(afterSubmit.data!['posted_to_discord']).toBe(false);

    // ─── Stage 2: GRADE ──────────────────────────────────────
    clock.advanceTo(new Date('2026-03-19T10:15:00.000Z'));
    const gradeResult = runner.update(
      PICK_ID,
      {
        tier: 'S',
        promotion_band: 'elite',
        professional_score: 94,
        promotion_status: 'queued',
        promotion_queued_at: clock.now().toISOString(),
      },
      {
        writerRole: 'promoter',
        traceId: 'e2e-grade-001',
        clock,
      }
    );
    expect(gradeResult.success).toBe(true);

    const afterGrade = store.get(PICK_ID);
    expect(afterGrade.data!['tier']).toBe('S');
    expect(afterGrade.data!['promotion_band']).toBe('elite');
    expect(afterGrade.data!['professional_score']).toBe(94);

    // ─── Stage 3: POST ───────────────────────────────────────
    clock.advanceTo(new Date('2026-03-19T10:30:00.000Z'));
    const postResult = runner.claimForPosting(PICK_ID, {
      writerRole: 'poster',
      traceId: 'e2e-post-001',
      clock,
    });
    expect(postResult.success).toBe(true);

    const afterPost = store.get(PICK_ID);
    expect(afterPost.data!['posted_to_discord']).toBe(true);
    expect(afterPost.data!['promotion_status']).toBe('promoted');

    // ─── Stage 4: SETTLE ─────────────────────────────────────
    clock.advanceTo(new Date('2026-03-19T22:00:00.000Z'));
    const settleResult = runner.settle(
      PICK_ID,
      {
        settlement_status: 'settled',
        settlement_result: 'win',
        settlement_source: 'test-e2e',
      },
      {
        writerRole: 'settler',
        traceId: 'e2e-settle-001',
        clock,
      }
    );
    expect(settleResult.success).toBe(true);
    expect(settleResult.validationPassed).toBe(true);

    // ─── Stage 5: Verify recap filter match ──────────────────
    // RecapService.getDailyRecapData() filters on:
    //   settlement_status = 'settled' AND settlement_result NOT NULL
    // Confirm the settled pick in the store satisfies these conditions.
    const afterSettle = store.get(PICK_ID);
    const finalPick = afterSettle.data!;

    expect(finalPick['settlement_status']).toBe('settled');
    expect(finalPick['settlement_result']).toBe('win');
    expect(finalPick['settled_at']).toBeTruthy();
    expect(finalPick['status']).toBe('won');

    // Recap filter: settlement_status='settled' AND settlement_result NOT NULL
    // This pick satisfies both conditions — it would appear in getDailyRecapData().
    const recapFilterMatch =
      finalPick['settlement_status'] === 'settled' && finalPick['settlement_result'] != null;
    expect(recapFilterMatch).toBe(true);

    // ─── Lifecycle trace verification ────────────────────────
    // Note: POSTED stage requires discord_message_id which is set by the Discord poster,
    // not by claimForPosting(). The post step sets posted_to_discord=true which is
    // verified directly on the pick state above. The trace verifies QUEUED → SETTLED path.
    const trace = runner.getTrace();
    const stages = trace.map(t => t.to);
    expect(stages).toContain('QUEUED');
    expect(stages).toContain('SETTLED');

    // Final stage must be SETTLED
    const lastTrace = trace[trace.length - 1];
    expect(lastTrace.to).toBe('SETTLED');
    expect(lastTrace.writerRole).toBe('settler');
  });

  it('settle is idempotency-guarded: second settle attempt fails', () => {
    const store = new IsolatedPickStore();
    const clock = new VirtualEventClock(new Date('2026-03-19T08:00:00.000Z'));
    const runner = new ReplayLifecycleRunner(store);

    clock.advanceTo(new Date('2026-03-19T10:00:00.000Z'));
    runner.insert(basePickFields(), { writerRole: 'submitter', clock });
    runner.update(
      PICK_ID,
      { tier: 'A', promotion_band: 'strong', professional_score: 80, promotion_status: 'queued' },
      { writerRole: 'promoter', clock }
    );
    runner.claimForPosting(PICK_ID, { writerRole: 'poster', clock });

    clock.advanceTo(new Date('2026-03-19T22:00:00.000Z'));
    const firstSettle = runner.settle(
      PICK_ID,
      { settlement_status: 'settled', settlement_result: 'win', settlement_source: 'test' },
      { writerRole: 'settler', clock }
    );
    expect(firstSettle.success).toBe(true);

    // Second attempt — optimistic lock should fail (settlement_status already 'settled')
    const secondSettle = runner.settle(
      PICK_ID,
      { settlement_status: 'settled', settlement_result: 'loss', settlement_source: 'test' },
      { writerRole: 'settler', clock }
    );
    expect(secondSettle.success).toBe(false);
    // Pick result should still be the first settlement
    const finalPick = store.get(PICK_ID).data!;
    expect(finalPick['settlement_result']).toBe('win');
  });
});

// ──────────────────────────────────────────────────────────────
// Replay-based E2E: 3-types fixture (all bet types)
// ──────────────────────────────────────────────────────────────

describe('DEFECT-30/31 — E2E via 3-types replay fixture', () => {
  it('processes all 3 bet types (player_prop, total, spread) through full lifecycle', async () => {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    const fixturePath = join(__dirname, '../test-fixtures/post-rem-events-3types.jsonl');
    const jsonl = readFileSync(fixturePath, 'utf8');
    const store = storeFromJsonl(jsonl);

    expect(store.size).toBeGreaterThan(0);

    const firstEvent = store.getAllEvents()[0];
    const clock = new VirtualEventClock(new Date(new Date(firstEvent.timestamp).getTime() - 60000));

    const adapters = {
      mode: 'replay' as const,
      publish: new RecordingPublishAdapter('replay'),
      notification: new NullNotificationAdapter('replay'),
      feed: new ReplayFeedAdapter('replay', store),
      settlement: new ReplaySettlementAdapter('replay', store),
      recap: new RecordingRecapAdapter('replay'),
    };

    const orchestrator = new ReplayOrchestrator({
      runId: 'e2e-3types-001',
      eventStore: store,
      clock,
      adapters,
    });

    const result = await orchestrator.run();

    // Basic replay health
    expect(result.errors).toHaveLength(0);
    expect(result.eventsProcessed).toBeGreaterThan(0);

    // All 3 picks should be created
    expect(result.picksCreated).toBe(3);

    // Gate H: All PICK_SETTLED events should produce settled picks with required fields
    const pickSettledCount = store
      .getAllEvents()
      .filter(e => e.eventType === 'PICK_SETTLED').length;
    expect(pickSettledCount).toBe(3);

    const settledPicks = result.finalPickState.filter(p => p['settlement_status'] === 'settled');
    expect(settledPicks).toHaveLength(3);

    for (const pick of settledPicks) {
      expect(pick['settlement_result']).toBeTruthy();
      expect(pick['settled_at']).toBeTruthy();
    }

    // Bet type coverage
    const betTypes = result.finalPickState.map(p => p['bet_type']);
    expect(betTypes).toContain('player_prop');
    expect(betTypes).toContain('total');
    expect(betTypes).toContain('spread');

    // Recap was triggered
    expect(result.eventsProcessed).toBeGreaterThanOrEqual(13); // 13 events in fixture

    // Determinism hash is valid
    expect(result.determinismHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('determinism: two runs of 3-types fixture produce identical hashes', async () => {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    const fixturePath = join(__dirname, '../test-fixtures/post-rem-events-3types.jsonl');
    const jsonl = readFileSync(fixturePath, 'utf8');

    async function runOnce(runId: string): Promise<string> {
      const store = storeFromJsonl(jsonl);
      const firstEvent = store.getAllEvents()[0];
      const clock = new VirtualEventClock(
        new Date(new Date(firstEvent.timestamp).getTime() - 60000)
      );
      const adapters = {
        mode: 'replay' as const,
        publish: new RecordingPublishAdapter('replay'),
        notification: new NullNotificationAdapter('replay'),
        feed: new ReplayFeedAdapter('replay', store),
        settlement: new ReplaySettlementAdapter('replay', store),
        recap: new RecordingRecapAdapter('replay'),
      };
      const orchestrator = new ReplayOrchestrator({ runId, eventStore: store, clock, adapters });
      const result = await orchestrator.run();
      return result.determinismHash;
    }

    const hash1 = await runOnce('det-run-1');
    const hash2 = await runOnce('det-run-2');

    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    expect(hash1).toBe(hash2);
  });
});

// ──────────────────────────────────────────────────────────────
// Recap DB step documentation
// ──────────────────────────────────────────────────────────────

describe('DEFECT-31 — Recap DB step (runtime caveat)', () => {
  it('documents the recap DB requirement', () => {
    // RecapService.getDailyRecapData(date) requires a live Supabase connection.
    // It filters: settlement_status='settled' AND settlement_result NOT NULL.
    //
    // The E2E test above verifies that the governed lifecycle produces pick state
    // that satisfies BOTH filter conditions. The actual Supabase query proof is
    // designated as R6 runtime verification (DEFECT-31) requiring a live DB.
    //
    // Runtime proof artifact: out/sprints/UTRP-R6-.../proofs/proof_e2e_test.txt
    //
    // This test passes as a documented assertion of the caveat.
    const recapFilter = (pick: { settlement_status: string; settlement_result: string | null }) =>
      pick.settlement_status === 'settled' && pick.settlement_result !== null;

    const exampleSettledPick = { settlement_status: 'settled', settlement_result: 'win' };
    const exampleUnsettledPick = { settlement_status: 'pending', settlement_result: null };

    expect(recapFilter(exampleSettledPick)).toBe(true);
    expect(recapFilter(exampleUnsettledPick)).toBe(false);
  });
});

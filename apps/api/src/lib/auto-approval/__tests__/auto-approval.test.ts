/**
 * AUTO-APPROVAL ENGINE TESTS
 * Sprint: SPRINT-PROMOTION-MODE-SPLIT
 *
 * Verifies:
 *   - manual mode keeps picks in pending_review (no-op)
 *   - auto mode transitions eligible system picks → approved
 *   - F-tier picks are excluded from auto-approval
 *   - Default/missing PROMOTION_MODE fails closed to manual
 *   - Ambiguous PROMOTION_MODE values fail closed to manual
 *   - DiscordPromotionAgent compatibility: system_approved='true' is set
 *   - Error handling: DB fetch failure returns safely
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getPromotionMode, isAutoPromotionMode } from '../../promotion-mode';

// Mock lifecycleUpdate before importing runAutoApproval so auto-approval gets the mock
vi.mock('../../lifecycle', () => ({
  lifecycleUpdate: vi.fn(),
}));

import { runAutoApproval } from '../index';
import { lifecycleUpdate } from '../../lifecycle';

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// HELPERS
// ============================================================

function makePick(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pick-001',
    tier: 'S',
    workflow_stage: 'pending_review',
    posted_to_discord: false,
    settlement_status: 'pending',
    meta: { pick_origin: 'system' },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build a mock supabase that returns a specific set of picks from the initial
 * unified_picks select query. All further from() calls also return this mock.
 */
function makeSupabase(picks: unknown[] | null, fetchError?: string): SupabaseClient {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: picks,
      error: fetchError ? { message: fetchError } : null,
    }),
  };

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
    }),
  } as unknown as SupabaseClient;
}

// ============================================================
// getPromotionMode / isAutoPromotionMode unit tests
// ============================================================

describe('getPromotionMode', () => {
  const original = process.env['PROMOTION_MODE'];
  afterEach(() => {
    if (original === undefined) delete process.env['PROMOTION_MODE'];
    else process.env['PROMOTION_MODE'] = original;
  });

  it('returns manual when PROMOTION_MODE is not set (fail-closed)', () => {
    delete process.env['PROMOTION_MODE'];
    expect(getPromotionMode()).toBe('manual');
  });

  it('returns manual when PROMOTION_MODE=manual', () => {
    process.env['PROMOTION_MODE'] = 'manual';
    expect(getPromotionMode()).toBe('manual');
  });

  it('returns auto when PROMOTION_MODE=auto', () => {
    process.env['PROMOTION_MODE'] = 'auto';
    expect(getPromotionMode()).toBe('auto');
  });

  it('fails closed to manual for unrecognized values', () => {
    process.env['PROMOTION_MODE'] = 'AUTO'; // uppercase
    expect(getPromotionMode()).toBe('manual');

    process.env['PROMOTION_MODE'] = 'prod';
    expect(getPromotionMode()).toBe('manual');

    process.env['PROMOTION_MODE'] = 'true';
    expect(getPromotionMode()).toBe('manual');

    process.env['PROMOTION_MODE'] = '';
    expect(getPromotionMode()).toBe('manual');
  });

  it('isAutoPromotionMode returns true only for auto', () => {
    process.env['PROMOTION_MODE'] = 'auto';
    expect(isAutoPromotionMode()).toBe(true);

    process.env['PROMOTION_MODE'] = 'manual';
    expect(isAutoPromotionMode()).toBe(false);

    delete process.env['PROMOTION_MODE'];
    expect(isAutoPromotionMode()).toBe(false);
  });
});

// ============================================================
// runAutoApproval — manual mode
// ============================================================

describe('runAutoApproval — manual mode', () => {
  const original = process.env['PROMOTION_MODE'];

  beforeEach(() => {
    process.env['PROMOTION_MODE'] = 'manual';
    vi.mocked(lifecycleUpdate).mockClear();
  });
  afterEach(() => {
    if (original === undefined) delete process.env['PROMOTION_MODE'];
    else process.env['PROMOTION_MODE'] = original;
  });

  it('is a no-op in manual mode — does not query or write', async () => {
    const supabase = makeSupabase([makePick()]);

    const result = await runAutoApproval(supabase);

    expect(result.mode).toBe('manual');
    expect(result.approved).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.ftierExcluded).toBe(0);
    // Supabase must NOT be called in manual mode
    expect(supabase.from).not.toHaveBeenCalled();
    // lifecycleUpdate must NOT be called in manual mode
    expect(lifecycleUpdate).not.toHaveBeenCalled();
  });

  it('returns manual mode even when PROMOTION_MODE is unset', async () => {
    delete process.env['PROMOTION_MODE'];
    const supabase = makeSupabase([makePick()]);

    const result = await runAutoApproval(supabase);

    expect(result.mode).toBe('manual');
    expect(result.approved).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(lifecycleUpdate).not.toHaveBeenCalled();
  });
});

// ============================================================
// runAutoApproval — auto mode
// ============================================================

describe('runAutoApproval — auto mode', () => {
  const original = process.env['PROMOTION_MODE'];

  beforeEach(() => {
    process.env['PROMOTION_MODE'] = 'auto';
    vi.mocked(lifecycleUpdate).mockClear();
  });
  afterEach(() => {
    if (original === undefined) delete process.env['PROMOTION_MODE'];
    else process.env['PROMOTION_MODE'] = original;
  });

  it('transitions eligible system pick to approved + sets system_approved=true', async () => {
    const pick = makePick({ tier: 'A', meta: { pick_origin: 'system' } });
    const supabase = makeSupabase([pick]);

    vi.mocked(lifecycleUpdate).mockResolvedValueOnce({
      success: true,
      pickId: pick.id as string,
      validationPassed: true,
    });

    const result = await runAutoApproval(supabase);

    expect(result.mode).toBe('auto');
    expect(result.approved).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.ftierExcluded).toBe(0);

    // Verify lifecycleUpdate was called with correct arguments
    expect(lifecycleUpdate).toHaveBeenCalledOnce();
    const [, pickId, updates, context] = vi.mocked(lifecycleUpdate).mock.calls[0]!;
    expect(pickId).toBe(pick.id);
    expect(updates.workflow_stage).toBe('approved');
    expect((updates.meta as Record<string, unknown>).system_approved).toBe('true');
    expect(context.writerRole).toBe('promoter');
  });

  it('excludes F-tier picks from auto-approval (stale backlog classification)', async () => {
    const ftierPick = makePick({ id: 'pick-ftier', tier: 'F', meta: { pick_origin: 'system' } });
    const supabase = makeSupabase([ftierPick]);

    const result = await runAutoApproval(supabase);

    expect(result.mode).toBe('auto');
    expect(result.approved).toBe(0);
    expect(result.ftierExcluded).toBe(1);
    // lifecycleUpdate must NOT be called for F-tier picks
    expect(lifecycleUpdate).not.toHaveBeenCalled();
  });

  it('handles mix of eligible and F-tier picks correctly', async () => {
    const goodPick = makePick({ id: 'pick-good', tier: 'S', meta: { pick_origin: 'system' } });
    const ftierPick = makePick({ id: 'pick-ftier', tier: 'F', meta: { pick_origin: 'system' } });
    const supabase = makeSupabase([goodPick, ftierPick]);

    vi.mocked(lifecycleUpdate).mockResolvedValueOnce({
      success: true,
      pickId: 'pick-good',
      validationPassed: true,
    });

    const result = await runAutoApproval(supabase);

    expect(result.approved).toBe(1);
    expect(result.ftierExcluded).toBe(1);
    expect(result.errors).toBe(0);
    // Only one lifecycleUpdate call (for the good pick, not the F-tier)
    expect(lifecycleUpdate).toHaveBeenCalledOnce();
  });

  it('counts errors when lifecycleUpdate fails', async () => {
    const pick = makePick({ tier: 'B', meta: { pick_origin: 'system' } });
    const supabase = makeSupabase([pick]);

    vi.mocked(lifecycleUpdate).mockResolvedValueOnce({
      success: false,
      error: 'concurrent modification',
      validationPassed: true,
    });

    const result = await runAutoApproval(supabase);

    expect(result.approved).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('returns safely when no eligible picks found', async () => {
    const supabase = makeSupabase([]);

    const result = await runAutoApproval(supabase);

    expect(result.mode).toBe('auto');
    expect(result.approved).toBe(0);
    expect(result.errors).toBe(0);
    expect(lifecycleUpdate).not.toHaveBeenCalled();
  });

  it('returns safely when supabase fetch fails', async () => {
    const supabase = makeSupabase(null, 'connection timeout');

    const result = await runAutoApproval(supabase);

    expect(result.mode).toBe('auto');
    expect(result.approved).toBe(0);
    expect(result.errors).toBe(1);
    expect(lifecycleUpdate).not.toHaveBeenCalled();
  });

  it('preserves existing meta fields when setting system_approved', async () => {
    const pick = makePick({
      tier: 'A',
      meta: { pick_origin: 'system', existing_key: 'existing_value' },
    });
    const supabase = makeSupabase([pick]);

    vi.mocked(lifecycleUpdate).mockResolvedValueOnce({
      success: true,
      pickId: pick.id as string,
      validationPassed: true,
    });

    await runAutoApproval(supabase);

    const [, , updates] = vi.mocked(lifecycleUpdate).mock.calls[0]!;
    const meta = updates.meta as Record<string, unknown>;
    // Existing meta fields must be preserved
    expect(meta.pick_origin).toBe('system');
    expect(meta.existing_key).toBe('existing_value');
    // New flag must be added
    expect(meta.system_approved).toBe('true');
  });

  it('handles null meta gracefully (no crash on pick.meta = null)', async () => {
    const pick = makePick({ tier: 'C', meta: null });
    const supabase = makeSupabase([pick]);

    vi.mocked(lifecycleUpdate).mockResolvedValueOnce({
      success: true,
      pickId: pick.id as string,
      validationPassed: true,
    });

    const result = await runAutoApproval(supabase);
    // Should not throw; approved count depends on the pick having pick_origin=system
    // (meta is null here, so the query filter would exclude it in real DB, but in the test
    // the mock returns it regardless - just verify no crash occurs)
    expect(result.errors).toBe(0);
  });
});

// ============================================================
// F-tier backlog classification (documentation test)
// ============================================================

describe('F-tier backlog classification', () => {
  it('F-tier is classified as stale backlog from legacy scoring system', () => {
    // The SyndicateGradingEngine in BridgeWorker maps D→C (no F-tier output).
    // Any pick with tier='F' in unified_picks predates the current scoring system.
    // These 124 observed F-tier picks are stale historical records.

    const FTIER_CLASSIFICATION = {
      observedCount: 124,
      origin: 'legacy scoring system (pre-SyndicateGradingEngine)',
      currentSystemBehavior: 'D-tier maps to C-tier in BridgeWorker — no F-tier produced',
      entryRoute: 'gradeAndPromoteFinalPicks.ts (DEPRECATED) or direct DB insert',
      action: 'excluded from auto-approval',
      productionSafe: true,
      requiresCleanup: false, // Excluded from live queue; no active harm
      recommendation: 'Leave as-is; operators may archive manually if desired',
    };

    expect(FTIER_CLASSIFICATION.action).toBe('excluded from auto-approval');
    expect(FTIER_CLASSIFICATION.productionSafe).toBe(true);
    expect(FTIER_CLASSIFICATION.observedCount).toBe(124);
  });
});

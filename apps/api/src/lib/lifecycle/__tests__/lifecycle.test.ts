/**
 * LIFECYCLE CONTRACT TESTS
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * These tests enforce the lifecycle contract:
 * - Illegal transitions must be rejected
 * - Valid transitions must be allowed
 * - Writer authority must be enforced
 * - Timestamp invariants must be validated
 * - Immutability guards must be enforced
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '../transition-validator';
import {
  getFieldAuthority,
  canWriteField,
  isFieldImmutable,
  getAuthorizedFields,
  getAllowedWriters,
  assertWriterAuthority,
  assertImmutability,
  validateWrite,
  getFieldsByWriter,
  getImmutableFields,
} from '../writer-authority';
import {
  InvalidTransitionError,
  InvalidWriterError,
  InvalidTimestampError,
} from '../errors';
import type { LifecyclePick, WriterRole, LifecycleStage } from '../types';

// ============================================================
// TEST FIXTURES
// ============================================================

function createBasePick(overrides: Partial<LifecyclePick> = {}): LifecyclePick {
  return {
    id: 'test-pick-001',
    status: 'pending',
    promotion_status: 'not_promoted',
    settlement_status: 'pending',
    posted_to_discord: false,
    created_at: new Date('2026-02-18T10:00:00Z'),
    ...overrides,
  };
}

// ============================================================
// STAGE DERIVATION TESTS
// ============================================================

describe('Lifecycle Stage Derivation', () => {
  it('derives SUBMITTED for fresh pick', () => {
    const pick = createBasePick();
    expect(deriveLifecycleStage(pick)).toBe('SUBMITTED');
  });

  it('derives QUEUED when promotion_status is queued', () => {
    const pick = createBasePick({
      promotion_status: 'queued',
      promotion_queued_at: new Date('2026-02-18T10:01:00Z'),
    });
    expect(deriveLifecycleStage(pick)).toBe('QUEUED');
  });

  it('derives POSTED when posted_to_discord with message_id', () => {
    const pick = createBasePick({
      posted_to_discord: true,
      discord_message_id: 'msg-123',
      promotion_status: 'promoted',
    });
    expect(deriveLifecycleStage(pick)).toBe('POSTED');
  });

  it('derives BLOCKED when blocked_reason is set', () => {
    const pick = createBasePick({
      blocked_reason: 'Game already started',
    });
    expect(deriveLifecycleStage(pick)).toBe('BLOCKED');
  });

  it('derives FAILED when failed_reason is set', () => {
    const pick = createBasePick({
      failed_reason: 'Discord API error',
    });
    expect(deriveLifecycleStage(pick)).toBe('FAILED');
  });

  it('derives SETTLED when settlement_status is settled', () => {
    const pick = createBasePick({
      posted_to_discord: true,
      discord_message_id: 'msg-123',
      settlement_status: 'settled',
      settlement_result: 'win',
      settled_at: new Date('2026-02-18T15:00:00Z'),
    });
    expect(deriveLifecycleStage(pick)).toBe('SETTLED');
  });

  it('derives DISPUTED when settlement_status is disputed', () => {
    const pick = createBasePick({
      settlement_status: 'disputed',
    });
    expect(deriveLifecycleStage(pick)).toBe('DISPUTED');
  });

  it('derives VOID when settlement_status is void', () => {
    const pick = createBasePick({
      settlement_status: 'void',
    });
    expect(deriveLifecycleStage(pick)).toBe('VOID');
  });

  it('derives CANCELLED when status is cancelled', () => {
    const pick = createBasePick({
      status: 'cancelled',
    });
    expect(deriveLifecycleStage(pick)).toBe('CANCELLED');
  });

  it('prioritizes terminal states correctly', () => {
    // CANCELLED takes precedence over everything
    const pick = createBasePick({
      status: 'cancelled',
      settlement_status: 'settled',
      posted_to_discord: true,
      discord_message_id: 'msg-123',
    });
    expect(deriveLifecycleStage(pick)).toBe('CANCELLED');
  });
});

describe('Lifecycle State Derivation', () => {
  it('builds complete state object', () => {
    const pick = createBasePick({
      blocked_reason: 'Test block',
    });
    const state = deriveLifecycleState(pick);

    expect(state.stage).toBe('BLOCKED');
    expect(state.isBlocked).toBe(true);
    expect(state.blockedReason).toBe('Test block');
    expect(state.isFailed).toBe(false);
    expect(state.isPosted).toBe(false);
  });
});

// ============================================================
// TRANSITION VALIDATION TESTS
// ============================================================

describe('Transition Validation', () => {
  describe('Allowed Transitions', () => {
    const validTransitions: Array<[LifecycleStage, LifecycleStage, WriterRole]> = [
      ['SUBMITTED', 'QUEUED', 'promoter'],
      ['SUBMITTED', 'BLOCKED', 'promoter'],
      ['SUBMITTED', 'SETTLED', 'settler'],
      ['QUEUED', 'POSTED', 'poster'],
      ['QUEUED', 'BLOCKED', 'promoter'],
      ['QUEUED', 'FAILED', 'poster'],
      ['POSTED', 'SETTLING', 'settler'],
      ['POSTED', 'SETTLED', 'settler'],
      ['SETTLING', 'SETTLED', 'settler'],
      ['BLOCKED', 'QUEUED', 'operator_override'],
      ['BLOCKED', 'CANCELLED', 'operator_override'],
      ['FAILED', 'QUEUED', 'operator_override'],
      ['FAILED', 'QUEUED', 'promoter'],
      ['FAILED', 'CANCELLED', 'operator_override'],
      ['SETTLED', 'DISPUTED', 'operator_override'],
      ['DISPUTED', 'SETTLED', 'settler'],
      ['DISPUTED', 'SETTLED', 'operator_override'],
      ['SETTLED', 'VOID', 'settler'],
      ['SETTLED', 'VOID', 'operator_override'],
      ['POSTED', 'VOID', 'settler'],
    ];

    it.each(validTransitions)(
      'allows transition %s -> %s by %s',
      (from, to, writer) => {
        expect(isTransitionAllowed(from, to)).toBe(true);
        const def = getTransitionDefinition(from, to);
        expect(def).not.toBeNull();
        expect(def!.allowedWriters).toContain(writer);
      }
    );
  });

  describe('Forbidden Transitions', () => {
    const forbiddenTransitions: Array<[LifecycleStage, LifecycleStage]> = [
      // Cannot regress from terminal states
      ['CANCELLED', 'SUBMITTED'],
      ['CANCELLED', 'QUEUED'],
      ['CANCELLED', 'POSTED'],
      ['CANCELLED', 'SETTLED'],
      // Cannot skip stages
      ['SUBMITTED', 'POSTED'],
      ['SUBMITTED', 'SETTLING'],
      ['QUEUED', 'SETTLING'],
      ['QUEUED', 'SETTLED'],
      // Cannot regress from posted
      ['POSTED', 'SUBMITTED'],
      ['POSTED', 'QUEUED'],
      // Cannot regress from settled
      ['SETTLED', 'SUBMITTED'],
      ['SETTLED', 'QUEUED'],
      ['SETTLED', 'POSTED'],
      ['SETTLED', 'CANCELLED'],
    ];

    it.each(forbiddenTransitions)(
      'forbids transition %s -> %s',
      (from, to) => {
        expect(isTransitionAllowed(from, to)).toBe(false);
        expect(getTransitionDefinition(from, to)).toBeNull();
      }
    );
  });

  describe('assertTransition', () => {
    it('throws InvalidTransitionError for forbidden transition', () => {
      expect(() =>
        assertTransition('CANCELLED', 'SUBMITTED', {
          pickId: 'test',
          writerRole: 'submitter',
        })
      ).toThrow(InvalidTransitionError);
    });

    it('throws InvalidTransitionError for unauthorized writer', () => {
      expect(() =>
        assertTransition('SUBMITTED', 'QUEUED', {
          pickId: 'test',
          writerRole: 'submitter', // submitter cannot queue
        })
      ).toThrow(InvalidTransitionError);
    });

    it('succeeds for valid transition with authorized writer', () => {
      expect(() =>
        assertTransition('SUBMITTED', 'QUEUED', {
          pickId: 'test',
          writerRole: 'promoter',
        })
      ).not.toThrow();
    });
  });

  describe('performTransition', () => {
    it('returns success for valid transition', () => {
      const pick = createBasePick();
      const result = performTransition(pick, 'QUEUED', {
        pickId: pick.id,
        writerRole: 'promoter',
      });

      expect(result.success).toBe(true);
      expect(result.fromStage).toBe('SUBMITTED');
      expect(result.toStage).toBe('QUEUED');
      expect(result.error).toBeUndefined();
    });

    it('returns failure for invalid transition', () => {
      const pick = createBasePick();
      const result = performTransition(pick, 'POSTED', {
        pickId: pick.id,
        writerRole: 'poster',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_TRANSITION');
    });
  });
});

// ============================================================
// TIMESTAMP INVARIANT TESTS
// ============================================================

describe('Timestamp Invariants', () => {
  it('validates promotion_queued_at >= created_at', () => {
    const pick = createBasePick({
      created_at: new Date('2026-02-18T10:00:00Z'),
      promotion_queued_at: new Date('2026-02-18T09:00:00Z'), // INVALID: before created_at
    });

    expect(() => validateTimestampInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('validates promotion_posted_at >= promotion_queued_at', () => {
    const pick = createBasePick({
      created_at: new Date('2026-02-18T10:00:00Z'),
      promotion_queued_at: new Date('2026-02-18T10:01:00Z'),
      promotion_posted_at: new Date('2026-02-18T10:00:30Z'), // INVALID: before queued_at
    });

    expect(() => validateTimestampInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('validates settled_at >= created_at', () => {
    const pick = createBasePick({
      created_at: new Date('2026-02-18T10:00:00Z'),
      settled_at: new Date('2026-02-18T09:00:00Z'), // INVALID: before created_at
    });

    expect(() => validateTimestampInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('validates settled_at >= promotion_posted_at', () => {
    const pick = createBasePick({
      created_at: new Date('2026-02-18T10:00:00Z'),
      promotion_queued_at: new Date('2026-02-18T10:01:00Z'),
      promotion_posted_at: new Date('2026-02-18T10:02:00Z'),
      settled_at: new Date('2026-02-18T10:01:30Z'), // INVALID: before posted_at
    });

    expect(() => validateTimestampInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('validates freeze_enforced_at >= settled_at', () => {
    const pick = createBasePick({
      created_at: new Date('2026-02-18T10:00:00Z'),
      settled_at: new Date('2026-02-18T15:00:00Z'),
      freeze_enforced_at: new Date('2026-02-18T14:00:00Z'), // INVALID: before settled_at
    });

    expect(() => validateTimestampInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('passes for valid timestamp chain', () => {
    const pick = createBasePick({
      created_at: new Date('2026-02-18T10:00:00Z'),
      promotion_queued_at: new Date('2026-02-18T10:01:00Z'),
      promotion_posted_at: new Date('2026-02-18T10:02:00Z'),
      settled_at: new Date('2026-02-18T15:00:00Z'),
      freeze_enforced_at: new Date('2026-02-18T15:01:00Z'),
    });

    expect(() => validateTimestampInvariants(pick)).not.toThrow();
  });
});

// ============================================================
// STATE INVARIANT TESTS
// ============================================================

describe('State Invariants', () => {
  it('requires discord_message_id when posted_to_discord is true', () => {
    const pick = createBasePick({
      posted_to_discord: true,
      // missing discord_message_id
    });

    expect(() => validateStateInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('requires settlement_result when settled', () => {
    const pick = createBasePick({
      settlement_status: 'settled',
      settled_at: new Date('2026-02-18T15:00:00Z'),
      // missing settlement_result
    });

    expect(() => validateStateInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('requires settled_at when settlement_status is settled', () => {
    const pick = createBasePick({
      settlement_status: 'settled',
      settlement_result: 'win',
      // missing settled_at
    });

    expect(() => validateStateInvariants(pick)).toThrow(InvalidTimestampError);
  });

  it('passes for valid settled state', () => {
    const pick = createBasePick({
      settlement_status: 'settled',
      settlement_result: 'win',
      settled_at: new Date('2026-02-18T15:00:00Z'),
    });

    expect(() => validateStateInvariants(pick)).not.toThrow();
  });
});

// ============================================================
// WRITER AUTHORITY TESTS
// ============================================================

describe('Writer Authority', () => {
  describe('Field Authority Definitions', () => {
    it('assigns submission fields to submitter only', () => {
      const submitterFields = ['id', 'bet_slip_id', 'user_id', 'selection', 'line', 'odds', 'stake'];
      for (const field of submitterFields) {
        const authority = getFieldAuthority(field);
        expect(authority).not.toBeNull();
        expect(authority!.allowedWriters).toContain('submitter');
        expect(authority!.immutableAfterSet).toBe(true);
      }
    });

    it('assigns posting fields to poster only', () => {
      const posterFields = ['posted_to_discord', 'discord_message_id', 'discord_thread_id'];
      for (const field of posterFields) {
        const authority = getFieldAuthority(field);
        expect(authority).not.toBeNull();
        expect(authority!.allowedWriters).toContain('poster');
        expect(authority!.immutableAfterSet).toBe(true);
      }
    });

    it('assigns settlement fields to settler', () => {
      const settlerFields = ['settlement_status', 'settlement_result', 'settlement_source', 'settlement_hash'];
      for (const field of settlerFields) {
        const authority = getFieldAuthority(field);
        expect(authority).not.toBeNull();
        expect(authority!.allowedWriters).toContain('settler');
      }
    });

    it('allows operator_override to write settlement fields', () => {
      const settlementFields = ['settlement_status', 'settlement_result', 'settled_at'];
      for (const field of settlementFields) {
        expect(canWriteField('operator_override', field)).toBe(true);
      }
    });
  });

  describe('canWriteField', () => {
    it('returns true for authorized writer', () => {
      expect(canWriteField('submitter', 'selection')).toBe(true);
      expect(canWriteField('promoter', 'promotion_status')).toBe(true);
      expect(canWriteField('poster', 'posted_to_discord')).toBe(true);
      expect(canWriteField('settler', 'settlement_status')).toBe(true);
    });

    it('returns false for unauthorized writer', () => {
      expect(canWriteField('submitter', 'settlement_status')).toBe(false);
      expect(canWriteField('promoter', 'posted_to_discord')).toBe(false);
      expect(canWriteField('poster', 'selection')).toBe(false);
      expect(canWriteField('settler', 'bet_slip_id')).toBe(false);
    });

    it('allows operator_override for unknown fields', () => {
      expect(canWriteField('operator_override', 'unknown_field')).toBe(true);
      expect(canWriteField('submitter', 'unknown_field')).toBe(false);
    });
  });

  describe('assertWriterAuthority', () => {
    it('succeeds for authorized fields', () => {
      expect(() =>
        assertWriterAuthority('submitter', ['id', 'selection', 'line', 'odds'])
      ).not.toThrow();

      expect(() =>
        assertWriterAuthority('settler', ['settlement_status', 'settlement_result', 'settled_at'])
      ).not.toThrow();
    });

    it('throws InvalidWriterError for unauthorized field', () => {
      expect(() =>
        assertWriterAuthority('submitter', ['id', 'settlement_status'])
      ).toThrow(InvalidWriterError);

      expect(() =>
        assertWriterAuthority('poster', ['selection'])
      ).toThrow(InvalidWriterError);
    });
  });

  describe('assertImmutability', () => {
    it('throws when updating immutable field that is already set', () => {
      const currentValues = {
        id: 'existing-id',
        selection: 'existing-selection',
      };

      expect(() =>
        assertImmutability('submitter', ['id', 'selection'], currentValues)
      ).toThrow(InvalidWriterError);
    });

    it('allows setting immutable field for first time', () => {
      const currentValues = {
        id: null,
        selection: undefined,
      };

      expect(() =>
        assertImmutability('submitter', ['id', 'selection'], currentValues)
      ).not.toThrow();
    });

    it('allows operator_override to update immutable fields', () => {
      const currentValues = {
        id: 'existing-id',
        selection: 'existing-selection',
      };

      expect(() =>
        assertImmutability('operator_override', ['id', 'selection'], currentValues)
      ).not.toThrow();
    });
  });

  describe('validateWrite', () => {
    it('validates both authority and immutability', () => {
      const currentValues = {
        id: 'existing-id',
      };

      // submitter cannot update existing id
      expect(() =>
        validateWrite('submitter', ['id'], currentValues)
      ).toThrow(InvalidWriterError);

      // submitter cannot update settlement fields at all
      expect(() =>
        validateWrite('submitter', ['settlement_status'], {})
      ).toThrow(InvalidWriterError);

      // settler can update settlement_status
      expect(() =>
        validateWrite('settler', ['settlement_status'], {})
      ).not.toThrow();
    });
  });
});

// ============================================================
// DOCUMENTATION HELPERS TESTS
// ============================================================

describe('Documentation Helpers', () => {
  it('getAllowedTransitionsFrom returns valid transitions', () => {
    const fromSubmitted = getAllowedTransitionsFrom('SUBMITTED');
    expect(fromSubmitted.length).toBeGreaterThan(0);
    expect(fromSubmitted.every((t) => t.from === 'SUBMITTED')).toBe(true);
  });

  it('getForbiddenTransitions returns documented forbidden transitions', () => {
    const forbidden = getForbiddenTransitions();
    expect(forbidden.length).toBeGreaterThan(0);
    expect(forbidden.every((t) => typeof t.reason === 'string')).toBe(true);
  });

  it('getFieldsByWriter groups fields correctly', () => {
    const byWriter = getFieldsByWriter();
    expect(byWriter.submitter).toContain('id');
    expect(byWriter.submitter).toContain('selection');
    expect(byWriter.poster).toContain('posted_to_discord');
    expect(byWriter.settler).toContain('settlement_status');
  });

  it('getImmutableFields returns all immutable fields', () => {
    const immutable = getImmutableFields();
    expect(immutable).toContain('id');
    expect(immutable).toContain('selection');
    expect(immutable).toContain('posted_to_discord');
    expect(immutable).toContain('settlement_hash');
  });

  it('getAuthorizedFields returns fields for each role', () => {
    const submitterFields = getAuthorizedFields('submitter');
    expect(submitterFields).toContain('id');
    expect(submitterFields).toContain('selection');
    expect(submitterFields).not.toContain('settlement_status');

    const settlerFields = getAuthorizedFields('settler');
    expect(settlerFields).toContain('settlement_status');
    expect(settlerFields).toContain('settlement_result');
  });

  it('getAllowedWriters returns writers for each field', () => {
    expect(getAllowedWriters('id')).toContain('submitter');
    expect(getAllowedWriters('settlement_status')).toContain('settler');
    expect(getAllowedWriters('settlement_status')).toContain('operator_override');
    expect(getAllowedWriters('posted_to_discord')).toContain('poster');
  });
});

// ============================================================
// COMPREHENSIVE LIFECYCLE SCENARIOS
// ============================================================

describe('Lifecycle Scenarios', () => {
  it('validates complete happy path: SUBMITTED -> QUEUED -> POSTED -> SETTLED', () => {
    // Step 1: Fresh pick (SUBMITTED)
    const pick = createBasePick({
      placed_at: new Date('2026-02-18T10:00:00Z'),
    });
    expect(deriveLifecycleStage(pick)).toBe('SUBMITTED');

    // Step 2: Promoter queues pick
    const queuedPick = {
      ...pick,
      promotion_status: 'queued' as const,
      promotion_queued_at: new Date('2026-02-18T10:01:00Z'),
    };
    expect(() =>
      assertTransition('SUBMITTED', 'QUEUED', { pickId: pick.id, writerRole: 'promoter' })
    ).not.toThrow();
    expect(deriveLifecycleStage(queuedPick)).toBe('QUEUED');

    // Step 3: Poster posts to Discord
    const postedPick = {
      ...queuedPick,
      posted_to_discord: true,
      discord_message_id: 'msg-123',
      promotion_status: 'promoted' as const,
      promotion_posted_at: new Date('2026-02-18T10:02:00Z'),
    };
    expect(() =>
      assertTransition('QUEUED', 'POSTED', { pickId: pick.id, writerRole: 'poster' })
    ).not.toThrow();
    expect(deriveLifecycleStage(postedPick)).toBe('POSTED');

    // Step 4: Settler settles pick
    const settledPick = {
      ...postedPick,
      settlement_status: 'settled' as const,
      settlement_result: 'win' as const,
      settled_at: new Date('2026-02-18T15:00:00Z'),
      status: 'won' as const,
    };
    expect(() =>
      assertTransition('POSTED', 'SETTLED', { pickId: pick.id, writerRole: 'settler' })
    ).not.toThrow();
    expect(deriveLifecycleStage(settledPick)).toBe('SETTLED');

    // Validate final state invariants
    expect(() => validateInvariants(settledPick)).not.toThrow();
  });

  it('validates blocked recovery path: SUBMITTED -> BLOCKED -> QUEUED -> POSTED', () => {
    const pick = createBasePick();

    // Block by promoter
    expect(() =>
      assertTransition('SUBMITTED', 'BLOCKED', { pickId: pick.id, writerRole: 'promoter' })
    ).not.toThrow();

    // Only operator_override can unblock
    expect(() =>
      assertTransition('BLOCKED', 'QUEUED', { pickId: pick.id, writerRole: 'promoter' })
    ).toThrow(InvalidTransitionError);

    expect(() =>
      assertTransition('BLOCKED', 'QUEUED', { pickId: pick.id, writerRole: 'operator_override' })
    ).not.toThrow();
  });

  it('validates failed recovery path: QUEUED -> FAILED -> QUEUED -> POSTED', () => {
    const pick = createBasePick({ promotion_status: 'queued' });

    // Poster fails
    expect(() =>
      assertTransition('QUEUED', 'FAILED', { pickId: pick.id, writerRole: 'poster' })
    ).not.toThrow();

    // Promoter or operator_override can retry
    expect(() =>
      assertTransition('FAILED', 'QUEUED', { pickId: pick.id, writerRole: 'promoter' })
    ).not.toThrow();
  });

  it('validates dispute handling: SETTLED -> DISPUTED -> SETTLED', () => {
    const pick = createBasePick({
      settlement_status: 'settled',
      settlement_result: 'win',
      settled_at: new Date('2026-02-18T15:00:00Z'),
    });

    // Only operator_override can dispute
    expect(() =>
      assertTransition('SETTLED', 'DISPUTED', { pickId: pick.id, writerRole: 'settler' })
    ).toThrow(InvalidTransitionError);

    expect(() =>
      assertTransition('SETTLED', 'DISPUTED', { pickId: pick.id, writerRole: 'operator_override' })
    ).not.toThrow();

    // Settler or operator_override can re-settle
    expect(() =>
      assertTransition('DISPUTED', 'SETTLED', { pickId: pick.id, writerRole: 'settler' })
    ).not.toThrow();
  });

  it('validates void path from both POSTED and SETTLED', () => {
    const pick = createBasePick();

    // Void from POSTED
    expect(() =>
      assertTransition('POSTED', 'VOID', { pickId: pick.id, writerRole: 'settler' })
    ).not.toThrow();

    // Void from SETTLED
    expect(() =>
      assertTransition('SETTLED', 'VOID', { pickId: pick.id, writerRole: 'operator_override' })
    ).not.toThrow();
  });

  it('prevents invalid regression paths', () => {
    const pick = createBasePick();

    // Cannot go backwards from POSTED
    expect(() =>
      assertTransition('POSTED', 'SUBMITTED', { pickId: pick.id, writerRole: 'submitter' })
    ).toThrow(InvalidTransitionError);

    expect(() =>
      assertTransition('POSTED', 'QUEUED', { pickId: pick.id, writerRole: 'promoter' })
    ).toThrow(InvalidTransitionError);

    // Cannot go backwards from SETTLED
    expect(() =>
      assertTransition('SETTLED', 'POSTED', { pickId: pick.id, writerRole: 'poster' })
    ).toThrow(InvalidTransitionError);

    // Cannot revive CANCELLED
    expect(() =>
      assertTransition('CANCELLED', 'SUBMITTED', { pickId: pick.id, writerRole: 'submitter' })
    ).toThrow(InvalidTransitionError);
  });
});

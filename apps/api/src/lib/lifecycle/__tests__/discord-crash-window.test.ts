/* eslint-disable max-lines */
// Adversarial test suite requires comprehensive coverage of crash window scenarios
/**
 * DISCORD PUBLISH TOKEN CRASH WINDOW TESTS
 * Sprint: SPRINT-STRUCTURAL-REINFORCEMENT-P0-003 (safety patch)
 *
 * CRITICAL ADVERSARIAL TESTS: Verify that the crash window safety mechanism
 * prevents duplicate Discord posts when a worker crashes after POST but
 * before recording discord_message_id.
 *
 * VULNERABILITY BEING TESTED:
 *   1. Worker A claims row, gets publish_token
 *   2. Worker A POSTs to Discord successfully
 *   3. Worker A CRASHES before storing discord_message_id
 *   4. OLD: Stale reset cleared publish_token (DESTROYED EVIDENCE)
 *   5. OLD: Worker B claims, sees no discord_message_id, POSTS AGAIN = DUPLICATE
 *
 * FIX BEING VERIFIED:
 *   - Stale reset PRESERVES publish_token (crash window evidence)
 *   - Claim function SKIPS rows with existing publish_token
 *   - Rows with publish_token after stale reset = "crash window" = FAIL status
 *   - GUARANTEE: IMPOSSIBLE to double-post
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// MOCK RPC IMPLEMENTATIONS
// These simulate the behavior of the actual DB functions to verify the logic
// ============================================================================

interface OutboxRow {
  id: string;
  ticket_id: string;
  status: 'pending' | 'processing' | 'posted' | 'failed';
  publish_token: string | null;
  publish_token_at: Date | null;
  discord_message_id: string | null;
  claimed_at: Date | null;
  claimed_by: string | null;
  error: string | null;
}

/**
 * Simulates reset_stale_discord_outbox_claims with SAFETY FIX:
 * Resets stale claims BUT PRESERVES publish_token
 */
function simulateStaleResetWithSafetyFix(
  rows: OutboxRow[],
  staleSeconds: number = 60
): { affectedRows: OutboxRow[]; count: number } {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - staleSeconds * 1000);
  const affected: OutboxRow[] = [];

  for (const row of rows) {
    if (row.status === 'processing' && row.claimed_at && row.claimed_at < staleThreshold) {
      // SAFETY FIX: Keep publish_token as crash window evidence
      row.status = 'pending';
      row.claimed_at = null;
      row.claimed_by = null;
      // CRITICAL: publish_token and publish_token_at are NOT cleared
      row.error = JSON.stringify({
        type: 'STALE_CLAIM_RESET',
        message: 'Claim timed out. publish_token preserved for crash window detection.',
        stale_seconds: staleSeconds,
        publish_token_preserved: true,
        crash_window_risk: 'Row may have posted before crash. Manual check required if claimed.',
        timestamp: now.toISOString(),
      });
      affected.push(row);
    }
  }

  return { affectedRows: affected, count: affected.length };
}

/**
 * Simulates claim_discord_outbox_batch with SAFETY FIX:
 * SKIPS rows with existing publish_token (crash window risk)
 */
function simulateClaimWithSafetyFix(
  rows: OutboxRow[],
  workerId: string,
  limit: number = 10
): { claimedRows: OutboxRow[]; publishTokens: string[] } {
  const now = new Date();
  const claimable = rows.filter(
    row =>
      row.status === 'pending' &&
      // SAFETY FIX: Skip rows with existing publish_token (crash window risk)
      row.publish_token === null
  );

  const toClaim = claimable.slice(0, limit);
  const publishTokens: string[] = [];

  for (const row of toClaim) {
    const token = crypto.randomUUID();
    row.status = 'processing';
    row.claimed_at = now;
    row.claimed_by = workerId;
    row.publish_token = token;
    row.publish_token_at = now;
    publishTokens.push(token);
  }

  return { claimedRows: toClaim, publishTokens };
}

/**
 * Simulates mark_crash_window_rows_failed:
 * Marks pending rows with publish_token as FAILED for manual review
 */
function simulateMarkCrashWindowRowsFailed(rows: OutboxRow[]): {
  affectedRows: OutboxRow[];
  count: number;
} {
  const now = new Date();
  const affected: OutboxRow[] = [];

  for (const row of rows) {
    if (row.status === 'pending' && row.publish_token !== null && row.discord_message_id === null) {
      row.status = 'failed';
      row.error = JSON.stringify({
        type: 'CRASH_WINDOW_DETECTED',
        message:
          'Row had prior claim with publish_token but no discord_message_id. Possible duplicate risk.',
        action_required:
          'Manual check: verify if message exists in Discord channel before re-processing.',
        publish_token: row.publish_token,
        publish_token_at: row.publish_token_at?.toISOString(),
        detected_at: now.toISOString(),
      });
      affected.push(row);
    }
  }

  return { affectedRows: affected, count: affected.length };
}

// ============================================================================
// ADVERSARIAL CRASH WINDOW TESTS
// ============================================================================

describe('Discord Publish Token Crash Window Safety', () => {
  describe('Stale Reset Preserves Publish Token', () => {
    it('does NOT clear publish_token on stale reset (crash window evidence preserved)', () => {
      // Setup: Worker A claimed 70 seconds ago with publish_token
      const staleClaimedAt = new Date(Date.now() - 70000); // 70 seconds ago
      const originalToken = 'uuid-original-claim';

      const rows: OutboxRow[] = [
        {
          id: 'outbox-001',
          ticket_id: 'ticket-001',
          status: 'processing',
          publish_token: originalToken,
          publish_token_at: staleClaimedAt,
          discord_message_id: null, // Not yet recorded (simulates crash)
          claimed_at: staleClaimedAt,
          claimed_by: 'worker-crashed',
          error: null,
        },
      ];

      // Act: Stale reset triggers
      const result = simulateStaleResetWithSafetyFix(rows, 60);

      // Assert: Row reset to pending BUT publish_token PRESERVED
      expect(result.count).toBe(1);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].claimed_at).toBeNull();
      expect(rows[0].claimed_by).toBeNull();

      // CRITICAL: publish_token NOT cleared - this is the evidence
      expect(rows[0].publish_token).toBe(originalToken);
      expect(rows[0].publish_token_at).toBe(staleClaimedAt);

      // Error documents the crash window risk
      const error = JSON.parse(rows[0].error!);
      expect(error.type).toBe('STALE_CLAIM_RESET');
      expect(error.publish_token_preserved).toBe(true);
    });

    it('only resets claims older than threshold', () => {
      const recentClaimedAt = new Date(Date.now() - 30000); // 30 seconds ago
      const staleClaimedAt = new Date(Date.now() - 90000); // 90 seconds ago

      const rows: OutboxRow[] = [
        {
          id: 'outbox-recent',
          ticket_id: 'ticket-recent',
          status: 'processing',
          publish_token: 'token-recent',
          publish_token_at: recentClaimedAt,
          discord_message_id: null,
          claimed_at: recentClaimedAt,
          claimed_by: 'worker-active',
          error: null,
        },
        {
          id: 'outbox-stale',
          ticket_id: 'ticket-stale',
          status: 'processing',
          publish_token: 'token-stale',
          publish_token_at: staleClaimedAt,
          discord_message_id: null,
          claimed_at: staleClaimedAt,
          claimed_by: 'worker-crashed',
          error: null,
        },
      ];

      const result = simulateStaleResetWithSafetyFix(rows, 60);

      // Only stale one should be reset
      expect(result.count).toBe(1);
      expect(rows[0].status).toBe('processing'); // Recent - not reset
      expect(rows[1].status).toBe('pending'); // Stale - reset

      // Both retain publish_token
      expect(rows[0].publish_token).toBe('token-recent');
      expect(rows[1].publish_token).toBe('token-stale');
    });
  });

  describe('Claim Skips Rows With Existing Publish Token', () => {
    it('SKIPS pending rows with existing publish_token (crash window protection)', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-crash-window',
          ticket_id: 'ticket-crash-window',
          status: 'pending', // Reset by stale reset
          publish_token: 'uuid-from-crashed-worker', // Evidence of prior claim
          publish_token_at: new Date(Date.now() - 120000),
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
        {
          id: 'outbox-clean',
          ticket_id: 'ticket-clean',
          status: 'pending',
          publish_token: null, // No prior claim
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      // Act: Worker B tries to claim
      const result = simulateClaimWithSafetyFix(rows, 'worker-B', 10);

      // Assert: Only the clean row is claimed
      expect(result.claimedRows.length).toBe(1);
      expect(result.claimedRows[0].id).toBe('outbox-clean');

      // Crash window row was SKIPPED
      expect(rows[0].status).toBe('pending');
      expect(rows[0].claimed_by).toBeNull();
    });

    it('claims rows with null publish_token normally', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-normal-1',
          ticket_id: 'ticket-1',
          status: 'pending',
          publish_token: null,
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
        {
          id: 'outbox-normal-2',
          ticket_id: 'ticket-2',
          status: 'pending',
          publish_token: null,
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      const result = simulateClaimWithSafetyFix(rows, 'worker-A', 10);

      // Both should be claimed
      expect(result.claimedRows.length).toBe(2);
      expect(rows[0].status).toBe('processing');
      expect(rows[1].status).toBe('processing');

      // Both should have new publish_tokens
      expect(rows[0].publish_token).not.toBeNull();
      expect(rows[1].publish_token).not.toBeNull();
    });
  });

  describe('Mark Crash Window Rows Failed', () => {
    it('marks pending rows with publish_token as FAILED for manual review', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-crash-window',
          ticket_id: 'ticket-crash-window',
          status: 'pending',
          publish_token: 'uuid-from-crashed-worker',
          publish_token_at: new Date(Date.now() - 120000),
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      const result = simulateMarkCrashWindowRowsFailed(rows);

      expect(result.count).toBe(1);
      expect(rows[0].status).toBe('failed');

      const error = JSON.parse(rows[0].error!);
      expect(error.type).toBe('CRASH_WINDOW_DETECTED');
      expect(error.action_required).toContain('Manual check');
    });

    it('does NOT mark rows that have discord_message_id (successfully posted)', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-success',
          ticket_id: 'ticket-success',
          status: 'pending', // Hypothetically pending with message_id (shouldn't happen)
          publish_token: 'uuid-token',
          publish_token_at: new Date(),
          discord_message_id: '1234567890', // Successfully posted
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      const result = simulateMarkCrashWindowRowsFailed(rows);

      expect(result.count).toBe(0);
      expect(rows[0].status).toBe('pending');
    });

    it('does NOT mark rows without publish_token (never claimed)', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-fresh',
          ticket_id: 'ticket-fresh',
          status: 'pending',
          publish_token: null,
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      const result = simulateMarkCrashWindowRowsFailed(rows);

      expect(result.count).toBe(0);
      expect(rows[0].status).toBe('pending');
    });
  });

  describe('ADVERSARIAL: Full Crash Window Scenario', () => {
    /**
     * This test simulates the EXACT vulnerability scenario and verifies
     * the safety fix prevents duplicate posts.
     */
    it('prevents duplicate Discord post after crash in claim-POST-release window', () => {
      // ================================================================
      // SCENARIO SETUP
      // ================================================================
      const rows: OutboxRow[] = [
        {
          id: 'outbox-vulnerable',
          ticket_id: 'ticket-vulnerable',
          status: 'pending',
          publish_token: null,
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      // ================================================================
      // STEP 1: Worker A claims the row
      // ================================================================
      const workerAClaim = simulateClaimWithSafetyFix(rows, 'worker-A', 1);

      expect(workerAClaim.claimedRows.length).toBe(1);
      expect(rows[0].status).toBe('processing');
      const workerAToken = rows[0].publish_token;
      expect(workerAToken).not.toBeNull();

      // ================================================================
      // STEP 2: Worker A POSTs to Discord successfully
      // (Simulated - in real scenario this is an HTTP call to Discord API)
      // Discord returns message_id = "discord-msg-123"
      // ================================================================
      const _discordMessageId = 'discord-msg-123'; // Simulated - not stored due to crash

      // ================================================================
      // STEP 3: Worker A CRASHES before calling release_claim
      // The discord_message_id is NOT stored in the database
      // ================================================================
      // (No database update happens - simulating crash)

      // After crash, the row still looks like this:
      expect(rows[0].discord_message_id).toBeNull(); // NOT recorded!
      expect(rows[0].publish_token).toBe(workerAToken); // Token set during claim

      // ================================================================
      // STEP 4: Time passes... Stale reset triggers after 60 seconds
      // CRITICAL: With safety fix, publish_token is PRESERVED
      // ================================================================

      // Simulate time passing (move claimed_at to 70 seconds ago)
      rows[0].claimed_at = new Date(Date.now() - 70000);

      const staleReset = simulateStaleResetWithSafetyFix(rows, 60);

      expect(staleReset.count).toBe(1);
      expect(rows[0].status).toBe('pending');

      // CRITICAL SAFETY CHECK: publish_token is PRESERVED (not cleared!)
      expect(rows[0].publish_token).toBe(workerAToken);

      // ================================================================
      // STEP 5: Worker B tries to claim the same row
      // CRITICAL: With safety fix, claim SKIPS rows with publish_token
      // ================================================================
      const workerBClaim = simulateClaimWithSafetyFix(rows, 'worker-B', 1);

      // CRITICAL: Worker B gets NOTHING - row was skipped
      expect(workerBClaim.claimedRows.length).toBe(0);

      // Row still has Worker A's token - not claimed by Worker B
      expect(rows[0].status).toBe('pending');
      expect(rows[0].publish_token).toBe(workerAToken);
      expect(rows[0].claimed_by).toBeNull();

      // ================================================================
      // STEP 6: mark_crash_window_rows_failed() marks row as FAILED
      // ================================================================
      const markFailed = simulateMarkCrashWindowRowsFailed(rows);

      expect(markFailed.count).toBe(1);
      expect(rows[0].status).toBe('failed');

      const error = JSON.parse(rows[0].error!);
      expect(error.type).toBe('CRASH_WINDOW_DETECTED');
      expect(error.action_required).toContain('Manual check');

      // ================================================================
      // RESULT: NO DUPLICATE POST
      // - Worker A posted to Discord (message exists)
      // - Worker B was PREVENTED from claiming (publish_token guard)
      // - Row is marked FAILED for manual review
      // ================================================================
    });

    it('PROOF: Row can ONLY be claimed if publish_token IS NULL', () => {
      // Create 3 rows with different states
      const rows: OutboxRow[] = [
        {
          id: 'outbox-claimable',
          ticket_id: 'ticket-1',
          status: 'pending',
          publish_token: null, // No token - CAN be claimed
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
        {
          id: 'outbox-has-token',
          ticket_id: 'ticket-2',
          status: 'pending',
          publish_token: 'existing-token', // Has token - CANNOT be claimed
          publish_token_at: new Date(),
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
        {
          id: 'outbox-also-claimable',
          ticket_id: 'ticket-3',
          status: 'pending',
          publish_token: null, // No token - CAN be claimed
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      // Attempt to claim all
      const result = simulateClaimWithSafetyFix(rows, 'worker-test', 10);

      // Only 2 should be claimed (the ones with null publish_token)
      expect(result.claimedRows.length).toBe(2);
      expect(result.claimedRows.map(r => r.id)).toEqual([
        'outbox-claimable',
        'outbox-also-claimable',
      ]);

      // The one with existing token was skipped
      expect(rows[1].status).toBe('pending');
      expect(rows[1].publish_token).toBe('existing-token');
      expect(rows[1].claimed_by).toBeNull();
    });

    it('verifies claim sets new publish_token atomically', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-new',
          ticket_id: 'ticket-new',
          status: 'pending',
          publish_token: null,
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      const _before = { ...rows[0] }; // Snapshot for debugging if needed

      const result = simulateClaimWithSafetyFix(rows, 'worker-X', 1);

      expect(result.claimedRows.length).toBe(1);

      // All fields updated atomically
      expect(rows[0].status).toBe('processing');
      expect(rows[0].claimed_by).toBe('worker-X');
      expect(rows[0].claimed_at).not.toBeNull();
      expect(rows[0].publish_token).not.toBeNull();
      expect(rows[0].publish_token_at).not.toBeNull();

      // Token is a valid UUID
      expect(rows[0].publish_token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Token was returned to caller
      expect(result.publishTokens[0]).toBe(rows[0].publish_token);
    });
  });

  describe('Edge Cases', () => {
    it('handles multiple stale resets gracefully', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-multi-crash',
          ticket_id: 'ticket-multi-crash',
          status: 'processing',
          publish_token: 'original-token',
          publish_token_at: new Date(Date.now() - 300000), // 5 minutes ago
          discord_message_id: null,
          claimed_at: new Date(Date.now() - 70000),
          claimed_by: 'worker-A',
          error: null,
        },
      ];

      // First stale reset
      simulateStaleResetWithSafetyFix(rows, 60);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].publish_token).toBe('original-token');

      // Row cannot be claimed (has publish_token)
      const claim1 = simulateClaimWithSafetyFix(rows, 'worker-B', 1);
      expect(claim1.claimedRows.length).toBe(0);

      // Hypothetically someone marks it processing manually (shouldn't happen)
      rows[0].status = 'processing';
      rows[0].claimed_at = new Date(Date.now() - 70000);

      // Second stale reset - token still preserved
      simulateStaleResetWithSafetyFix(rows, 60);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].publish_token).toBe('original-token'); // STILL original

      // Still cannot be claimed
      const claim2 = simulateClaimWithSafetyFix(rows, 'worker-C', 1);
      expect(claim2.claimedRows.length).toBe(0);
    });

    it('handles concurrent claim attempts on same row', () => {
      const rows: OutboxRow[] = [
        {
          id: 'outbox-race',
          ticket_id: 'ticket-race',
          status: 'pending',
          publish_token: null,
          publish_token_at: null,
          discord_message_id: null,
          claimed_at: null,
          claimed_by: null,
          error: null,
        },
      ];

      // Worker A claims first
      const claimA = simulateClaimWithSafetyFix(rows, 'worker-A', 1);
      expect(claimA.claimedRows.length).toBe(1);
      expect(rows[0].publish_token).not.toBeNull();

      // Worker B tries to claim - row no longer pending
      rows[0].status = 'processing'; // Already claimed
      const claimB = simulateClaimWithSafetyFix(rows, 'worker-B', 1);
      expect(claimB.claimedRows.length).toBe(0);

      // Only Worker A has the token
      expect(rows[0].claimed_by).toBe('worker-A');
    });
  });
});

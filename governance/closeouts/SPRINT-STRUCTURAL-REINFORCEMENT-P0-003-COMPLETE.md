# SPRINT CLOSEOUT: SPRINT-STRUCTURAL-REINFORCEMENT-P0-003

**Sprint**: SPRINT-STRUCTURAL-REINFORCEMENT-P0-003 **Status**: COMPLETE
**Date**: 2026-02-27 **Commits**: c8ab9cfc, e5f6416d

---

## Objective

Eliminate remaining structural weaknesses via:

1. Operator Identity Truth Lock (auth.uid-derived only)
2. Discord Publish Idempotency Truth Lock (atomic + durable)
3. **Crash Window Safety Patch** (prevents duplicate Discord posts)

---

## Deliverables

### Part A: Operator Identity Truth Lock

| File                                             | Change                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `apps/api/src/middleware/operatorAuth.ts`        | NEW - JWT-based operator auth middleware                               |
| `apps/api/src/routes/ops.ts`                     | Updated /settle, /retry-posting, /retry-settlement to use operatorAuth |
| `apps/api/src/lib/lifecycle/writer-authority.ts` | Added spoof logging + permission validation                            |

**Enforcement**:

- Authority derived from JWT principal (auth.uid) ONLY
- x-operator-id header IGNORED for authorization
- Spoof attempts logged to security_events table

### Part B: Discord Publish Idempotency Truth Lock

| File                                                                      | Change                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `supabase/migrations/20260227100000_discord_publish_token_truth_lock.sql` | NEW - publish_token column + unique constraint |
| `apps/api/src/consumers/DiscordTicketWorker.ts`                           | Updated to pass publish_token to release_claim |

**Enforcement**:

- publish_token UUID set DURING claim, BEFORE POST
- UNIQUE INDEX(publish_token) WHERE NOT NULL - DB-level guarantee
- Crash window safety via idempotency check

### Part C: Crash Window Safety Patch

| File                                                                        | Change                                     |
| --------------------------------------------------------------------------- | ------------------------------------------ |
| `supabase/migrations/20260227110000_discord_publish_token_crash_safety.sql` | CRITICAL FIX - Stale reset preserves token |
| `apps/api/src/lib/lifecycle/__tests__/discord-crash-window.test.ts`         | NEW - 12 adversarial tests                 |

**Vulnerability Patched**:

- OLD: Stale reset cleared publish_token (destroyed crash evidence)
- OLD: Worker B could claim and POST again = DUPLICATE
- NEW: Stale reset PRESERVES publish_token
- NEW: Claim function SKIPS rows with existing publish_token
- NEW: mark_crash_window_rows_failed() marks for manual review

**GUARANTEE**: A row can ONLY be claimed if `publish_token IS NULL`.

---

## Verification

| Check              | Status                   |
| ------------------ | ------------------------ |
| Type-check         | PASS                     |
| Lifecycle gate     | PASS (no new violations) |
| Idempotency tests  | PASS (30/30)             |
| Crash window tests | PASS (12/12)             |
| Build              | PASS                     |

---

## Tag Request

CI should mint: `SPRINT-STRUCTURAL-REINFORCEMENT-P0-003-COMPLETE`

---

## Sign-off

- [x] Type check passes
- [x] Lifecycle gate passes
- [x] Tests pass (42/42 total)
- [x] Build succeeds
- [x] Proof artifacts generated
- [x] Crash window vulnerability patched
- [x] No duplicate Discord posts possible

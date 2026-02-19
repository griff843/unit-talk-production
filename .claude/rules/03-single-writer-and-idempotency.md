# Rule 03: Single-Writer and Idempotency

> Reference: `CLAUDE_EXECUTION_CONTRACT.md` Section I, V

## Single-Writer Principle

### The Rule

**Only designated writers may write to canonical tables.**

For `unified_picks`, ALL writes MUST go through lifecycle adapters.

### Lifecycle Adapters

```typescript
// Location: apps/api/src/lib/lifecycle/

// For inserts (submitter/promoter roles)
import { lifecycleInsert } from '../lib/lifecycle';
await lifecycleInsert(supabase, pick, { writerRole: 'submitter' });

// For updates (any authorized role)
import { lifecycleUpdate } from '../lib/lifecycle';
await lifecycleUpdate(supabase, pickId, updates, { writerRole: 'poster' });

// For posting claims (idempotent)
import { atomicClaimForPost } from '../lib/lifecycle';
await atomicClaimForPost(supabase, pickId);

// For parlay claims (idempotent)
import { atomicClaimParlayForPost } from '../lib/lifecycle';
await atomicClaimParlayForPost(supabase, pickIds);

// For settlement
import { lifecycleSettle } from '../lib/lifecycle';
await lifecycleSettle(supabase, pickId, settlement, { writerRole: 'settler' });
```

### Writer Roles

| Role | Can Write | Use Case |
|------|-----------|----------|
| `submitter` | Initial pick fields | Smart Form submission |
| `promoter` | Promotion fields, tier | GradingAgent promotion |
| `poster` | Discord fields, meta | DiscordPromotionAgent |
| `settler` | Settlement fields | SettlementAgent |
| `operator_override` | ALL fields | Emergency manual fixes |

### Forbidden Patterns

```typescript
// NEVER DO THIS:
await supabase.from('unified_picks').insert(pick);
await supabase.from('unified_picks').update(updates).eq('id', id);

// ALWAYS DO THIS:
await lifecycleInsert(supabase, pick, { writerRole: 'submitter' });
await lifecycleUpdate(supabase, id, updates, { writerRole: 'poster' });
```

## Idempotency

### The Principle

**Same input → Same output, no side effects on replay.**

### Atomic Claim Pattern

```typescript
// Posting claim - only succeeds if not already posted
const result = await atomicClaimForPost(supabase, pickId);
if (!result.claimed) {
  // Already posted - skip silently (idempotent)
  return;
}
// Proceed with posting...
```

### Idempotency Guards

| Operation | Guard Field | Pattern |
|-----------|-------------|---------|
| Submit | `bet_slip_id` | Check existence before insert |
| Post | `posted_to_discord` | Atomic claim (WHERE false → true) |
| Settle | `settlement_status` | Atomic claim (WHERE pending → settled) |

### Checking Idempotency

```typescript
import {
  checkSubmitIdempotency,
  checkPostIdempotency,
  checkSettleIdempotency
} from '../lib/lifecycle';

// Before submit
const submitCheck = await checkSubmitIdempotency(supabase, betSlipId);
if (submitCheck.isDuplicate) {
  // Already submitted
  return { existingId: submitCheck.existingId };
}

// Before post
const postCheck = await checkPostIdempotency(supabase, pickId);
if (postCheck.isDuplicate) {
  // Already posted
  return;
}
```

## Gate Enforcement

### CI Gate

```bash
# Run in strict mode - fails on ANY violation
npm run lifecycle:single-writer -- --strict

# Expected output on success:
# ✅ GATE PASSED
# Files scanned: XXX
# Violations found: 0
# Allowlisted files: 0
```

### Allowed Exceptions (Gate Patterns)

The gate allows:
- Files in `lib/lifecycle/` (the adapters themselves)
- Files matching `.test.ts` or `.spec.ts`
- Files in `scripts/smoke-*` (test utilities)
- Files in `runner/fix*` (development utilities)

## Audit Procedure

See `.claude/skills/single_writer_audit.md` for full audit checklist.

Quick check:
```bash
# Find potential violations
rg "\.from\s*\(\s*['\"]unified_picks['\"]\s*\)\s*\.\s*(insert|update)" apps/api/src --type ts

# Verify all are via lifecycle adapters
# (Should only match lifecycle module files)
```

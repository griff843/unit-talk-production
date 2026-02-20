# Sprint Verification Runbook

**Document**: SPRINT_VERIFICATION_RUNBOOK.md **Created**: 2026-02-20 **Sprint**:
SPRINT-OPS-SUBMIT-COMPLIANCE-071C

---

## Purpose

This runbook documents the fail-closed verification process for sprint work. All
sprint changes MUST pass verification before commit/merge.

---

## Quick Reference

### Before ANY sprint commit:

```bash
# Run verification for your module
npm run verify:sprint -- --ops-submit    # For ops-submit changes
npm run verify:sprint -- --api           # For API changes
npm run verify:sprint -- --full          # For cross-cutting changes
```

### The ONE command for ops-submit work:

```bash
npm run verify:ops-submit
```

---

## Verification Lanes

### 1. Ops-Submit Verification (`--ops-submit`)

Verifies:

- API workspace typecheck (full)
- Command Center ops-submit targeted typecheck
- ESLint for ops-submit files

```bash
npm run verify:sprint -- --ops-submit
```

### 2. API Verification (`--api`)

Verifies:

- API workspace typecheck
- API linting

```bash
npm run verify:sprint -- --api
```

### 3. Full Verification (`--full`)

Runs all verification lanes.

```bash
npm run verify:sprint -- --full
```

---

## Why Targeted Verification?

The Command Center has pre-existing TypeScript errors in admin/agent routes due
to missing Supabase database types. These are tracked for resolution in a
separate sprint (DB types regeneration).

Rather than weaken governance globally, we use targeted verification that:

1. Verifies sprint-relevant code is type-safe
2. Maintains fail-closed semantics
3. Does not block unrelated work

---

## CI Integration

Pre-commit hooks should call the appropriate verification lane based on changed
files:

```bash
# In .husky/pre-commit
if git diff --cached --name-only | grep -q "apps/command-center/src/app/dashboard/ops-submit\|apps/command-center/src/app/api/ops"; then
  npm run verify:ops-submit || exit 1
fi

if git diff --cached --name-only | grep -q "apps/api/"; then
  npm run verify:sprint -- --api || exit 1
fi
```

---

## Proof Capture

When closing a sprint, capture verification output:

```bash
# Create proof directory
mkdir -p out/sprints/SPRINT-NAME/$(date +%Y-%m-%d)/proofs

# Capture verification
npm run verify:sprint -- --ops-submit > out/sprints/SPRINT-NAME/$(date +%Y-%m-%d)/proofs/proof_verify_lane.txt 2>&1
```

---

## Troubleshooting

### "Command not found: typecheck:ops-submit"

Run from command-center directory:

```bash
cd apps/command-center && npm run typecheck:ops-submit
```

### TypeScript errors in ops-submit files

Fix the errors - targeted verification is working correctly.

### TypeScript errors in unrelated files

These are pre-existing and excluded from targeted verification. Do not use
`--no-verify` to bypass them.

---

**Governance Owner**: Engineering Team

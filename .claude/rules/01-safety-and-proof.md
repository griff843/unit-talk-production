# Rule 01: Safety and Proof

> Reference: `CLAUDE_EXECUTION_CONTRACT.md` Section II, III

## Core Principle

**No claims without proof.**

Any statement of completion, success, or status MUST be backed by:
1. Command output captured in proof files
2. Test results showing pass/fail
3. Gate outputs showing compliance

## Proof Requirements

### Minimum Proof Bundle

Every sprint completion requires:

```
out/sprints/<SPRINT>/<DATE>/proofs/
├── proof_git_status.txt      # git status output
├── proof_tests.txt           # npm run test output
├── proof_typecheck.txt       # npm run type-check output
├── proof_build.txt           # npm run build output (if applicable)
└── proof_gate.txt            # lifecycle gate output (if applicable)
```

### Generating Proofs

```bash
# Capture git status
git status > out/sprints/<SPRINT>/<DATE>/proofs/proof_git_status.txt 2>&1

# Capture tests
npm run test > out/sprints/<SPRINT>/<DATE>/proofs/proof_tests.txt 2>&1

# Capture type check
npm run type-check > out/sprints/<SPRINT>/<DATE>/proofs/proof_typecheck.txt 2>&1

# Capture lifecycle gate
npm run lifecycle:single-writer -- --strict > out/sprints/<SPRINT>/<DATE>/proofs/proof_gate.txt 2>&1
```

## Forbidden Claims

**NEVER say:**
- "100% complete"
- "Production ready"
- "All tests pass" (without proof)
- "X out of X passing" (hard-coded numbers)

**INSTEAD say:**
- "Tests passing per proof_tests.txt"
- "Gate passing per proof_gate.txt"
- "See SPRINT_CLOSEOUT_REPORT.md for verification"

## Safety Gates

Before any significant operation:

1. **Check current state**
   ```bash
   git status
   git diff
   ```

2. **Verify no breaking changes**
   ```bash
   npm run type-check
   npm run test
   ```

3. **Confirm reversibility**
   - Migrations have rollback
   - Changes can be reverted
   - No destructive operations without backup

## Escalation

Escalate to human if:
- Cannot generate required proofs
- Verification fails unexpectedly
- Destructive operation required
- Production data at risk

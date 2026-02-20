# Sprint Verification Runbook

**Document**: SPRINT_VERIFICATION_RUNBOOK.md **Updated**: 2026-02-20 **Sprint**:
SPRINT-CLAUDE-OS-GOVERNANCE-UPGRADE-079 **Authority**: See
`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`

---

## The ONE Command to Close Any Sprint

```bash
npm run sprint:close -- <SPRINT-ID>
```

This command:

1. Runs verification lane (full or scoped)
2. Generates proof_proof_inventory.txt
3. Validates required artifacts exist
4. Prints compliance table
5. Exits non-zero if any missing

---

## Quick Reference

### Sprint Closeout (PREFERRED)

```bash
# Close a sprint with auto-detected date folder
npm run sprint:close -- SPRINT-MY-SPRINT-001

# Close with explicit date
npm run sprint:close -- SPRINT-MY-SPRINT-001 --date 2026-02-20

# Close with specific verification lane
npm run sprint:close -- SPRINT-MY-SPRINT-001 --lane ops-submit
npm run sprint:close -- SPRINT-MY-SPRINT-001 --lane api
npm run sprint:close -- SPRINT-MY-SPRINT-001 --lane full
```

### Validate Only (no verification lane)

```bash
npm run sprint:validate -- SPRINT-MY-SPRINT-001
```

### Manual Verification (deprecated - use sprint:close)

```bash
npm run verify:sprint -- --ops-submit    # For ops-submit changes
npm run verify:sprint -- --api           # For API changes
npm run verify:sprint -- --full          # For cross-cutting changes
```

---

## Verification Lanes

### 1. Ops-Submit Lane (`--lane ops-submit`)

For changes to ops-submit module:

- API workspace typecheck (full)
- Command Center ops-submit targeted typecheck
- ESLint for ops-submit files

### 2. API Lane (`--lane api`)

For API-only changes:

- API workspace typecheck
- API linting

### 3. Full Lane (`--lane full`)

For cross-cutting changes:

- Full repo typecheck
- All tests

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

## POLICY: No --no-verify

The `--no-verify` flag is **PROHIBITED** for all sprint commits.

- Pre-commit hooks MUST run.
- If hooks fail, fix the issue. Do not bypass.
- Commits using `--no-verify` invalidate the sprint.

**Violation consequence**: Sprint marked FAILED.

---

## Required Proof Artifacts

Every sprint must have these artifacts (enforced by sprint:close):

| Artifact                         | Description              |
| -------------------------------- | ------------------------ |
| `proof_git_status.txt`           | Initial git state        |
| `proof_typecheck*.txt`           | TypeScript verification  |
| `proof_verify*.txt`              | Verification lane output |
| `proof_fetch_main.txt`           | Fetch from origin        |
| `proof_rebase_or_merge_main.txt` | Push/merge output        |
| `proof_tag_exists.txt`           | Tag creation proof       |
| `proof_git_status_clean.txt`     | Clean state after merge  |
| `proof_proof_inventory.txt`      | Auto-generated inventory |

---

## Troubleshooting

### "Command not found: typecheck:ops-submit"

Run from command-center directory:

```bash
cd apps/command-center && npm run typecheck:ops-submit
```

### "Sprint directory not found"

Create the sprint directory first:

```bash
mkdir -p out/sprints/SPRINT-MY-SPRINT-001/2026-02-20/proofs
```

### TypeScript errors in sprint files

Fix the errors - targeted verification is working correctly.

### TypeScript errors in unrelated files

These are pre-existing and excluded from targeted verification. Do NOT use
`--no-verify` to bypass them.

---

**Governance Owner**: Engineering Team

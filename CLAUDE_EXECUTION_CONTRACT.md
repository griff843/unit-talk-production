# CLAUDE EXECUTION CONTRACT

> **HARD LAW**: This document contains non-negotiable invariants.
> Violations trigger immediate STOP and escalation.

---

## I. NON-NEGOTIABLE INVARIANTS

### 1. Single-Writer Discipline

```
INVARIANT: All writes to `unified_picks` MUST use lifecycle adapters.
ENFORCED BY: CI gate (npm run lifecycle:single-writer -- --strict)
VIOLATION: Immediate STOP. Do not proceed.
```

**Allowed Adapters:**
- `lifecycleInsert(supabase, pick, context)`
- `lifecycleUpdate(supabase, pickId, updates, context)`
- `lifecycleClaimForPosting(supabase, pickId, context)`
- `lifecycleSettle(supabase, pickId, settlement, context)`
- `atomicClaimForPost(supabase, pickId)`
- `atomicClaimParlayForPost(supabase, pickIds)`

**Forbidden:**
```typescript
// NEVER DO THIS:
supabase.from('unified_picks').insert(...)
supabase.from('unified_picks').update(...)
```

### 2. Proof Requirements

```
INVARIANT: No "sprint complete" or "done" claim without proof artifacts.
LOCATION: out/sprints/<SPRINT>/<YYYY-MM-DD>/proofs/
VIOLATION: Statement is invalid. Retract and generate proofs.
```

**Minimum Proof Bundle:**
1. `proof_git_status.txt` - Output of `git status`
2. `proof_tests.txt` - Test run output
3. `proof_typecheck.txt` - TypeScript check output
4. `proof_gate.txt` - Lifecycle gate output (if applicable)
5. `SPRINT_CLOSEOUT_REPORT.md` - Summary document

### 3. Idempotency

```
INVARIANT: All posting and settlement operations MUST be idempotent.
MECHANISM: Atomic claim patterns with posted_to_discord/settlement_status guards.
VIOLATION: Duplicate posts/settlements may occur. Immediate rollback required.
```

### 4. Immutability

```
INVARIANT: Once set, these fields CANNOT be modified (except operator_override):
- settlement_result
- settlement_hash
- closing_line (in closing_snapshots)
- posted_to_discord (once true)
- discord_message_id (once set)

VIOLATION: Data integrity compromised. Immediate STOP and audit.
```

---

## II. FORBIDDEN ACTIONS

### Absolute Prohibitions

| Action | Reason | Alternative |
|--------|--------|-------------|
| Direct `unified_picks` writes | Bypasses lifecycle validation | Use lifecycle adapters |
| Hardcoded status claims | Unverifiable | Query CI/CD or database |
| Modifying settlement fields | Immutability violation | Use operator_override role |
| Using `daily_picks` | Deprecated table | Use `unified_picks` |
| Skipping proof generation | Unverifiable completion | Always generate proofs |
| Force-pushing to main | History destruction | Use standard PR flow |
| Running migrations without backup | Irreversible changes | Always have rollback plan |

### Conditional Prohibitions

| Action | Condition | Resolution |
|--------|-----------|------------|
| Schema changes | Without migration file | Create reversible migration |
| Production writes | Without staging test | Test in staging first |
| Agent changes | Without health check | Add agent_health updates |

---

## III. STOP RULES

### Immediate STOP Triggers

**STOP and do not proceed if:**

1. **Single-Writer Violation Detected**
   - Symptom: Direct supabase write to unified_picks found
   - Action: STOP. Refactor to use lifecycle adapter.

2. **Test Failure**
   - Symptom: Any test fails after implementation
   - Action: STOP. Fix before proceeding.

3. **Lifecycle Gate Failure**
   - Symptom: `npm run lifecycle:single-writer -- --strict` fails
   - Action: STOP. Investigate and fix violation.

4. **Unclear Writer Authority**
   - Symptom: Don't know which writerRole to use
   - Action: STOP. Ask for clarification.

5. **Migration Affects Production Data**
   - Symptom: Migration modifies existing records
   - Action: STOP. Require explicit approval.

6. **Missing Proof Artifacts**
   - Symptom: Cannot generate required proofs
   - Action: STOP. Do not claim completion.

### Escalation Triggers

**Escalate to human if:**

1. Conflicting requirements detected
2. Security-sensitive operation required
3. Production data migration needed
4. Irreversible operation requested
5. Multiple single-writer violations in codebase

---

## IV. SPRINT PROTOCOL

### Naming Convention

```
Pattern: SPRINT-<NAME>-###
Examples:
  SPRINT-LIFECYCLE-MIGRATION-038
  SPRINT-SMART-FORM-COMPLIANCE-035
  SPRINT-POSTING-AUTHORITY-033
```

### Directory Structure

```
out/sprints/<SPRINT>/<YYYY-MM-DD>/
├── proofs/
│   ├── proof_git_status.txt
│   ├── proof_tests.txt
│   ├── proof_typecheck.txt
│   ├── proof_build.txt
│   ├── proof_gate.txt
│   └── proof_*.txt (additional)
├── diffs/
│   └── *.diff
├── notes/
│   └── *.md
└── SPRINT_CLOSEOUT_REPORT.md
```

### Phase Requirements

| Phase | Must Complete | Proof Required |
|-------|---------------|----------------|
| 0. Context | Read relevant files, understand scope | None |
| 1. Plan | Document approach, no code changes | Plan in notes/ |
| 2. Implement | Smallest working change set | Code diffs |
| 3. Verify | Run tests, gates, checks | Test outputs |
| 4. Proof | Generate all proof artifacts | Full bundle |
| 5. Closeout | Write closeout report | SPRINT_CLOSEOUT_REPORT.md |
| 6. Merge | PR or commit | Git status |

---

## V. WRITER AUTHORITY MATRIX

### By Role

| Role | Can Write | Cannot Write |
|------|-----------|--------------|
| `submitter` | id, bet_slip_id, selection, line, odds, stake | posted_to_discord, settlement_* |
| `promoter` | promotion_status, promotion_queued_at, tier | posted_to_discord, settlement_* |
| `poster` | posted_to_discord, discord_message_id, meta | settlement_*, selection, line |
| `settler` | settlement_status, settlement_result, settled_at | posted_to_discord, selection |
| `operator_override` | ALL (emergency use only) | N/A |

### By Field (Immutability)

| Field | Immutable After Set | Allowed Writers |
|-------|---------------------|-----------------|
| `id` | YES | submitter |
| `bet_slip_id` | YES | submitter |
| `selection` | YES | submitter |
| `posted_to_discord` | YES (once true) | poster |
| `discord_message_id` | YES | poster |
| `settlement_result` | YES | settler, operator_override |
| `settlement_hash` | YES | settler |

---

## VI. VERIFICATION CHECKLIST

### Before Claiming Completion

- [ ] All tests pass (`npm run test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lifecycle gate passes (`npm run lifecycle:single-writer -- --strict`)
- [ ] No direct unified_picks writes introduced
- [ ] Proof artifacts generated in `out/sprints/...`
- [ ] Closeout report written

### Before Merging

- [ ] Branch is up to date with target
- [ ] All CI checks pass
- [ ] Code review approved (if required)
- [ ] No TODO comments for critical items
- [ ] Documentation updated (if needed)

---

## VII. EMERGENCY PROCEDURES

### Single-Writer Violation in Production

1. **STOP** all related deployments
2. **AUDIT** recent changes to unified_picks
3. **REVERT** if duplicate data detected
4. **FIX** using lifecycle adapters
5. **VERIFY** via lifecycle gate

### Data Integrity Issue

1. **STOP** writes to affected table
2. **SNAPSHOT** current state
3. **ANALYZE** scope of issue
4. **ESCALATE** to human
5. **DO NOT** attempt automated fix

---

## VIII. CONTRACT VERSIONING

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-18 | Initial contract |

---

**This contract is binding for all Claude operations in this repository.**
**Violations must be reported and corrected before proceeding.**

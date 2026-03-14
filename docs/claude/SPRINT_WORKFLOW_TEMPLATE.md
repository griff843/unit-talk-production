# Sprint Workflow Template

> Use this template for all sprints in the Unit Talk repo.

---

## Quick Start

```bash
# 1. Create sprint directory
SPRINT="<CATEGORY>-<DESCRIPTION>-<NNN>"
DATE=$(date +%Y-%m-%d)
mkdir -p out/sprints/$SPRINT/$DATE/{proofs,diffs,notes}

# 2. Follow the phases below
```

---

## Phase 1: Plan

### 1.1 Parse Request

- What is the objective?
- What are the success criteria?
- What is out of scope?

### 1.2 Context Gathering

```bash
# Check current state
git status

# Find affected files
rg "<pattern>" apps/api/src --type ts -l
```

### 1.3 Implications Check

| Question               | Answer | Action                   |
| ---------------------- | ------ | ------------------------ |
| Touches unified_picks? | Y/N    | Use lifecycle adapters   |
| Needs migration?       | Y/N    | Create migration file    |
| Affects agents?        | Y/N    | Check agent health after |
| Changes API?           | Y/N    | E2E test coverage        |

### 1.4 Create Plan

Write to `out/sprints/$SPRINT/$DATE/notes/plan.md`:

```markdown
# Sprint Plan: <SPRINT-NAME>

## Objective

<one line>

## Tasks

1. [ ] Task 1
2. [ ] Task 2

## Files to Modify

- path/to/file.ts

## Verification

- [ ] Type check
- [ ] Tests
- [ ] Build
- [ ] Gate (if applicable)
```

---

## Phase 2: Implement

### 2.1 Rules

- Read files before editing
- Use lifecycle adapters for unified_picks
- Add sprint reference comments
- Test frequently

### 2.2 Sprint Reference Format

```typescript
// <SPRINT-NAME>: <brief description>
```

### 2.3 Progress Tracking

After each task:

1. Mark complete in plan
2. Run quick verification
3. Note any issues

---

## Phase 3: Verify

### 3.1 Verification Sequence

```bash
# 1. Type check (required)
npm run type-check

# 2. Tests (required)
npm run test

# 3. Lifecycle gate (if applicable)
cd apps/api && npm run lifecycle:single-writer -- --strict

# 4. Build (required)
npm run build

# 5. E2E (if user-facing changes)
npm run test:e2e
```

### 3.2 All Must Pass

- DO NOT proceed if any check fails
- Fix issues before continuing
- Re-run failed checks after fix

---

## Phase 4: Proof Bundle

### 4.1 Capture Commands

```bash
SPRINT="<SPRINT-NAME>"
DATE=$(date +%Y-%m-%d)
PROOF_DIR="out/sprints/$SPRINT/$DATE/proofs"

# Git status
git status > $PROOF_DIR/proof_git_status.txt 2>&1

# Type check
npm run type-check 2>&1 | tee $PROOF_DIR/proof_typecheck.txt

# Tests
npm run test 2>&1 | tee $PROOF_DIR/proof_tests.txt

# Build
npm run build 2>&1 | tee $PROOF_DIR/proof_build.txt

# Gate (if applicable)
cd apps/api && npm run lifecycle:single-writer -- --strict 2>&1 | tee ../../$PROOF_DIR/proof_gate.txt
```

### 4.2 Required Files

- [ ] proof_git_status.txt
- [ ] proof_typecheck.txt
- [ ] proof_tests.txt
- [ ] proof_build.txt
- [ ] proof_gate.txt (if lifecycle-related)

### 4.3 Phase Advancement Proof (if claiming phase complete)

If this sprint claims a phase complete, generate and fill in the proof:

```bash
# Generate skeleton (pre-populated with phase criteria)
npm run phase:proof -- --sprint <SPRINT-ID> --phase <N>

# Edit the generated file:
# out/sprints/<SPRINT-ID>/<DATE>/proofs/proof_phase_advancement_<N>.txt
# → Fill in every [FILL IN: ...] field with actual evidence
# → Replace [REPLACE THIS LINE] with completed sign-off statement

# Then close with --phase flag (validates content + presence):
npm run sprint:close -- <SPRINT-ID> --phase <N>
```

Reference: `docs/claude/PHASE_ADVANCEMENT_PROOF_TEMPLATE.md`

---

## Phase 5: Commit + Tag + Merge (MANDATORY)

> ⚠️ **HARD RULE**: A sprint is NOT complete until this phase is done. Skip this
> phase = Sprint incomplete = Must be done before next sprint.

### 5.1 Commit the Sprint

```bash
# Stage all sprint changes
git add -A

# Commit with sprint reference
git commit -m "$(cat <<'EOF'
SPRINT-<NAME>-<NNN>: <brief description>

<detailed summary of changes>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### 5.2 Tag the Sprint

```bash
git tag SPRINT-<NAME>-<NNN>-COMPLETE
```

### 5.3 Merge to Main

```bash
git checkout main
git pull
git merge --ff-only sprint/<branch-name>
# If ff fails, rebase first: git rebase main sprint/<branch-name>
```

### 5.4 Verify Clean State

```bash
# Must return empty
git status

# Main must have sprint commit
git log --oneline -5

# Tag must exist
git tag -l "SPRINT-*" | tail -5
```

---

## Phase 6: Closeout

### 6.1 Generate Report

Create `out/sprints/$SPRINT/$DATE/SPRINT_CLOSEOUT_REPORT.md`:

```markdown
# SPRINT CLOSEOUT REPORT

**Sprint**: <SPRINT-NAME> **Objective**: <One line description> **Date**:
<YYYY-MM-DD> **Status**: ✅ COMPLETE | ⚠️ PARTIAL | ❌ BLOCKED

---

## Executive Summary

<2-3 sentences describing what was accomplished>

---

## Deliverables

### Phase 1: <Name> ✅

- Deliverable 1
- Deliverable 2

---

## Verification Results

### Tests
```

<test summary or reference to proof file>
```

### Gate Status

```
<gate summary or reference to proof file>
```

---

## Changes Summary

| File              | Change      |
| ----------------- | ----------- |
| `path/to/file.ts` | Description |

---

## Sign-off

- [x] All tests passing
- [x] Gate passing
- [x] Proofs generated
- [ ] Documentation updated (if needed)

**Sprint Status**: ✅ COMPLETE

```

---

## Sprint Naming Convention

```

<CATEGORY>-<DESCRIPTION>-<NNN>

```

### Categories

| Category | Use For |
|----------|---------|
| LIFECYCLE | Lifecycle module changes |
| SMART-FORM | Smart Form changes |
| EMBED | Embed/Discord changes |
| GRADING | GradingAgent changes |
| SETTLEMENT | Settlement changes |
| INFRA | Infrastructure changes |
| SCHEMA | Database schema changes |
| FEATURE | New features |
| FIX | Bug fixes |
| REFACTOR | Refactoring |

### Examples

- `LIFECYCLE-WRITE-SURFACE-MIGRATION-038`
- `SMART-FORM-VALIDATION-039`
- `EMBED-TRUTH-FIX-040`

---

## First-Try Protocol

Minimize back-and-forth by:

1. **Gather context first** - Read before asking
2. **Make decisions** - Use judgment for non-critical choices
3. **Document assumptions** - Note in plan
4. **Verify before claiming done** - Run ALL checks
5. **Ask only critical questions** - Would change approach

---

## Directory Structure

```

out/sprints/<SPRINT>/<DATE>/ ├── proofs/ │ ├── proof_git_status.txt │ ├──
proof_typecheck.txt │ ├── proof_tests.txt │ ├── proof_build.txt │ └──
proof_gate.txt ├── diffs/ │ └── changes.diff ├── notes/ │ ├── plan.md │ └──
decisions.md └── SPRINT_CLOSEOUT_REPORT.md

```

```

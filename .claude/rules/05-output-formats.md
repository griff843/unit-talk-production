# Rule 05: Output Formats

> Reference: `CLAUDE_EXECUTION_CONTRACT.md` Section IV

## Sprint Closeout Report Format

```markdown
# SPRINT CLOSEOUT REPORT

**Sprint**: <SPRINT-NAME>
**Objective**: <One line description>
**Date**: <YYYY-MM-DD>
**Status**: ✅ COMPLETE | ⚠️ PARTIAL | ❌ BLOCKED

---

## Executive Summary

<2-3 sentences describing what was accomplished>

---

## Deliverables

### Phase X: <Name> ✅|⚠️|❌
- <Deliverable 1>
- <Deliverable 2>

---

## Verification Results

### Tests
```
<Test output summary or reference to proof file>
```

### Gate Status
```
<Gate output summary or reference to proof file>
```

---

## Changes Summary

| File | Change |
|------|--------|
| `path/to/file.ts` | Description |

---

## Sign-off

- [ ] All tests passing
- [ ] Gate passing
- [ ] Proofs generated
- [ ] Documentation updated

**Sprint Status**: ✅ COMPLETE
```

## Proof File Format

### proof_git_status.txt

```
On branch <branch>
Changes to be committed:
  <file list>

Changes not staged:
  <file list>

Untracked files:
  <file list>
```

### proof_tests.txt

```
<Full test runner output>

Test Files  X passed (X)
Tests       Y passed (Y)
```

### proof_gate.txt

```
🔍 SINGLE-WRITER GATE
   Scanning: <path>
   Mode: STRICT

📊 Results:
   Files scanned: XXX
   Violations found: 0
   Allowlisted files: 0

✅ GATE PASSED
```

## Code Comment Format

### Sprint Reference

```typescript
// SPRINT-<NAME>-###: <Brief description>
```

### Lifecycle Adapter Usage

```typescript
// LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle adapter for insert
const result = await lifecycleInsert(supabase, pick, {
  writerRole: 'submitter',
  traceId: `smartform-${pickId}`,
});
```

### Migration Comments

```sql
-- Migration: <description>
-- Sprint: <SPRINT-NAME>
-- Rollback: <rollback instruction>

<SQL here>
```

## Directory Structure

### Sprint Output

```
out/sprints/<SPRINT>/<DATE>/
├── proofs/
│   ├── proof_git_status.txt
│   ├── proof_tests.txt
│   ├── proof_typecheck.txt
│   ├── proof_build.txt
│   └── proof_gate.txt
├── diffs/
│   └── *.diff
├── notes/
│   └── *.md
└── SPRINT_CLOSEOUT_REPORT.md
```

### Creating Structure

```bash
# Create sprint directory
SPRINT="SPRINT-NAME-###"
DATE=$(date +%Y-%m-%d)
mkdir -p out/sprints/$SPRINT/$DATE/{proofs,diffs,notes}
```

## Status Indicators

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete/Pass |
| ⚠️ | Partial/Warning |
| ❌ | Failed/Blocked |
| 🔍 | In Progress |
| 📊 | Results/Data |

## File Naming

### Proof Files

```
proof_<what>.txt
proof_git_status.txt
proof_tests.txt
proof_gate.txt
```

### Diff Files

```
<component>_changes.diff
lifecycle_module_changes.diff
migration_changes.diff
```

### Note Files

```
<topic>.md
plan.md
investigation.md
decisions.md
```

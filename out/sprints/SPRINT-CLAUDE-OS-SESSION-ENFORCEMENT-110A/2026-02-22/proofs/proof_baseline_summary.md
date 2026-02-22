# Session Baseline Report

**Generated**: 2026-02-22T09:29:46.318Z
**Status**: fail

---

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Git | ⚠️ Dirty | sprint/claude-os-session-enforcement-110a |
| TypeScript | ✅ Pass | 0 unique codes |
| ESLint | ❌ 7893 errors | 14910 warnings |
| Supabase | ⚠️ Unknown | Hash: 1be168b211901ad2 |

---

## Git Status

- **Branch**: sprint/claude-os-session-enforcement-110a
- **Clean**: false
- **Changes**:
  - Staged: 2
  - Modified: 5
  - Untracked: 3

---

## TypeScript Diagnostics

- **Total Errors**: 0
- **Configs Checked**: 10


---

## ESLint Analysis

- **Total Errors**: 7893
- **Total Warnings**: 14910
- **Files with Issues**: 1304

### Top Rules

| Rule | Count | Severity |
|------|-------|----------|
| no-console | 11776 | warning |
| no-var | 2117 | error |
| security/detect-object-injection | 1990 | warning |
| @typescript-eslint/no-unused-vars | 953 | warning |
| import/order | 891 | error |
| no-unused-vars | 864 | error |
| complexity | 854 | error |
| max-lines-per-function | 815 | error |
| no-undef | 780 | error |
| max-lines | 262 | error |

---

## Workspace Analysis

- **Total Packages**: 11
- **Apps**: 

### Affected Packages

- @root

---

## Supabase Schema

- **Hash**: 1be168b211901ad2
- **Tables**: 32
- **Functions**: 47
- **Latest Migration**: 20260222041000_identity_status_schema.sql
- **Schema Drift**: Unknown


---

## Sprint Readiness

### Blockers

- ⚠️ Working tree is dirty. Commit or stash changes before sprint.
- ❌ 7893 ESLint errors should be reviewed.

**Status**: NOT READY - Address blockers before proceeding.

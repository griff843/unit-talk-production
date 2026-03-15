# Claude OS — Finding Backlog Automation

**Sprint**: SPRINT-CLAUDE-OS-FINDING-BACKLOG-AUTOMATION **Date**: 2026-03-14
**Status**: COMPLETE

---

## Purpose

Convert Claude OS finding outputs (failure classifications, drift signals,
verdict blockers, lifecycle gate failures) into structured, prioritized,
deduplicated backlog items and Linear issue drafts.

This closes the gap between "finding discovered during sprint execution" and
"work item tracked in the operator's queue."

---

## Problem Statement

Before this sprint, Claude OS had:

| Module                  | Output                            | What Happened to It        |
| ----------------------- | --------------------------------- | -------------------------- |
| `failure-classifier.ts` | `ClassifiedFailure`               | Printed to CLI, discarded  |
| `drift-sentinel.ts`     | `DriftSignal[]`                   | Printed to plan, discarded |
| `verdict-engine.ts`     | `BundleVerdict.recommendations[]` | Plain strings, discarded   |
| `lifecycle-checker.ts`  | `LifecycleDimension` failures     | Printed to CLI, discarded  |

No automated path existed from finding discovery to work item creation.

---

## Solution

### New Module: `tools/claude-os/src/finding-backlog.ts`

Implements the complete finding-to-backlog pipeline:

```
Finding Source          → Converter              → NormalizedFinding
─────────────────────────────────────────────────────────────────────
ClassifiedFailure       → convertFailureToFinding()
DriftSignal             → convertDriftSignalToFinding()
BundleVerdict (blocker) → convertVerdictToFindings()
LifecycleDimension      → convertLifecycleDimensionToFinding()
Manual/audit input      → NormalizedFinding directly

      ↓
deduplicateFindings()   → fingerprint-based dedup, higher severity wins

      ↓
assembleBacklogResult() → FindingBacklogResult with summary + routing

      ↓
generateFindingArtifacts() → 5 markdown artifact files
```

### New CLI Command: `findings`

```bash
npx tsx src/cli.ts findings --sprint <SPRINT-ID> [--out <dir>] [--json] [--date YYYY-MM-DD]
```

Loads sprint artifacts (`verdict.json`, `verification-evidence-index.json`),
converts all available findings, and writes artifact files.

---

## Severity Model

| Level | Meaning                                        | Threshold             |
| ----- | ---------------------------------------------- | --------------------- |
| P0    | Platform unusable — security breach, data loss | Always BACKLOG_CREATE |
| P1    | Major feature broken — revenue/workflow impact | Always BACKLOG_CREATE |
| P2    | Minor feature broken — workaround exists       | BACKLOG_CREATE        |
| P3    | Minor improvement — quality/performance        | LINEAR_DRAFT          |
| P4    | Cosmetic / polish                              | LOG_ONLY              |

---

## Triage Rules

```
failure_classifier.governance → P1 / BACKLOG_CREATE
failure_classifier.application → P2 / BACKLOG_CREATE
failure_classifier.infrastructure → P2 / BACKLOG_CREATE
failure_classifier.toolchain → P3 / LOG_ONLY
failure_classifier.environment → P3 / LOG_ONLY
failure_classifier.transient → P4 / LOG_ONLY

drift_sentinel.critical → P1 / BACKLOG_CREATE
drift_sentinel.high → P2 / BACKLOG_CREATE
drift_sentinel.medium → P3 / LINEAR_DRAFT
drift_sentinel.low → P4 / LOG_ONLY

verdict_engine.FAIL blocker → P1 / BACKLOG_CREATE
verdict_engine.BLOCKED blocker → P2 / BACKLOG_CREATE
verdict_engine.recommendation/limitation → P3 / LINEAR_DRAFT

lifecycle_checker.FAIL → P1 / BACKLOG_CREATE
lifecycle_checker.PENDING → P3 / LINEAR_DRAFT
lifecycle_checker.UNKNOWN → P3 / LOG_ONLY
```

---

## Deduplication

Fingerprint: `normalize(subsystem) + ":" + normalize(title)`

- When two findings share a fingerprint, higher severity wins
- Duplicate gets `recommendedAction = 'DUPLICATE_SUPPRESS'` and
  `duplicateOf = <canonical_id>`
- Deterministic ID: `sha1(source:subsystem:fingerprint).slice(0, 12)` — same
  finding across multiple sprints gets the same stable ID

---

## Artifact Files

Each `findings` run writes 5 files to the output directory:

| File                                 | Contents                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| `VERIFICATION_FINDINGS.md`           | Findings from failure_classifier, verdict_engine, lifecycle_checker |
| `RECOMMENDED_REMEDIATION_SPRINTS.md` | Sprint recommendations for P0–P2                                    |
| `LINEAR_ISSUE_DRAFTS.md`             | Ready-to-paste Linear issue text for P3                             |
| `FINDING_DECISION_LOG.md`            | Full table of all findings with routing decisions                   |
| `HANDOFF_SUMMARY.md`                 | Operator-facing summary with next-step checklist                    |

---

## Integration Points

The module is purely additive — it does not modify existing modules. Callers opt
in:

```typescript
// After running supervised-run (gets verdict + failure classifications):
import {
  analyzeSprintFindings,
  generateFindingArtifacts,
} from './finding-backlog.js';

const result = analyzeSprintFindings(sprintId);
generateFindingArtifacts(result, artifactOutputDir);

// From drift signals (available during sprint planning):
import {
  convertDriftSignalToFinding,
  assembleBacklogResult,
} from './finding-backlog.js';

const driftFindings = plan.driftSignals.map(s =>
  convertDriftSignalToFinding(sprintId, s)
);
const backlog = assembleBacklogResult(sprintId, driftFindings);
```

---

## Automation Boundary

| Operation                                    | Safe to Automate | Requires Human |
| -------------------------------------------- | ---------------- | -------------- |
| Loading verdict.json / evidence index        | ✅               |                |
| Converting findings to NormalizedFinding     | ✅               |                |
| Fingerprint dedup + triage                   | ✅               |                |
| Writing markdown artifact files              | ✅               |                |
| Creating governance/claude-os/issues/\*.json |                  | ✅             |
| Creating Linear issues                       |                  | ✅             |
| Starting a remediation sprint                |                  | ✅             |

---

## Files Changed

| File                                                           | Change                                           |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `tools/claude-os/src/finding-backlog.ts`                       | NEW — complete finding backlog automation module |
| `tools/claude-os/src/cli.ts`                                   | Modified — added `findings` CLI command          |
| `docs/02_architecture/claude_os_finding_backlog_automation.md` | NEW — this document                              |

---

## Related Documents

- `docs/02_architecture/claude_os_lifecycle_automation.md` — lifecycle-checker
  (previous sprint)
- `tools/claude-os/src/failure-classifier.ts` — classification source
- `tools/claude-os/src/drift-sentinel.ts` — drift signal source
- `tools/claude-os/src/verdict-engine.ts` — verdict source
- `tools/claude-os/src/lifecycle-checker.ts` — lifecycle source

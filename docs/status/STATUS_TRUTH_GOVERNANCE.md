# Status Truth Governance

**Date**: 2026-03-11 **Scope**: `docs/status/**`, ignore rules, and status
workflow helpers

---

## Observed Repo Truth

The following files exist under `docs/status/` and are currently used by
workflow docs as the repo-truth status layer:

- `docs/status/CANONICAL_DOC_SET.md`
- `docs/status/CURRENT_SYSTEM_STATUS.md`
- `docs/status/DRIFT_REPORT.md`
- `docs/status/NEXT_5_SPRINTS.md`
- `docs/status/PHASE_STATUS.md`

Observed references:

- `docs/ops/STATUS_SYNC_WORKFLOW.md` treats `docs/status/` as "Repo truth"
- `docs/ops/SYSTEM_STATUS_WORKFLOW.md` treats these files as the read layer for
  `/system-status`
- `docs/ops/LINEAR_SYNC_WORKFLOW.md` states Linear mirrors, but does not define,
  system truth
- `docs/audits/PLATFORM_TRUTH_AUDIT.md` names the `docs/status/` files as audit
  outputs / truth references

---

## Classification

### Canonical Committed Truth

These files should be committed and reviewed as repository truth docs:

- `docs/status/CANONICAL_DOC_SET.md`
- `docs/status/CURRENT_SYSTEM_STATUS.md`
- `docs/status/DRIFT_REPORT.md`
- `docs/status/NEXT_5_SPRINTS.md`
- `docs/status/PHASE_STATUS.md`
- `docs/status/STATUS_TRUTH_GOVERNANCE.md`

### Generated / Local Artifacts

These are evidence or generated outputs, not canonical status truth:

- `out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md`
- `out/sprints/<SPRINT>/<DATE>/proofs/**`
- `out/session-baseline/<timestamp>/baseline.json`
- `out/session-baseline/<timestamp>/baseline-summary.md`

Observed behavior:

- `.gitignore` ignores `out/`, so generated evidence remains local unless
  force-added intentionally
- no repository script in `scripts/` or `tools/` was found writing directly to
  `docs/status/`; workflow docs describe manual or skill-driven updates instead

---

## Ignore / Script Findings

### Ignore Rules Affecting Status Docs

Observed broad ignore rules in `.gitignore`:

- `PHASE*.md`
- `*_REPORT*.md`

These patterns are broad enough to match canonical repo-truth docs such as:

- `docs/status/PHASE_STATUS.md`
- `docs/status/DRIFT_REPORT.md`

### Change Made

Updated `.gitignore` so the whole committed `docs/status/**` tree is unignored,
not just a hand-maintained list of known files. This keeps canonical repo truth
visible even when filenames match broad artifact patterns.

Exact rules before:

```gitignore
PHASE*.md
*_REPORT*.md
!docs/status/
!docs/status/CANONICAL_DOC_SET.md
!docs/status/CURRENT_SYSTEM_STATUS.md
!docs/status/DRIFT_REPORT.md
!docs/status/NEXT_5_SPRINTS.md
!docs/status/PHASE_STATUS.md
!docs/status/STATUS_TRUTH_GOVERNANCE.md
```

Exact rules after:

```gitignore
PHASE*.md
*_REPORT*.md
!docs/status/
!docs/status/**
```

No script changes were required because no writer script was found to be routing
canonical status docs into ignored/generated directories.

---

## Follow-Up Requiring Governed Review

- Review whether any future generated status output is ever proposed under
  `docs/status/`; if so, that would need governed review because this fix treats
  the full directory as committed repo truth
- Review stale links that still point at `docs/system/CURRENT_SYSTEM_STATUS.md`
  instead of `docs/status/CURRENT_SYSTEM_STATUS.md`
- If a dedicated `/status-sync` implementation is added later, it should keep
  writing canonical truth to `docs/status/` and generated evidence to `out/`

---

## Decision

`docs/status/` is the committed repository truth layer.

`out/` remains the generated/local evidence layer.

# Sprint Plan — Prompt Templates

Standard templates for generating the ready-to-paste sprint implementation
prompt. Select the correct template by sprint type, then fill in the variable
blocks.

---

## Template: Implementation Sprint (Fix / Migration / Activation)

Use for: SPRINT-TEST-INFRA-RECOVERY, SPRINT-SINGLE-WRITER-COMPLETION,
SPRINT-PROMOTION-ACTIVATION, and similar implementation-heavy sprints.

```
SPRINT — <SPRINT-NAME-NNN>

Model: <Sonnet | Opus>

Context:
<2–4 sentences of current system state relevant to this sprint.
Pull from CURRENT_SYSTEM_STATUS.md and DRIFT_REPORT.md.
Include the specific drift items this sprint resolves.>

Example:
Unit Talk test suite is 89% broken (DRIFT-C1). 119 of 133 test files fail to
load due to module resolution errors. TypeScript compilation fails on 58 errors
in productionDashboard.ts (DRIFT-C2). Both issues block governance gates for all
future sprints.

Mission:
<One sentence: what this sprint accomplishes>

Example:
Restore the test suite to a functional state and clear all TypeScript compilation
errors so governance verification gates pass cleanly.

Requirements:

<Numbered task list from NEXT_5_SPRINTS.md, verbatim or lightly adapted.>

1. <Task 1>
2. <Task 2>
3. <Task 3>
...

Success Criteria:
- <Criterion 1 — must be verifiable by a command>
- <Criterion 2>
- All governance gates green (type-check, tests, lifecycle gate, build)

Governance:
- Run `pnpm session:baseline` before any code changes
- Sprint branch: `sprint/<sprint-name-lowercase>`
- Proof bundle required: `out/sprints/<SPRINT>/<DATE>/`
- Run `/status-sync <SPRINT-NAME>` after merge
- Linear: <UNI-N> → In Progress when starting, Done when merged

North star:
<One sentence on the platform-level impact — what does completing this unlock?>
```

---

## Template: Architecture / Feature Sprint

Use for: SPRINT-MULTI-BOOK-CONSENSUS, Phase 3+ sprints, any sprint requiring new
contract or cross-service design.

```
SPRINT — <SPRINT-NAME-NNN>

Model: Opus

Context:
<3–5 sentences of current state + the architectural gap this sprint fills.
Include relevant phase status, which services are involved, and any prior
work this sprint builds on.>

Example:
Unit Talk is Phase 2 (Intelligence Superiority) at 70%. SGO and OddsAPI feed
provider_offers on the V3 path, but Optimal API still routes to legacy raw_props
(DRIFT-M3). Multi-book consensus scoring (UNI-11) is the highest-value intelligence
gap: without consensus devigging across 3+ providers, edge calculations are based
on single-book prices. Linear issues UNI-11 and UNI-13 define this work.

Mission:
<One sentence>

Architecture Constraints:
- All provider data MUST write to `provider_offers` (canonical V3 table)
- Scoring MUST use `lifecycleInsert()` with `promoter` writerRole
- Shadow mode required: V3 alongside legacy until canary validation passes
- Single-writer gate must remain passing (0 violations)

Requirements:

<Task list from NEXT_5_SPRINTS.md>

1. <Task 1>
...

Design Decisions Required:
- <Decision 1 — e.g., "consensus devig algorithm: Pinnacle-weighted or equal-weight?">
- <Decision 2>

Success Criteria:
- <Verifiable criterion 1>
- Shadow mode comparison with legacy showing consistent or improved scoring
- All governance gates green

Governance:
- Run `pnpm session:baseline` before any code changes
- Sprint branch: `sprint/<sprint-name-lowercase>`
- Proof bundle required: `out/sprints/<SPRINT>/<DATE>/`
- Run `/status-sync <SPRINT-NAME>` after merge
- Linear: <UNI-N> → In Progress when starting, Done when merged

North star:
<Impact sentence>
```

---

## Template: Audit / Truth Sprint

Use for: SPRINT-SYSTEM-TRUTH-AUDIT, any sprint whose output is docs not code.

```
SPRINT — <SPRINT-NAME-NNN>

Model: Opus

Context:
<Status of the canonical docs layer and why a re-audit is needed.
Reference how long since the last audit and what has changed.>

Mission:
Re-verify all docs/status/ documents against current codebase implementation and
produce a corrected truth layer with evidence artifacts.

Scope:
- docs/status/CURRENT_SYSTEM_STATUS.md — verify all subsystem rows
- docs/status/PHASE_STATUS.md — verify phase percentages
- docs/status/NEXT_5_SPRINTS.md — verify queue against roadmap
- docs/status/DRIFT_REPORT.md — identify resolved and new drift items

Audit Method:
For each subsystem in CURRENT_SYSTEM_STATUS.md:
1. Read the relevant source code
2. Check CI gate outputs from the most recent sprint proofs
3. Determine actual status (VERIFIED / PARTIAL / BROKEN / UNVERIFIED)
4. Update the row only if status changed
5. Record evidence source in the Evidence column

No guessing. All status claims trace to a proof artifact or code read.

Deliverables:
- Updated docs/status/ files with fresh Last Updated timestamps
- DRIFT_REPORT.md with resolved items removed and new items added
- A brief audit summary in out/sprints/<SPRINT>/<DATE>/notes/audit_summary.md

Success Criteria:
- All docs/status/ files have today's date in Last Updated
- Every VERIFIED claim has an evidence source
- Drift item count is accurate (no phantom resolved, no missing new items)
- No CRITICAL drift items unaddressed

Governance:
- Run `pnpm session:baseline` before starting
- Run `/status-sync <SPRINT-NAME>` is implicit (this sprint IS the sync)
- No code changes — docs only
- Linear: <UNI-N or "no issue">

North star:
Restore single-source-of-truth so the next sprint starts from accurate context
instead of accumulated assumption.
```

---

## Template: Blocked Sprint Recommendation

Use when Sprint 1 cannot proceed due to an incomplete dependency.

```
⚠️ SPRINT BLOCKED — <SPRINT-NAME> cannot start

Reason: <DEPENDENCY-SPRINT> is not yet complete (tag not found on remote).

Recommended Next Sprint: <DEPENDENCY-SPRINT-NNN>

<Use the appropriate template above for the dependency sprint>

Dependency Chain:
<Sprint blocked> → requires → <dependency> → requires → <earlier dependency or "none">

Once <DEPENDENCY-SPRINT> is merged and tagged, re-run /sprint-plan to confirm
<blocked sprint> is unblocked.
```

---

## Variable Reference

| Variable            | Source                                              |
| ------------------- | --------------------------------------------------- |
| `<SPRINT-NAME-NNN>` | NEXT_5_SPRINTS.md sprint name + next git tag number |
| `<Sonnet \| Opus>`  | MODEL_SELECTION.md                                  |
| Context block       | CURRENT_SYSTEM_STATUS.md + DRIFT_REPORT.md          |
| Task list           | NEXT_5_SPRINTS.md Tasks section                     |
| Success criteria    | NEXT_5_SPRINTS.md Success Criteria section          |
| `<UNI-N>`           | Linear issue lookup via mcp**linear**list_issues    |
| Sprint branch       | lowercase sprint name with hyphens                  |

# UTRP-R7 — Program Closeout

> **Workstream**: R7 **Status**: IN-FLIGHT **Dependencies**: R0–R6 ALL
> COMPLETE + 48-hour observation gate
>
> **Observation Gate**: Opens 2026-03-19 18:43 EDT | Closes 2026-03-21 18:43 EDT
> All completable criteria satisfied. Gate confirmation pending.

---

## Objective

Formally close the Unit Talk Reconstruction Program. Confirm that every
acceptance criterion across R0–R6 is satisfied, the 48-hour stability gate has
passed, the ledger is fully reconciled, and the platform is certified for
resumption of normal development.

---

## The 48-Hour Observation Gate

Before R7 can be declared, the system must operate in production/staging for 48
hours without any of the following:

| Watch Condition                                                            | Threshold                          |
| -------------------------------------------------------------------------- | ---------------------------------- |
| SLO 1 (lifecycle completion): `attainment = 0` with `total > 0`            | Triggers REM-008 investigation     |
| SLO 2 (settlement accuracy): `settled = 0` with `total > 0` after 24h      | Triggers settlement pipeline audit |
| Worker heartbeat: any worker silent > 2x normal interval                   | Triggers health check              |
| Settlement 401: any ops endpoint returning 401 from CC                     | Auth regression — R3 revisit       |
| Recap empty: `getDailyRecapData()` returns null with settled picks present | Recap regression — R5 revisit      |

If any watch condition triggers during the 48-hour window, the observation gate
resets and the condition is triaged before re-opening the gate.

---

## Scope

### 1. Full acceptance criteria audit

For each workstream R0–R6, confirm every AC is satisfied by reviewing the
corresponding proof artifact. Each AC must have:

- [ ] Proof artifact file exists at the documented path
- [ ] Proof artifact content confirms the criterion is met
- [ ] No kill condition was triggered without documented resolution

### 2. Ledger reconciliation

Update `UTRP_LEDGER.md`:

- All OPEN defects must be either RESOLVED or DEFERRED with rationale
- DEFERRED defects must have a follow-up sprint or tracking item named
- The program state summary table must show all workstreams as COMPLETE

### 3. Test floor confirmation

Confirm that the total test count at R7 is ≥ the R0 baseline, and that no test
was removed or suppressed to achieve passing status.

```bash
# Final test count
cd apps/api && npm run test:vitest
cd apps/command-center && npx vitest run
cd apps/api && npm run test
```

### 4. Gate confirmation

All CI gates must pass on the final program state:

```bash
cd apps/api && npm run type-check
cd apps/command-center && npm run type-check
cd apps/api && npm run lifecycle:single-writer -- --strict
```

### 5. Closeout document

Write the UTRP Final Closeout Report:

- Executive summary of what was reconstructed
- Per-workstream verdict (COMPLETE / PARTIAL / DEFERRED)
- Net defect count: opened vs resolved
- Test count delta: R0 baseline vs R7 final
- Observation gate result
- Declaration: platform is certified for resumption of normal development

### 6. Post-UTRP queue

Update `docs/status/NEXT_5_SPRINTS.md` with the next sprint queue — this is the
first sprint work that can happen after UTRP closes. Candidates:

- Layer 4 Intelligence Pipeline (if all R0–R6 criteria met)
- Canonical V3 `tickets` migration (deferred during UTRP)
- SGO participant sync improvements (deferred during UTRP)
- Any DEFERRED defects from the ledger that are now prioritized

---

## Acceptance Criteria

| #       | Criterion                                                                | Proof Artifact                  |
| ------- | ------------------------------------------------------------------------ | ------------------------------- |
| AC-R7-1 | All R0–R6 AC proof artifacts exist and are confirmed                     | `proof_ac_audit.md`             |
| AC-R7-2 | 48-hour observation gate passed — no watch conditions triggered          | `proof_observation_gate.md`     |
| AC-R7-3 | `UTRP_LEDGER.md` shows all workstreams COMPLETE, all P0 defects RESOLVED | Updated `UTRP_LEDGER.md`        |
| AC-R7-4 | Final test count ≥ R0 baseline                                           | `proof_final_test_count.txt`    |
| AC-R7-5 | All CI gates pass                                                        | `proof_gates.txt`               |
| AC-R7-6 | UTRP Final Closeout Report written and signed                            | `UTRP_FINAL_CLOSEOUT_REPORT.md` |
| AC-R7-7 | `docs/status/NEXT_5_SPRINTS.md` updated with post-UTRP queue             | Updated `NEXT_5_SPRINTS.md`     |

---

## Kill Conditions

| Condition                                                         | Action                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| An R0–R6 workstream has unmet acceptance criteria                 | R7 cannot be declared. Return to the failing workstream and resolve.                                             |
| 48-hour observation gate triggers a watch condition               | Reset gate. Triage condition. Assign to appropriate workstream for resolution. Restart 48-hour window after fix. |
| Post-UTRP queue includes work that should have been in UTRP scope | Update NEXT_5_SPRINTS.md but do not re-open UTRP. UTRP is closed once R7 criteria are met.                       |

---

## Proof Artifacts

```
out/sprints/UTRP-R7-CLOSEOUT/<DATE>/
├── proofs/
│   ├── proof_ac_audit.md               # Per-workstream AC confirmation checklist
│   ├── proof_observation_gate.md       # 48h window: watch conditions, results
│   ├── proof_final_test_count.txt      # Final vitest + Jest counts
│   └── proof_gates.txt                 # Type-check + single-writer output
├── UTRP_FINAL_CLOSEOUT_REPORT.md       # Signed program closeout
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## Declaration Template

```
UTRP Final Declaration
Date: <YYYY-MM-DD>
Program: Unit Talk Reconstruction Program

All workstreams R0–R6: COMPLETE
Observation gate (48h): PASSED
Open P0 defects: 0
Test count: <N> (baseline was <M>)
Gates: type-check ✅ | single-writer ✅ | vitest ✅

The platform is certified for resumption of normal development.
Layer 4 / Intelligence Pipeline advancement is now authorized.

Signed: Engineering Team
```

---

## Dependency Order

```
R7 depends on: R0–R6 ALL COMPLETE + 48-hour observation gate
R7 is the terminal workstream. Nothing depends on R7.
```

---

**Workstream Owner**: Engineering Team

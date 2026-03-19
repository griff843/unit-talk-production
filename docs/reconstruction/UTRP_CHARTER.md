# UTRP — Unit Talk Reconstruction Program Charter

> **Authority**: This document supersedes all ad hoc sprint planning for the
> platform until UTRP-R7-CLOSEOUT is signed. No roadmap/layer advancement, no
> feature work, and no speculative improvements are permitted outside the bounds
> of this program.
>
> **Version**: 1.0 | **Issued**: 2026-03-19 | **Status**: ACTIVE

---

## 1. Why This Program Exists

The platform has accumulated compounding structural debt through seven runtime
remediation sprints (REM-001 through REM-007). While each REM sprint was locally
correct, the cumulative effect is a system that:

- Passes test suites but has unverified production paths
- Has confirmed P0 defects (DEFECT-9) still open
- Has settlement, recap, and Discord pipelines that are blocked at auth, data,
  or configuration layers
- Has an operator surface that recently required emergency fixes to display
  truthful data
- Has no verified end-to-end proof that a pick can traverse submit → grade →
  post → settle → recap in the current production configuration

The Reconstruction Program does not exist because the platform is broken. It
exists because "locally correct" is insufficient — the program requires
**systemic, proven correctness** across the full data lifecycle.

---

## 2. Program Objective

Restore full, verified correctness to every critical path in the platform:

> **A pick submitted via Smart Form must be able to reach a settled, graded,
> posted, recapped state — with every field truthfully represented to the
> operator — with proof artifacts at each transition.**

Reconstruction is complete when every workstream has passed its acceptance
criteria and the 48-hour observation gate (R7) confirms no regression.

---

## 3. Program Scope

The UTRP covers:

| Domain              | Scope                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| Schema              | All constraint, column, and default fixes in `unified_picks` and `prop_settlements` |
| Submission          | Smart Form → `atomic_submit_ticket` RPC field completeness                          |
| Auth                | CC→API settlement auth, `operatorAuth` internal bypass                              |
| Operator Surface    | Command Center Picks HQ, recap surface, git identity                                |
| Settlement Pipeline | End-to-end: submit → settle → audit log                                             |
| Recap Pipeline      | RecapService correctness, capper attribution, service role access                   |
| Discord Pipeline    | Promotion → posting unblock                                                         |
| Verification        | R2 replay harness expansion, E2E smoke coverage                                     |

---

## 4. Program Exclusions

The following are explicitly OUT OF SCOPE for UTRP:

- Layer 4 advancement (Intelligence Pipeline)
- New agent development
- New Discord features or commands
- Dashboard (analytics frontend) changes
- SGO participant sync improvements
- Performance optimization beyond what is required by an acceptance criterion
- Database schema redesign (only targeted constraint and column fixes)
- Canonical V3 `tickets` migration (deferred until after UTRP)

---

## 5. Hard Rules During Reconstruction

**RULE-1 — No feature work.** A change is permitted only if it is required by an
active workstream's scope. If it is not in the scope table of a workstream
document, it does not happen.

**RULE-2 — No claims without proof.** Every acceptance criterion requires a
named proof artifact file in `out/sprints/<SPRINT>/<DATE>/proofs/`. A criterion
without a proof file is not met.

**RULE-3 — Downstream stability required.** A sprint is not complete when local
changes pass gates. It is complete when the gates of all downstream workstreams
it unblocks have been verified (or re-verified) as still passing.

**RULE-4 — Workstream order is enforced.** No workstream may begin until all
workstreams it depends on have reached COMPLETE status. The dependency order in
each workstream document is binding.

**RULE-5 — Kill conditions are mandatory stops.** If a kill condition is
triggered, work stops immediately. A new plan is written and the program charter
is updated before resuming. Kill conditions exist because some fixes require
different approaches than initially designed.

**RULE-6 — Ledger is updated at every transition.** The UTRP_LEDGER.md file must
be updated when any defect moves from OPEN to IN-FLIGHT or RESOLVED. The ledger
is the source of truth for program state, not memory.

---

## 6. Workstream Order

```
R0: TRUTH-RESET                     ← No dependencies. Runs first.
    │
    ├── R1: CANONICAL-DATA           ← Depends on R0
    │       │
    │       ├── R2: SUBMISSION       ← Depends on R1
    │       │       │
    │       │       └── R3: AUTH     ← Depends on R1 (parallel-eligible with R2)
    │       │               │
    │       │               ├── R4: OPERATOR-SURFACE    ← Depends on R1, R2, R3
    │       │               │
    │       │               └── R5: DOWNSTREAM-OUTCOMES ← Depends on R3, R4
    │       │                               │
    │       └───────────────────────────────┤
    │                                       │
    └── R6: VERIFICATION-CONTROL-PLANE ─────┘  ← Depends on R1–R5
                    │
                    └── R7: CLOSEOUT ← Depends on R0–R6 complete + 48h gate
```

---

## 7. Definition of Done — Program Level

The UTRP is complete when:

1. R0 through R6 all have status COMPLETE in the ledger
2. R7 closeout document is signed
3. The 48-hour observation gate has passed (SLO metrics stable, no regression)
4. All OPEN defects in the ledger are either RESOLVED or formally deferred with
   a documented rationale
5. The platform can demonstrate (via proof artifacts) an uninterrupted submit →
   grade → post → settle → recap chain for at least one real pick

---

## 8. Governance

| Role                   | Responsibility                                           |
| ---------------------- | -------------------------------------------------------- |
| Program Authority      | Engineering Team                                         |
| Ledger Owner           | Maintains UTRP_LEDGER.md at every state change           |
| Workstream Owner       | Owns each Rn document; declares COMPLETE                 |
| Kill Condition Arbiter | Engineering Team must review and approve before resuming |
| Observation Gate Owner | Must confirm 48h stability before R7 is signed           |

---

## 9. What "Reconstruction" Means

Reconstruction is not a rewrite. It is the act of establishing **verified,
proven correctness** for code and infrastructure that already largely exists.
The difference between the current state and the target state is:

| Current                                 | Target                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| Test suites pass in isolation           | Pipelines proven end-to-end with proof artifacts       |
| Schema has known constraint violations  | Schema matches the lifecycle engine's full state space |
| Auth blocks settlement from CC          | Auth scoped correctly: CC can call ops endpoints       |
| Recap is empty for unsettled picks      | Recap populates correctly after settlement             |
| Discord posting blocked by config       | Discord pipeline active with known AUTOPILOT_MODE      |
| Operator surface had synthetic defaults | Operator surface is sparse-faithful                    |

Reconstruction is complete when the gap between "current" and "target" is zero.

---

**Charter Owner**: Engineering Team **Next Review**: On R4 COMPLETE or any kill
condition trigger

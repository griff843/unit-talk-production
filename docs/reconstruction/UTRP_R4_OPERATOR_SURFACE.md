# UTRP-R4 — Operator Surface Reconstruction

> **Sprint**: UTRP-R4-OPERATOR-SURFACE-RECONSTRUCTION **Workstream**: R4
> **Status**: NOT STARTED **Dependencies**: R1 COMPLETE, R2 COMPLETE, R3
> COMPLETE

---

## Objective

The Command Center operator surface must render truthful, complete data for
every submitted pick — with no synthetic defaults, correct field coverage, and a
stable connection to the API.

> The operator makes decisions based on what they see. An inaccurate surface is
> as dangerous as no surface. R4 closes the gap between the data that exists and
> the data that is shown.

---

## Scope

### Already Resolved (Pre-UTRP)

The following were resolved in prior sprints and must be confirmed stable:

| Item                                                                                      | Sprint                                   |
| ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| Synthetic defaults removed (capper, tier, confidence, market_type)                        | SPRINT-POST-REM-OPERATOR-SURFACE-TRUST   |
| Git identity in containers → footer shows real branch/build                               | SPRINT-POST-REM-OPERATOR-SURFACE-TRUST   |
| `/api/picks` + `usePicks.ts`: bet_type, home_team, away_team, posted_to_discord, username | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK |

**R4 verifies these are still correct** after R1–R3 changes, and then resolves
the remaining open items.

### 1. DEFECT-22 — Disconnected state resiliency

The CC pipeline dashboard shows "Disconnected" when HTTP polling of
`/api/pipeline/health` fails or returns an error. Currently, a single failed
poll triggers the disconnected state immediately with no retry.

Required actions:

- Locate the `usePipelineDashboard` hook or equivalent polling logic
- Add a retry window: mark as Disconnected only after N consecutive failures
  (recommended: 3 failures, 15s apart = 45s before Disconnected)
- Add a last-known-good timestamp so the operator knows how stale the data is
- The connected state must reflect the actual API health, not an optimistic
  assumption

### 2. Verification: Picks HQ renders new fields correctly

After R1 (data model) and R2 (submission contract) are complete, submit 3 real
picks (player prop, game total, spread) and verify that Picks HQ displays:

| Field             | Player Prop | Game Total | Spread    |
| ----------------- | ----------- | ---------- | --------- |
| capper            | username    | username   | username  |
| sport             | NBA         | NBA        | NCAA      |
| bet_type          | player_prop | total      | spread    |
| stat_type         | points      | —          | —         |
| home_team         | —           | BOS        | Duke      |
| away_team         | —           | LAL        | UNC       |
| player_name       | Tatum       | —          | —         |
| line              | 28.5        | 215.5      | -4.5      |
| odds              | -110        | -110       | -110      |
| posted_to_discord | false       | false      | false     |
| workflow_stage    | submitted   | submitted  | submitted |

All NULL fields must render as "—" not as synthetic defaults.

### 3. Operator action verification (approve/reject reach API)

After R3 (auth), verify that clicking Approve and Reject in Picks HQ:

- Sends the request to `/api/ops/picks/:id/approve` with the internal token
- Receives 200
- Updates the local state correctly
- Does NOT leave the pick in a stale state if the API call fails

---

## Exclusions

- No new UI components or visual redesign
- No new filtering or sorting features
- No analytics or statistics additions
- No changes to the Dashboard (analytics frontend)
- No recap UI changes (those are in R5)

---

## Acceptance Criteria

| #        | Criterion                                                                                             | Proof Artifact                                        |
| -------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| AC-R4-1  | Pipeline dashboard marks Disconnected only after ≥ 3 consecutive poll failures — not on first failure | `proof_disconnect_retry.txt`                          |
| AC-R4-2  | Pipeline dashboard shows last-known-good timestamp when in Disconnected state                         | `proof_disconnect_timestamp.txt` (screenshot or test) |
| AC-R4-3  | Picks HQ renders `bet_type` correctly for all 3 bet types when data exists                            | `proof_picks_hq_render.md`                            |
| AC-R4-4  | Picks HQ renders `home_team`/`away_team` for game total and spread; renders "—" for player props      | `proof_picks_hq_render.md`                            |
| AC-R4-5  | Picks HQ renders `posted_to_discord` (false/true) not "—"                                             | `proof_picks_hq_render.md`                            |
| AC-R4-6  | Approve action succeeds (200) and updates pick state in UI                                            | `proof_approve_action.txt`                            |
| AC-R4-7  | Reject action succeeds (200) and updates pick state in UI                                             | `proof_reject_action.txt`                             |
| AC-R4-8  | Pre-UTRP resolved items (DEFECT-19, 20, 21) are still correct after R1–R3 changes                     | `proof_regression_check.txt`                          |
| AC-R4-9  | All existing CC tests pass — 167/167 or ≥ R0 baseline                                                 | `proof_tests.txt`                                     |
| AC-R4-10 | Type check passes                                                                                     | `proof_typecheck.txt`                                 |

---

## Kill Conditions

| Condition                                                                                         | Action                                                                                               |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Approve/Reject actions fail because the internal token is not available in the CC browser context | Stop. Implement the CC-side proxy (described in R3 kill conditions) before proceeding.               |
| Picks HQ still renders synthetic defaults after R2 completion                                     | Trace to specific file and field — do not declare R4 complete until all synthetic defaults are gone. |
| Disconnect resiliency change creates false positives (shows Connected when API is down)           | Revert. The current behavior (fast disconnect) is safer than false confidence.                       |

---

## Proof Artifacts

```
out/sprints/UTRP-R4-OPERATOR-SURFACE-RECONSTRUCTION/<DATE>/
├── proofs/
│   ├── proof_disconnect_retry.txt      # Code diff + test showing retry logic
│   ├── proof_disconnect_timestamp.txt  # Test or screenshot of timestamp display
│   ├── proof_picks_hq_render.md        # Table: field-by-field rendering for 3 bet types
│   ├── proof_approve_action.txt        # API response + UI state update
│   ├── proof_reject_action.txt         # API response + UI state update
│   ├── proof_regression_check.txt      # Confirm DEFECT-19/20/21 still resolved
│   ├── proof_tests.txt
│   └── proof_typecheck.txt
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## Dependency Order

```
R4 depends on: R1 COMPLETE, R2 COMPLETE, R3 COMPLETE
R4 must complete before: R5, R6
R4 has no parallel workstream
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 1 session
(disconnect resiliency + verification of R1–R3 surface impact)

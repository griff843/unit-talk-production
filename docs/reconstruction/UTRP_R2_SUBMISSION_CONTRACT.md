# UTRP-R2 — Submission Contract Reconstruction

> **Sprint**: UTRP-R2-SUBMISSION-CONTRACT-RECONSTRUCTION **Workstream**: R2
> **Status**: NOT STARTED **Dependencies**: R1 COMPLETE

---

## Objective

Every bet type (player prop, game total, spread) submitted via Smart Form must
produce a `unified_picks` row with all required fields populated correctly, with
null-safe semantics for optional fields.

> The submission contract is the entry point for all data. If fields are
> missing, wrong, or defaulted incorrectly here, every downstream pipeline
> (grading, settlement, recap, Discord) operates on corrupt input.

---

## Scope

### 1. DEFECT-10 — `confidence` NULL semantics (if not resolved in R1)

If the `atomic_submit_ticket` confidence default was not fixed in R1, it is
resolved here. This is listed in R1 as the canonical fix location; R2 verifies
it through the submission path.

### 2. DEFECT-11 — `provider`/sportsbook field

The Smart Form captures a sportsbook/provider selection but the
`atomic_submit_ticket` RPC has no `p_provider` parameter, so provider is never
written to `unified_picks`. Required actions:

- Add `p_provider TEXT DEFAULT NULL` parameter to `atomic_submit_ticket`
- Map `p_provider` to the `provider` column in the INSERT
- Update Smart Form submission payload to include provider when present
- Verify via replay that provider propagates correctly

### 3. DEFECT-12 — `matchup` field

For game total and spread bets, the matchup string (e.g., "Boston Celtics vs Los
Angeles Lakers") is never stored as a structured field. Required actions:

- Confirm `unified_picks` has a `matchup` column (add via migration if absent)
- Add `p_matchup TEXT DEFAULT NULL` to `atomic_submit_ticket`
- For player props: derive from `home_team` + `away_team` if both present
- For spreads/totals: write from explicit matchup or concatenate team names

### 4. DEFECT-17 — `home_team`/`away_team` unconditional mapping

The RPC currently maps team fields only when `source='manual'`. The correct
behavior is: map team fields whenever the caller provides them, regardless of
source. Required actions:

- Remove the `source='manual'` condition from team field mapping in the RPC
- Verify that NBA game total and NCAA spread picks populate `home_team` and
  `away_team` in the DB row

### 5. Submission contract verification via R2 replay

After all RPC fixes, run the R2 deterministic replay against a fixture that
includes all three bet types:

- **player_prop**: Tatum o28.5 Pts (existing)
- **total**: Celtics/Lakers o215.5 (new fixture)
- **spread**: Duke -4.5 vs UNC (new fixture)

All 7 gates must pass for all 3 pick types. The `lifecycle-trace.jsonl` in the
proof bundle must show all fields correctly populated in the IN-MEMORY store.

---

## Exclusions

- No changes to Smart Form UI layout or UX
- No changes to `bridge_outbox` schema
- No changes to how BridgeWorker processes outbox events
- No changes to grading logic
- Do not add new fields to `unified_picks` beyond `matchup` (if absent) and
  `provider`

---

## Acceptance Criteria

| #       | Criterion                                                                                                                     | Proof Artifact                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AC-R2-1 | `atomic_submit_ticket` RPC accepts `p_provider` parameter and writes it to `unified_picks.provider`                           | `proof_provider_rpc.sql`                           |
| AC-R2-2 | `atomic_submit_ticket` RPC accepts `p_matchup` parameter and writes it to `unified_picks.matchup` (or derives it when absent) | `proof_matchup_rpc.sql`                            |
| AC-R2-3 | `home_team`/`away_team` are written for spread/total picks regardless of `source` value                                       | `proof_team_fields.txt`                            |
| AC-R2-4 | Confidence submitted as NULL by form is stored as NULL (not `0`) in `unified_picks`                                           | `proof_confidence_null.txt`                        |
| AC-R2-5 | R2 replay runs against 3-bet-type fixture — all 7 gates pass, `lifecycle-trace.jsonl` shows correct fields for all pick types | `proof_r2_replay_3types.txt` + replay proof bundle |
| AC-R2-6 | All existing tests pass — vitest ≥ R0 baseline                                                                                | `proof_tests.txt`                                  |
| AC-R2-7 | Type check passes                                                                                                             | `proof_typecheck.txt`                              |
| AC-R2-8 | Single-writer gate passes                                                                                                     | `proof_gate.txt`                                   |

---

## Kill Conditions

| Condition                                                                                                            | Action                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Adding `p_provider` or `p_matchup` to `atomic_submit_ticket` breaks existing Smart Form submission integration tests | Pause. Investigate. The RPC change must be backward-compatible (DEFAULT NULL parameters are safe). |
| R2 replay gate fails for game total or spread fixture                                                                | Pause. Diagnose which gate fails and which field is missing. Fix before declaring R2 complete.     |
| `unified_picks` does not have a `matchup` column                                                                     | Create migration to add it before the RPC fix. Migration must be safe (nullable, no default).      |

---

## Proof Artifacts

```
out/sprints/UTRP-R2-SUBMISSION-CONTRACT-RECONSTRUCTION/<DATE>/
├── proofs/
│   ├── proof_provider_rpc.sql          # Migration adding p_provider to RPC
│   ├── proof_matchup_rpc.sql           # Migration adding p_matchup to RPC
│   ├── proof_team_fields.txt           # DB insert output showing home_team/away_team
│   ├── proof_confidence_null.txt       # RPC output showing NULL confidence stored
│   ├── proof_r2_replay_3types.txt      # Replay CLI output: 7/7 gates for 3 bet types
│   ├── proof_tests.txt
│   ├── proof_typecheck.txt
│   └── proof_gate.txt
├── replay-bundle/                      # Proof bundle from R2 replay
│   ├── lifecycle-trace.jsonl
│   ├── determinism-hash.txt
│   └── proof-bundle-checksum.txt
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## New Fixture Required: `post-rem-events-3types.jsonl`

```jsonl
// Player prop (existing pattern)
{"eventId":"evt-3t-001","eventType":"PICK_SUBMITTED","pickId":"pick-3t-prop",...}

// Game total (new)
{"eventId":"evt-3t-004","eventType":"PICK_SUBMITTED","pickId":"pick-3t-total",
  "payload":{"pick":{
    "id":"pick-3t-total","bet_slip_id":"slip-3t-002",
    "sport":"NBA","bet_type":"total","direction":"over","line":215.5,
    "home_team":"BOS","away_team":"LAL","selection":"Celtics/Lakers o215.5",
    "odds":-110,"matchup":"Celtics vs Lakers"
  }}}

// Spread (new)
{"eventId":"evt-3t-007","eventType":"PICK_SUBMITTED","pickId":"pick-3t-spread",
  "payload":{"pick":{
    "id":"pick-3t-spread","bet_slip_id":"slip-3t-003",
    "sport":"NCAA","bet_type":"spread","direction":"home","line":-4.5,
    "home_team":"Duke","away_team":"UNC","selection":"Duke -4.5",
    "odds":-110,"matchup":"Duke vs UNC"
  }}}
```

---

## Dependency Order

```
R2 depends on: R1 COMPLETE
R2 must complete before: R4
R2 is parallel-eligible with: R3 (no file overlap)
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 1–2 sessions (RPC
migrations + replay fixture + verification)

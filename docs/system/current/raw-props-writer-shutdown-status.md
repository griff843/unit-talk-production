# raw_props Writer Shutdown Status

> Updated: 2026-03-08 | Sprint: SPRINT-044Q (previously 044P, 044O)

---

## Per-Writer Shutdown Status

| #     | Writer                        | Status      | Sprint | Notes                                                                |
| ----- | ----------------------------- | ----------- | ------ | -------------------------------------------------------------------- |
| C1    | `compatUpdatePropResult()`    | **REMOVED** | 044O   | espnGradingService.ts deleted — zero production callers              |
| B1    | `compatUpdateGradingResult()` | **DELETED** | 044Q   | Dead code removed — storeGradingResult() raw_props branch deleted    |
| B2    | `compatMarkPromoted()`        | **DELETED** | 044Q   | Dead code removed — promoteToUnifiedPicks() raw_props branch deleted |
| A1-A4 | `compatInsertRawProp()`       | **DELETED** | 044Q   | Orphaned writes removed — no production reader consumed rows         |

---

## Compatibility Module Status

`apps/api/src/compatibility/rawPropsWriter.ts` — **DELETED** (044Q)

The entire compatibility directory has been removed. Zero production code writes
to `raw_props`.

---

## Reversibility Impact (Post-044Q)

**Before 044Q:** `GRADING_DATA_SOURCE=raw_props` env override restored full
legacy behavior — no code changes needed.

**After 044Q:** Env override alone is insufficient. The raw_props branches in
`storeGradingResult()` and `promoteToUnifiedPicks()` have been deleted. Full
reversal requires a code revert via `git revert`.

The `fetchPendingProps()` raw_props branch still exists (reads raw_props) but
would fail downstream since `storeGradingResult()` and `promoteToUnifiedPicks()`
no longer have raw_props paths.

---

## Source of Truth

- Shutdown manifest:
  `out/sprints/SPRINT-044O/2026-03-08/writer_shutdown_manifest.md`
- Wrapper removal proof:
  `out/sprints/SPRINT-044Q/2026-03-08/proofs/proof_wrapper_removal.txt`
- Compatibility shutdown report:
  `out/sprints/SPRINT-044Q/2026-03-08/compatibility_shutdown_report.md`

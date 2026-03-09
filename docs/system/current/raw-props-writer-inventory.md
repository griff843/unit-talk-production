# raw_props Writer Inventory — Running Tracker

> Updated: 2026-03-08 | Sprint: SPRINT-044Q (previously 044P, 044O, 044N)

---

## Production Writers

**Zero** production call sites remain. All compatibility wrappers deleted in
SPRINT-044Q. The `apps/api/src/compatibility/rawPropsWriter.ts` module has been
deleted.

### Removal History

| Wrapper Function              | Removed In  | Reason                                                                       |
| ----------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `compatUpdatePropResult()`    | SPRINT-044O | Dead code — espnGradingService.ts had zero production callers                |
| `compatUpdateGradingResult()` | SPRINT-044Q | Dead code after 044P flip — storeGradingResult() raw_props branch removed    |
| `compatMarkPromoted()`        | SPRINT-044Q | Dead code after 044P flip — promoteToUnifiedPicks() raw_props branch removed |
| `compatInsertRawProp()`       | SPRINT-044Q | Orphaned write — no production reader consumed rows after 044P flip          |

---

## Non-Production Writers (22 — documented, not wrapped)

| Category               | Count | Files                                         | Dies With  |
| ---------------------- | ----- | --------------------------------------------- | ---------- |
| Dev/Test Runners       | 7     | runner/_.ts, test-_.ts                        | Table drop |
| Test Scripts           | 5     | scripts/test-_.ts, analysis/_.ts              | Table drop |
| Analysis/Proof Scripts | 3     | scripts/analysis/_.ts, e2e-sgo-lifecycle/_.ts | Table drop |
| Smart Form Utilities   | 5     | apps/smart-form/fix-\*.js                     | Table drop |
| Test Suites            | 3     | tests/\*_/_.test.ts                           | Table drop |
| SQL Archival Scripts   | 5     | scripts/\*.sql                                | Table drop |

---

## Shutdown Sequence

```
DONE:  Delete espnGradingService.ts + compatUpdatePropResult() (044O — dead code)
DONE:  Flip GRADING_DATA_SOURCE default → provider_offers (044P)
DONE:  Delete B1/B2 dead wrapper calls + raw_props branches (044Q)
DONE:  Remove A1-A4 compatInsertRawProp orphaned writes (044Q)
DONE:  Delete compatibility/rawPropsWriter.ts + empty directory (044Q)

NEXT:  Redirect dedup queries (dedupePublicProps raw_props read)
THEN:  Settlement offer_id linkage
LAST:  Drop raw_props table
       → Non-production writers die naturally
```

---

## Source of Truth

- Full writer manifest: `out/sprints/SPRINT-044N/2026-03-08/writer_inventory.md`
- Shutdown manifest:
  `out/sprints/SPRINT-044O/2026-03-08/writer_shutdown_manifest.md`
- Wrapper removal proof:
  `out/sprints/SPRINT-044Q/2026-03-08/proofs/proof_wrapper_removal.txt`

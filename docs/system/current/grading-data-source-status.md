# GRADING_DATA_SOURCE Status

> Updated: 2026-03-08 | Sprint: SPRINT-044Q (previously 044P)

---

## Current Default: `provider_offers`

As of SPRINT-044P, `GRADING_DATA_SOURCE` defaults to `provider_offers`. The
GradingAgent reads from `provider_offers WHERE graded_at IS NULL` for both entry
points:

- **`process()`** — BaseAgent polling loop via `fetchPendingProviderOffers()`
- **`gradeNewProps()`** — Temporal workflow via `gradingAndScoringWorkflow()`

---

## Configuration

| Variable              | Default           | Fallback                                                   |
| --------------------- | ----------------- | ---------------------------------------------------------- |
| `GRADING_DATA_SOURCE` | `provider_offers` | `raw_props` (legacy, **partial only** — see Reversibility) |

---

## Data Flow (Default Path)

```
provider_offers (graded_at IS NULL)
  → fetchPendingProviderOffers() / gradeNewProps()
  → convertProviderOfferToFeatureSet()
  → gradeProp() (in-memory scoring)
  → storeGradingResult() → UPDATE provider_offers SET graded_at = NOW()
  → promoteFromProviderOffer() → lifecycleInsert(unified_picks)
```

**Tables read:** `provider_offers`, `participants`, `canonical_events`,
`markets` **Tables written:** `provider_offers` (graded_at), `unified_picks`
(via lifecycle) **Grading marker:** `provider_offers.graded_at` **Index:**
`idx_provider_offers_ungraded` (partial, graded_at IS NULL)

---

## Compatibility Wrapper Status (Post-044Q)

| Wrapper                       | Status      | Sprint |
| ----------------------------- | ----------- | ------ |
| `compatUpdateGradingResult()` | **DELETED** | 044Q   |
| `compatMarkPromoted()`        | **DELETED** | 044Q   |
| `compatInsertRawProp()`       | **DELETED** | 044Q   |

The entire `apps/api/src/compatibility/rawPropsWriter.ts` module has been
deleted.

---

## Reversibility (Post-044Q)

**Before 044Q:** `GRADING_DATA_SOURCE=raw_props` env override restored full
legacy behavior with no code changes needed.

**After 044Q:** The raw_props branches in `storeGradingResult()` and
`promoteToUnifiedPicks()` have been removed. Setting
`GRADING_DATA_SOURCE=raw_props` will only affect `fetchPendingProps()` (which
still has a raw_props branch) and `gradeNewProps()` (which still has a raw_props
branch). However, downstream storage and promotion will fail because those
methods no longer have raw_props paths.

**Full reversal requires:** `git revert` of SPRINT-044Q commit.

---

## History

| Sprint | Change                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| 044D   | Implemented dual-path with GRADING_DATA_SOURCE env var (default: raw_props)                                          |
| 044I   | Implemented promoteFromProviderOffer() with canonical JOINs                                                          |
| 044N   | Isolated all raw_props writers behind compatibility wrappers                                                         |
| 044O   | Removed dead ESPN writer; annotated remaining wrappers                                                               |
| 044P   | Flipped default to provider_offers; added gradeNewProps() routing                                                    |
| 044Q   | Deleted all compatibility wrappers; removed raw_props branches from storeGradingResult() and promoteToUnifiedPicks() |

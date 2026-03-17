# EMBED CONTRACT AUDIT

**Sprint**: SPRINT-063-LIFECYCLE-TRUTH-RESTORATION **Date**: 2026-03-16
**Verdict**: 5 defects identified — all caused by fallback logic and incomplete
normalization

---

## Defect Summary

| #   | Defect                      | Severity | File                             | Lines     |
| --- | --------------------------- | -------- | -------------------------------- | --------- |
| 1   | `build:unknown` leakage     | MEDIUM   | `apps/api/src/lib/buildInfo.ts`  | 38-43, 83 |
| 2   | `env:development` leakage   | MEDIUM   | `apps/api/src/lib/buildInfo.ts`  | 72        |
| 3   | Inconsistent capper display | LOW      | `DiscordPromotionAgent/index.ts` | 349-451   |
| 4   | Inconsistent headshots      | LOW      | `pickPresentationBuilder.ts`     | 487-538   |
| 5   | Raw enum leakage            | MEDIUM   | `pickPresentationBuilder.ts`     | 546-581   |

---

## Defect 1: `build:unknown` in Discord Footer

**Root cause**: `getGitCommitShort()` returns `'unknown'` when `git rev-parse`
fails (CI containers, Docker builds without `.git`).

```typescript
// apps/api/src/lib/buildInfo.ts:38-43
function getGitCommitShort(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GIT_COMMIT_SHORT || 'unknown'; // ← fallback
  }
}
```

This flows into `formatEmbedFooter()` (line 83-90):

```
build:unknown | env:development | Not Financial Advice
```

**Validation exists but doesn't block**: `validateBuildProvenance()` checks for
`'unknown'` in production but only logs an error — does not prevent posting.

**Fix**: Inject `GIT_COMMIT_SHORT` at Docker build time via `--build-arg` or
fail-closed if not set in production.

---

## Defect 2: `env:development` in Discord Footer

**Root cause**: `NODE_ENV` defaults to `'development'` when not explicitly set.

```typescript
// apps/api/src/lib/buildInfo.ts:72
environment: process.env.NODE_ENV || 'development',
```

**Fix**: Require `NODE_ENV` to be explicitly set in production deployments. Add
boot-time validation.

---

## Defect 3: Inconsistent Capper Visibility

**Root cause**: Three parallel embed builders with different capper logic.

| Builder                      | Capper Logic                         | File:Lines       |
| ---------------------------- | ------------------------------------ | ---------------- |
| `buildEmbedFromPresentation` | Hides if capper_name === 'Unit Talk' | index.ts:349-391 |
| `buildParlayEmbed`           | Always shows capper field            | index.ts:292-342 |
| `buildEliteEmbed`            | Always shows capper field            | index.ts:398-451 |

**Effect**: Same capper's picks sometimes show "Capper: John", other times the
field is absent, depending on which builder was selected. Selection depends on
whether `buildPickPresentation()` succeeds or fails.

**Fix**: Unify capper visibility logic across all three builders. Decide one
rule: always show, always hide "Unit Talk", or use a configurable flag.

---

## Defect 4: Inconsistent Headshot Enrichment

**Root cause**: Headshot lookup requires `player_name` AND either `player_id` or
a matching DB record. Failures are silent.

```typescript
// apps/api/src/services/pickPresentationBuilder.ts:487-538
async function getThumbnailUrl(pick: UnifiedPickRow): Promise<string> {
  const isPlayerProp = !!pick.player_name;
  if (isPlayerProp) {
    // Try player_id headshot → DB name lookup → team logo → league logo
  } else {
    // team logo → league logo
  }
}
```

**When headshots DON'T appear**:

- `player_name` is NULL → skip to team logo
- `player_name` has typo → DB lookup fails silently → team logo
- No `player_id` AND no DB match → team logo

**When headshots DO appear**:

- `player_id` populated AND valid
- `player_name` exactly matches DB `players.full_name`

**Fix**: Log headshot lookup failures with metric counters. Consider fuzzy
matching for player names.

---

## Defect 5: Raw Enum Leakage (e.g., THREE_POINTERS)

**Root cause**: `normalizeStatType()` has ~20 mappings but falls back to
`.toUpperCase()` for unmapped values.

```typescript
// apps/api/src/services/pickPresentationBuilder.ts:546-581
const STAT_TYPE_DISPLAY_MAP: Record<string, string> = {
  pts: 'PTS',
  points: 'PTS',
  ast: 'AST',
  assists: 'AST',
  reb: 'REB',
  rebounds: 'REB',
  three_pointers_made: '3PM',
  threes: '3PM',
  // ... ~20 total mappings
};

function normalizeStatType(statType: string | undefined | null): string {
  if (!statType) return '';
  const lower = statType.toLowerCase().trim();
  return STAT_TYPE_DISPLAY_MAP[lower] || statType.toUpperCase(); // ← fallback
}
```

**Where it leaks**:

- Player prop titles (`buildPickTitle()` line 786-794): "LeBron Over 27.5
  THREE_POINTERS"
- Market label field (`getMarketLabel()` line 744-762): raw enum visible

**Examples of unmapped values**:

- `THREE_POINTERS` (from legacy feeds)
- `PLAYER_REBOUNDS` (from Optimal API format)
- `OVER_UNDERS` (from some feed providers)

**Fix**: Expand STAT_TYPE_DISPLAY_MAP to cover all known feed provider formats.
Add a catch-all formatter that converts SNAKE_CASE to Title Case as a better
fallback than raw `.toUpperCase()`.

---

## Lane-Specific vs Universal

**All 5 defects are UNIVERSAL** — they affect all lanes equally. None are
lane-specific behavior. The defects arise from:

1. Fallback defaults (build:unknown, env:development)
2. Incomplete normalization (stat type map)
3. Parallel code paths (3 embed builders)
4. Silent failures (headshot lookup)

---

## Embed Field Source Map

| Field      | Source                        | Can Be Wrong?     |
| ---------- | ----------------------------- | ----------------- |
| Title      | pick data + normalizeStatType | YES (enum leak)   |
| Tier badge | pick.tier                     | NO (if scored)    |
| Confidence | score / 100                   | Depends on score  |
| EV         | edgeScore or score.ev         | Depends on score  |
| Line       | pick.line                     | NO                |
| Capper     | pick.capper_name or meta      | YES (visibility)  |
| Thumbnail  | getThumbnailUrl()             | YES (silent fail) |
| Footer     | formatEmbedFooter()           | YES (build/env)   |
| Timestamp  | ISO timestamp                 | NO                |

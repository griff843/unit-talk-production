# Smart Form Minimum Required Fields

**Generated**: 2026-01-21 **Authority**: SYSTEM_CONTRACT.md **Source Files**:

- `apps/smart-form/app/api/submit-ticket/route.ts` (lines 65-89, 387-430,
  558-579)
- `supabase/migrations/20260121_pr10_add_form_source_column.sql`

---

## Overview

This document defines the **minimum required fields** for a valid Smart Form UI
submission. These requirements are enforced at three levels:

1. **Client-side validation** (UI form schema)
2. **Server-side validation** (API route)
3. **Database enforcement** (CHECK constraint)

---

## Required Fields

### 1. Capper Selection

| Field       | Location      | Type   | Evidence                                                            |
| ----------- | ------------- | ------ | ------------------------------------------------------------------- |
| `capper`    | Request body  | string | `route.ts:67` - `z.string().min(1, 'Capper selection is required')` |
| `capper_id` | Alternative   | UUID   | `route.ts:68` - `z.string().uuid().optional()`                      |
| `user_id`   | unified_picks | UUID   | Resolved from capper name via users table                           |

**Validation**: At least one of `capper` or `capper_id` must be provided. Server
resolves to `user_id`.

### 2. Units (Stake)

| Field         | Location      | Type   | Evidence                                                 |
| ------------- | ------------- | ------ | -------------------------------------------------------- |
| `unit_size`   | Request body  | number | `route.ts:74` - `z.number().min(0.5).max(10).optional()` |
| `total_units` | Request body  | number | `route.ts:75` - `z.number().min(0.5).max(10).optional()` |
| `stake`       | unified_picks | number | Written from `unit_size ?? total_units`                  |

**Validation (GAP-003 Fix)**: Server-side validation at `route.ts:395-397`
requires explicit units:

```typescript
if (unit_size === undefined && providedTotalUnits === undefined) {
  smartFormRequiredFieldErrors.push(
    'units (unit_size or total_units) is required'
  );
}
```

### 3. Sport

| Field   | Location      | Type   | Evidence                                   |
| ------- | ------------- | ------ | ------------------------------------------ |
| `sport` | Request body  | enum   | `route.ts:69` - `z.enum(SUPPORTED_SPORTS)` |
| `sport` | unified_picks | string | Direct mapping                             |

**Supported Sports** (`route.ts:16`):

- NFL, NBA, MLB, NHL, NCAAF, WNBA, NCAAB, UFC/MMA, Boxing, Soccer, Tennis, Golf,
  NASCAR, F1

### 4. Ticket Type

| Field         | Location     | Type | Evidence                                                                |
| ------------- | ------------ | ---- | ----------------------------------------------------------------------- |
| `ticket_type` | Request body | enum | `route.ts:70` - `z.enum(['single', 'parlay', 'round_robin', 'teaser'])` |

### 5. Selections (at least one)

| Field             | Location     | Type  | Evidence                          |
| ----------------- | ------------ | ----- | --------------------------------- |
| `selections`      | Request body | array | `route.ts:82` - API format array  |
| `game_selections` | Request body | array | `route.ts:81` - Smart Form format |
| `legs`            | Request body | array | `route.ts:80` - Parlay leg format |

**Validation (GAP-003 Fix)**: Server-side validation at `route.ts:404-408`:

```typescript
const selectionsSourceCheck = apiSelections || game_selections || legs || [];
if (selectionsSourceCheck.length === 0) {
  smartFormRequiredFieldErrors.push('at least one selection is required');
}
```

### 6. Trace ID (Generated)

| Field      | Location              | Type | Evidence                                     |
| ---------- | --------------------- | ---- | -------------------------------------------- |
| `trace_id` | Generated             | UUID | `route.ts:324` - `const traceId = uuidv4();` |
| `trace_id` | unified_picks         | UUID | Written from generated value                 |
| `trace_id` | pick_publish.metadata | UUID | Propagated for E2E observability             |
| `trace_id` | Response              | UUID | Returned to client                           |

### 7. Form Source (Marker)

| Field         | Location      | Type   | Evidence                                     |
| ------------- | ------------- | ------ | -------------------------------------------- |
| `form_source` | unified_picks | string | `route.ts:572` - `form_source: 'smart_form'` |

**Purpose**: Distinguishes Smart Form UI submissions from API or test script
injections.

---

## Database Fields Written (unified_picks)

From `route.ts:558-579`:

```typescript
{
  bet_slip_id: betSlipId,           // UUID - generated
  user_id: capper_id,               // UUID - from capper resolution
  sport,                            // string - from request
  stat_type: statType,              // string - from selection
  line: line,                       // number - from selection
  odds: odds,                       // number - from selection
  selection: selectionValue,        // string - from selection
  confidence: confidenceValue,      // number - from request/selection
  team_id: selection.team_id,       // UUID | null
  player_id: selection.player_id,   // UUID | null
  source: selection.source || 'api',// string
  is_live: boolean,                 // boolean
  form_source: 'smart_form',        // string - MARKER
  stake: total_units,               // number - UNITS
  workflow_stage: 'pending_review', // string
  status: 'pending',                // string
  trace_id: traceId,                // UUID - for E2E tracking
}
```

---

## pick_publish Record Created

From `route.ts:609-636`:

```typescript
{
  pick_id: pick.id,                 // FK to unified_picks.id
  tenant_id: insertedTicket.id,     // Reference
  channel: 'CANARY',                // Channel identifier
  status: 'pending',                // Outbox status
  discord_channel_id: CANARY_CHANNEL_ID, // Target Discord channel
  attempts: 0,
  max_attempts: 3,
  dedupe_key: `smart_form_${pick.id}_${Date.now()}`,
  metadata: {
    trace_id: traceId,              // E2E correlation
    correlation_id: traceId,        // Alias
    form_source: 'smart_form',      // Marker
    bet_slip_id,
    capper_id,
    capper_name,
    sport,
    ticket_type,
    selection,
    line,
    odds,
    stat_type,
    total_units,
    confidence,
    is_live,
  },
}
```

---

## Database CHECK Constraint

From `supabase/migrations/20260121_pr10_add_form_source_column.sql`:

```sql
ALTER TABLE unified_picks
ADD CONSTRAINT chk_smart_form_required_fields CHECK (
  form_source IS DISTINCT FROM 'smart_form' OR (
    stake IS NOT NULL AND
    user_id IS NOT NULL AND
    selection IS NOT NULL AND
    sport IS NOT NULL AND
    trace_id IS NOT NULL
  )
);
```

**Effect**: Any row with `form_source='smart_form'` MUST have:

- `stake` (units)
- `user_id` (capper)
- `selection`
- `sport`
- `trace_id`

---

## E2E Proof Requirements

For a Smart Form E2E gate to PASS, the following must be verified:

### Request Validation

1. POST to `/api/submit-ticket` includes:
   - `capper` or `capper_id` (non-empty)
   - `unit_size` or `total_units` (>= 0.5)
   - `sport` (valid enum)
   - `ticket_type` (valid enum)
   - `selections`, `game_selections`, or `legs` (at least one)

### Response Validation

1. HTTP 201 response
2. Response includes `trace_id`

### Database Validation

1. `unified_picks` row exists with:
   - `form_source = 'smart_form'`
   - `stake IS NOT NULL`
   - `user_id IS NOT NULL`
   - `selection IS NOT NULL`
   - `sport IS NOT NULL`
   - `trace_id` matches response

2. `pick_publish` row exists with:
   - `pick_id` references unified_picks.id
   - `status = 'pending'` initially
   - `discord_channel_id = '1296531122234327100'` (CANARY)
   - `metadata.trace_id` matches

### Discord Validation

1. pick_publish transitions: `pending → processing → sent`
2. `external_message_id` is populated
3. Discord message exists at:
   `https://discord.com/channels/1284478946171293736/1296531122234327100/{external_message_id}`

---

## Anti-Cheat Requirements

**INVALID submissions (test script injection)**:

- `meta.test = true` present
- `form_source != 'smart_form'`
- Missing required fields (stake, user_id, selection, sport, trace_id)
- No HAR evidence of POST request
- No Playwright UI interaction evidence

**VALID submissions (Smart Form UI)**:

- Playwright screenshots showing form steps
- HAR capture showing POST to `/api/submit-ticket`
- Response with `trace_id`
- Database rows with all required fields
- `form_source = 'smart_form'`
- Discord message in CANARY channel

---

_Document generated by Release Integrity Engineer_ _Source:
apps/smart-form/app/api/submit-ticket/route.ts_

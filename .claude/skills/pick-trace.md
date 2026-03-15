# Skill: Pick Trace

## Purpose

Trace a single pick through its full lifecycle: current stage, all lifecycle
fields, and settlement records. Answers "why hasn't this pick been
posted/settled yet?" without needing direct database access.

## When to Use

- A specific pick UUID is suspected stuck or incorrectly staged
- Discord pick is not appearing for a known bet_slip_id
- Settlement result disputes — verify what was recorded
- Debugging BLOCKED or FAILED picks to read the reason
- Verifying a pick's lifecycle after manual operator intervention

## Invocation

```
/pick-trace <pick-uuid>
```

Requires one argument: the pick UUID (from `unified_picks.id`).

If you only have a `bet_slip_id`, run `query_picks` first to resolve the UUID:

```
Tool: query_picks
Input: { "status": "<any>", "limit": 10 }
```

Then filter the result by `bet_slip_id` to get the `id`.

## Procedure

### Step 1: Full Pick Detail

Call `get_pick` (unit-talk-state):

```
Tool: get_pick
Input: { "id": "<pick-uuid>" }
```

Returns `null` if the pick does not exist. Check `id` validity if null.

Key fields:

| Field                 | Meaning                                            |
| --------------------- | -------------------------------------------------- |
| `derived_stage`       | Canonical computed stage (see stage table below)   |
| `status`              | Raw status column                                  |
| `promotion_status`    | `pending` \| `queued` \| `approved` \| `rejected`  |
| `promotion_band`      | `HARD` \| `STRONG` \| `MEDIUM` \| `LIGHT` \| null  |
| `posted_to_discord`   | Whether Discord post was confirmed                 |
| `discord_message_id`  | Discord message ID (null = not posted)             |
| `settlement_status`   | `pending` \| `settled` \| `void` \| `disputed`     |
| `settlement_result`   | `win` \| `loss` \| `push` \| null                  |
| `settlement_frozen`   | If true, settlement is locked                      |
| `blocked_reason`      | Non-null = pick is BLOCKED; contains reason string |
| `failed_reason`       | Non-null = pick is FAILED; contains reason string  |
| `created_at`          | Pick creation time                                 |
| `placed_at`           | When bet was placed                                |
| `promotion_queued_at` | When pick entered promotion queue                  |
| `promotion_posted_at` | When pick was promoted to final                    |
| `settled_at`          | When settlement was recorded                       |

**Canonical stage derivation** (matches `deriveLifecycleStage` exactly):

| `derived_stage` | Condition                                                       |
| --------------- | --------------------------------------------------------------- |
| `CANCELLED`     | `status === 'cancelled'`                                        |
| `VOID`          | `settlement_status === 'void'`                                  |
| `DISPUTED`      | `settlement_status === 'disputed'`                              |
| `SETTLED`       | `settlement_status === 'settled'`                               |
| `BLOCKED`       | `blocked_reason` is non-null                                    |
| `FAILED`        | `failed_reason` is non-null                                     |
| `POSTED`        | `posted_to_discord = true` AND `discord_message_id` is non-null |
| `QUEUED`        | `promotion_status === 'queued'`                                 |
| `SUBMITTED`     | Everything else (default)                                       |

### Step 2: Lifecycle Stage (lightweight confirm)

Call `get_lifecycle_stage` (unit-talk-state):

```
Tool: get_lifecycle_stage
Input: { "id": "<pick-uuid>" }
```

Use this to confirm `derived_stage` without the full pick payload. Cross-check:
if `get_pick.derived_stage` ≠ `get_lifecycle_stage.derived_stage`, report the
discrepancy (should never happen — same derivation logic).

Key extra fields vs `get_pick`:

- Both return `promotion_queued_at` and `promotion_posted_at`
- `get_lifecycle_stage` is lighter; useful if `get_pick` returns a large `meta`

### Step 3: Settlement Records

Call `get_settlement_records` (unit-talk-state):

```
Tool: get_settlement_records
Input: { "pick_id": "<pick-uuid>", "limit": 5 }
```

Returns all settlement attempts for this pick. Key fields per record:

| Field               | Meaning                                    |
| ------------------- | ------------------------------------------ |
| `settlement_result` | `win` \| `loss` \| `push` \| null          |
| `settlement_status` | `pending` \| `settled` \| ...              |
| `settled_at`        | Timestamp of settlement                    |
| `provider`          | Which provider settled this (e.g. `sgov3`) |
| `raw_result`        | Raw provider payload                       |

Multiple records = multiple settlement attempts. Most recent is authoritative.

### Step 4: Report

```markdown
## Pick Trace — <pick-uuid>

**Traced at**: <queried_at> **Stage**: <derived_stage> **Bet Slip**:
<bet_slip_id> | **Leg**: <leg_index>

### Lifecycle Fields

| Field              | Value   |
| ------------------ | ------- |
| status             | <value> |
| promotion_status   | <value> |
| promotion_band     | <value> |
| posted_to_discord  | <value> |
| discord_message_id | <value> |
| settlement_status  | <value> |
| settlement_result  | <value> |
| settlement_frozen  | <value> |

### Timeline

- created_at: <value>
- placed_at: <value>
- promotion_queued_at: <value>
- promotion_posted_at: <value>
- settled_at: <value>

### Block / Failure Reason

blocked_reason: <value or none> failed_reason: <value or none>

### Settlement Records (<total> records)

| #   | Result        | Status  | Provider | settled_at  |
| --- | ------------- | ------- | -------- | ----------- |
| 1   | win/loss/push | settled | sgov3    | <timestamp> |

### Diagnosis

<one-line diagnosis based on derived_stage and fields>
```

## Common Diagnoses

| `derived_stage` | Likely Cause                  | Next Step                                           |
| --------------- | ----------------------------- | --------------------------------------------------- |
| `SUBMITTED`     | Not yet graded                | Check GradingAgent health via `/pipeline-health`    |
| `QUEUED`        | Graded, waiting for promotion | Check DiscordPromotionAgent heartbeat               |
| `POSTED`        | Correctly posted              | No action — confirm discord_message_id is valid     |
| `BLOCKED`       | See `blocked_reason`          | Operator must review and unblock                    |
| `FAILED`        | See `failed_reason`           | Investigate failure; use operator_override to retry |
| `SETTLED`       | Settlement recorded           | Verify result matches expectations                  |
| `DISPUTED`      | Settlement conflict           | Escalate to manual review                           |
| `VOID`          | Pick voided                   | Expected — no further action                        |

## Relevant Repo Paths

| Path                                                 | Role                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `packages/mcp-state/src/tools/index.ts`              | `get_pick`, `get_lifecycle_stage`, `get_settlement_records` |
| `packages/mcp-state/src/adapters/index.ts`           | `deriveStage` — parity with canonical                       |
| `apps/api/src/lib/lifecycle/transition-validator.ts` | Canonical `deriveLifecycleStage`                            |
| `apps/api/src/agents/DiscordPromotionAgent/`         | Posting agent — source of BLOCKED/FAILED                    |
| `apps/api/src/agents/SettlementAgent/`               | Settlement source                                           |

## Expected Output

- Single pick lifecycle trace with all fields
- Settlement record history
- One-line diagnosis and recommended next action

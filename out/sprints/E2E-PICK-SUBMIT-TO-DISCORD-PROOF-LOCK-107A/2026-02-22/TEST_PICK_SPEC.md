# TEST PICK SPECIFICATION

**Sprint**: SPRINT-E2E-PICK-SUBMIT-TO-DISCORD-PROOF-LOCK-107A
**Date**: 2026-02-22
**Purpose**: Single-leg, deterministic pick for E2E proof

---

## Pick Details

| Field | Value |
|-------|-------|
| **Sport** | NBA |
| **Bet Type** | moneyline |
| **Selection** | Celtics ML |
| **Team** | Boston Celtics |
| **Line** | 0 (moneyline) |
| **Odds** | -150 (American) |
| **Units** | 1.0 |
| **Ticket Type** | single |

---

## Capper Assignment

| Field | Value |
|-------|-------|
| **Capper ID** | 00000000-0000-0000-0000-000000000001 |
| **Capper Name** | test_user_phase13 |
| **Tier** | vip |

---

## Why This Pick Was Chosen

1. **Single Leg**: Simplest path through the system, no parlay odds calculation
2. **NBA**: Common sport in the system, well-tested
3. **Moneyline**: No spread/line complexity, just win/lose
4. **Test User**: Using designated test capper to avoid affecting production data
5. **Standard Odds**: -150 is a realistic, common moneyline value
6. **1.0 Units**: Default stake, minimal complexity

---

## Expected Submission Payload

```json
{
  "capper_id": "00000000-0000-0000-0000-000000000001",
  "sport": "NBA",
  "ticket_type": "single",
  "total_units": 1.0,
  "selections": [
    {
      "sport": "NBA",
      "bet_type": "moneyline",
      "selection": "Celtics ML",
      "team": "Boston Celtics",
      "stat_type": "moneyline",
      "line": 0,
      "leg_odds": -150,
      "source": "api",
      "is_live": false,
      "confidence": 7
    }
  ],
  "notes": "E2E Test Pick - SPRINT-107A"
}
```

---

## Expected Lifecycle States

1. **Submitted** → Row in unified_picks, status: submitted
2. **Scored** → Edge Engine scores applied
3. **Promoted** → Grading threshold met, promoted_at set
4. **Posted** → Discord message sent, snowflake captured
5. **Settled** → Win/loss/push recorded (via settlement flow)

---

## Idempotency Key

Will be generated at submission time using UUID v4 format.
Format: `e2e-107a-{timestamp}`

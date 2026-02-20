# Smart Form Data Contract V2

> **Version**: 2.0.0 **Status**: DRAFT - Pending Canonical Schema Decision
> **Source**:
> `out/audits/CANONICAL_SCHEMA_DECISION/2026-02-20/CANONICAL_SCHEMA_AUDIT.md`

---

## 1. Overview

This contract defines the data interface between **Smart Form** (the ticket
submission UI) and the **canonical database schema V2**. It replaces the V1
contract based on `unified_picks` with a normalized model supporting any sport,
market, and segment.

### Scope

| Component           | Role                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| Smart Form          | UI for manual ticket submission                                                        |
| Canonical Schema V2 | Normalized tables: participants, events, event_segments, markets, tickets, ticket_legs |
| Contract Views      | Stable API layer isolating Smart Form from schema changes                              |

---

## 2. Contract Views (Read Surface)

Smart Form reads data ONLY through these views. Direct table access is
forbidden.

### 2.1 catalog_participants_v2

Replaces: `catalog_players_v1`, `catalog_teams_v1`

```sql
CREATE VIEW catalog_participants_v2 AS
SELECT
    p.id,
    p.participant_type,      -- 'player' | 'team' | 'fighter' | 'driver' | 'golfer'
    p.name,
    p.external_ids,          -- JSONB: {"sportradar": "...", "espn": "..."}
    p.sport_key,
    p.active,
    pm.team_id,              -- Current team (from participant_memberships)
    pm.jersey_number,
    pm.position
FROM participants p
LEFT JOIN participant_memberships pm
    ON pm.participant_id = p.id
    AND pm.active_to IS NULL;  -- Current membership only
```

**Usage in Smart Form:**

```typescript
const { data: players } = await supabase
  .from('catalog_participants_v2')
  .select('*')
  .eq('sport_key', 'NBA')
  .eq('participant_type', 'player')
  .eq('team_id', selectedTeamId);
```

### 2.2 catalog_events_v2

Replaces: Hardcoded game lookups

```sql
CREATE VIEW catalog_events_v2 AS
SELECT
    e.id,
    e.sport_key,
    e.event_type,            -- 'game' | 'match' | 'fight' | 'tournament' | 'race'
    e.home_participant_id,
    hp.name AS home_name,
    e.away_participant_id,
    ap.name AS away_name,
    e.scheduled_start,
    e.status,
    e.external_ids
FROM events e
LEFT JOIN participants hp ON hp.id = e.home_participant_id
LEFT JOIN participants ap ON ap.id = e.away_participant_id
WHERE e.status IN ('scheduled', 'in_progress');
```

### 2.3 catalog_segments_v2

New view for segment selection.

```sql
CREATE VIEW catalog_segments_v2 AS
SELECT
    es.id,
    es.event_id,
    es.segment_key,          -- 'full_game' | '1H' | '2H' | '1Q' | 'set_1' | etc.
    es.segment_number,
    es.display_name,
    es.status
FROM event_segments es
WHERE es.status IN ('scheduled', 'in_progress');
```

### 2.4 market_taxonomy_v2

Enhanced market definitions with segment constraints.

```sql
CREATE VIEW market_taxonomy_v2 AS
SELECT
    m.id,
    m.sport_key,
    m.market_key,
    m.display_name,
    m.category,
    m.bet_type,              -- 'player_prop' | 'game' | 'futures'
    m.requires_participant,
    m.requires_line,
    m.allowed_segments,      -- TEXT[]: ['full_game', '1H', '2H']
    m.selection_shape,       -- 'over_under' | 'binary' | 'spread' | 'custom'
    m.active
FROM markets m
WHERE m.active = true;
```

**Usage in Smart Form (cascading filter):**

```typescript
const { data: markets } = await supabase
  .from('market_taxonomy_v2')
  .select('*')
  .eq('sport_key', selectedSport)
  .contains('allowed_segments', [selectedSegment]);
```

---

## 3. Write Surface (RPC)

Smart Form writes ONLY through the `atomic_submit_ticket_v2` RPC.

### 3.1 atomic_submit_ticket_v2

Replaces: `atomic_submit_ticket` (V1)

```sql
CREATE OR REPLACE FUNCTION atomic_submit_ticket_v2(
    p_ticket_id UUID,
    p_bet_slip_id TEXT,
    p_user_id UUID,
    p_sportsbook TEXT,
    p_stake_units NUMERIC,
    p_stake_amount NUMERIC,
    p_potential_payout NUMERIC,
    p_ticket_type TEXT,           -- 'straight' | 'parlay'
    p_parlay_odds INTEGER,        -- NULL for straight bets
    p_legs JSONB                  -- Array of leg objects
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_record RECORD;
    v_leg JSONB;
    v_leg_id UUID;
BEGIN
    -- Idempotency check
    SELECT id INTO v_ticket_record
    FROM tickets
    WHERE bet_slip_id = p_bet_slip_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'ticket_id', v_ticket_record.id
        );
    END IF;

    -- Insert ticket
    INSERT INTO tickets (
        id, bet_slip_id, user_id, sportsbook, stake_units, stake_amount,
        potential_payout, ticket_type, parlay_odds, submitted_at
    ) VALUES (
        p_ticket_id, p_bet_slip_id, p_user_id, p_sportsbook, p_stake_units,
        p_stake_amount, p_potential_payout, p_ticket_type, p_parlay_odds, NOW()
    );

    -- Insert legs with provider snapshot + override pattern
    FOR v_leg IN SELECT * FROM jsonb_array_elements(p_legs)
    LOOP
        v_leg_id := gen_random_uuid();

        INSERT INTO ticket_legs (
            id,
            ticket_id,
            event_id,
            event_segment_id,
            market_id,
            participant_id,
            -- Provider snapshot fields
            provider_line,
            provider_odds,
            provider_participant_name,
            provider_event_description,
            -- Override fields (NULL = use provider value)
            override_line,
            override_odds,
            override_participant_name,
            -- Effective values (computed)
            effective_line,
            effective_odds,
            effective_participant_name,
            -- Selection
            selection,
            leg_status
        ) VALUES (
            v_leg_id,
            p_ticket_id,
            (v_leg->>'event_id')::UUID,
            (v_leg->>'event_segment_id')::UUID,
            (v_leg->>'market_id')::UUID,
            (v_leg->>'participant_id')::UUID,
            -- Provider snapshot
            (v_leg->>'provider_line')::NUMERIC,
            (v_leg->>'provider_odds')::INTEGER,
            v_leg->>'provider_participant_name',
            v_leg->>'provider_event_description',
            -- Overrides
            (v_leg->>'override_line')::NUMERIC,
            (v_leg->>'override_odds')::INTEGER,
            v_leg->>'override_participant_name',
            -- Effective (COALESCE: override wins)
            COALESCE((v_leg->>'override_line')::NUMERIC, (v_leg->>'provider_line')::NUMERIC),
            COALESCE((v_leg->>'override_odds')::INTEGER, (v_leg->>'provider_odds')::INTEGER),
            COALESCE(v_leg->>'override_participant_name', v_leg->>'provider_participant_name'),
            -- Selection
            v_leg->>'selection',
            'pending'
        );
    END LOOP;

    -- Insert to bridge_outbox for downstream processing
    INSERT INTO bridge_outbox (
        id, ticket_id, event_type, payload, created_at, processed
    ) VALUES (
        gen_random_uuid(),
        p_ticket_id,
        'ticket_submitted',
        jsonb_build_object('ticket_id', p_ticket_id, 'bet_slip_id', p_bet_slip_id),
        NOW(),
        false
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'ticket_id', p_ticket_id
    );
END;
$$;
```

### 3.2 Leg Payload Schema

```typescript
interface LegPayload {
  // References (foreign keys)
  event_id: string; // UUID
  event_segment_id: string; // UUID
  market_id: string; // UUID
  participant_id?: string; // UUID (required if market.requires_participant)

  // Provider snapshot (from sportsbook/feed)
  provider_line?: number; // e.g., 24.5
  provider_odds: number; // American odds e.g., -110
  provider_participant_name?: string;
  provider_event_description?: string;

  // Overrides (manual corrections)
  override_line?: number;
  override_odds?: number;
  override_participant_name?: string;

  // Selection
  selection: 'over' | 'under' | 'home' | 'away' | 'yes' | 'no' | string;
}
```

---

## 4. Smart Form Integration Points

### 4.1 Cascading Filter Flow

```
Sport → Event → Segment → Market → Participant (if required) → Line/Odds
```

```typescript
// 1. Select sport
const sports = await supabase.from('catalog_sports_v2').select('*');

// 2. Load events for sport
const events = await supabase
  .from('catalog_events_v2')
  .select('*')
  .eq('sport_key', selectedSport)
  .gte('scheduled_start', new Date().toISOString());

// 3. Load segments for event
const segments = await supabase
  .from('catalog_segments_v2')
  .select('*')
  .eq('event_id', selectedEvent);

// 4. Load markets filtered by segment
const markets = await supabase
  .from('market_taxonomy_v2')
  .select('*')
  .eq('sport_key', selectedSport)
  .contains('allowed_segments', [selectedSegment]);

// 5. If market requires participant, load eligible participants
if (selectedMarket.requires_participant) {
  const participants = await supabase
    .from('catalog_participants_v2')
    .select('*')
    .eq('sport_key', selectedSport)
    .in('team_id', [homeTeamId, awayTeamId]);
}
```

### 4.2 Submission Flow

```typescript
const payload: V2SubmitPayload = {
  ticket_id: crypto.randomUUID(),
  bet_slip_id: generateBetSlipId(),
  user_id: session.user.id,
  sportsbook: 'DraftKings',
  stake_units: 1,
  stake_amount: 25.0,
  potential_payout: 47.73,
  ticket_type: 'straight',
  parlay_odds: null,
  legs: [
    {
      event_id: selectedEvent.id,
      event_segment_id: selectedSegment.id,
      market_id: selectedMarket.id,
      participant_id: selectedPlayer?.id,
      provider_line: 24.5,
      provider_odds: -110,
      provider_participant_name: 'LeBron James',
      provider_event_description: 'Lakers vs Celtics',
      selection: 'over',
    },
  ],
};

const { data, error } = await supabase.rpc('atomic_submit_ticket_v2', payload);
```

---

## 5. Backward Compatibility

### 5.1 Dual-Write Bridge (Migration Period)

During migration, `atomic_submit_ticket_v2` also writes to `unified_picks` for
agents still reading from legacy table.

```sql
-- Inside atomic_submit_ticket_v2, after ticket_legs insert:
INSERT INTO unified_picks (
    id, user_id, player_name, team, opponent, line, pick, odds,
    market, sport, bet_status, pick_source, created_at
)
SELECT
    tl.id,
    t.user_id,
    tl.effective_participant_name,
    -- ... map to legacy columns
FROM ticket_legs tl
JOIN tickets t ON t.id = tl.ticket_id
WHERE tl.ticket_id = p_ticket_id;
```

### 5.2 Legacy View Compatibility

```sql
-- Provides unified_picks shape from new tables
CREATE VIEW unified_picks_compat AS
SELECT
    tl.id,
    t.user_id,
    p.name AS player_name,
    -- ... map all legacy columns
FROM ticket_legs tl
JOIN tickets t ON t.id = tl.ticket_id
LEFT JOIN participants p ON p.id = tl.participant_id
-- ...
```

---

## 6. Validation Rules

### 6.1 Client-Side (Smart Form)

| Rule                    | Validation                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| Event required          | `event_id IS NOT NULL`                                                      |
| Segment required        | `event_segment_id IS NOT NULL`                                              |
| Market required         | `market_id IS NOT NULL`                                                     |
| Participant if required | `IF market.requires_participant THEN participant_id IS NOT NULL`            |
| Line if required        | `IF market.requires_line THEN (provider_line OR override_line) IS NOT NULL` |
| Odds required           | `provider_odds IS NOT NULL`                                                 |
| Selection required      | `selection IS NOT NULL`                                                     |
| Units required          | `stake_units > 0`                                                           |

### 6.2 Server-Side (RPC)

All client validations enforced plus:

| Rule                        | Validation                               |
| --------------------------- | ---------------------------------------- |
| Idempotency                 | `bet_slip_id` unique check               |
| Event exists                | `event_id` FK constraint                 |
| Segment belongs to event    | `event_segment_id` FK + event match      |
| Market valid for sport      | `market_id` FK + sport match             |
| Participant valid for event | `participant_id` in event's participants |

---

## 7. Error Codes

| Code                  | Meaning                                         |
| --------------------- | ----------------------------------------------- |
| `DUPLICATE_BET_SLIP`  | Idempotent submission (success, no new record)  |
| `INVALID_EVENT`       | Event not found or not active                   |
| `INVALID_SEGMENT`     | Segment not found or doesn't belong to event    |
| `INVALID_MARKET`      | Market not found or not valid for sport/segment |
| `INVALID_PARTICIPANT` | Participant not found or not in event           |
| `MISSING_LINE`        | Line required but not provided                  |
| `MISSING_PARTICIPANT` | Participant required but not provided           |
| `INVALID_SELECTION`   | Selection not valid for market shape            |

---

## 8. Migration Path

1. **Phase 1**: Deploy V2 tables alongside existing schema
2. **Phase 2**: Deploy `atomic_submit_ticket_v2` with dual-write
3. **Phase 3**: Migrate Smart Form to V2 contract views and RPC
4. **Phase 4**: Migrate agents to read from V2 tables
5. **Phase 5**: Remove dual-write, deprecate V1 RPC
6. **Phase 6**: Drop legacy tables after verification period

See: `docs/migrations/CANONICAL_SCHEMA_MIGRATION_PLAN.md`

---

## Appendix A: Table Mappings

| V1 (unified_picks) | V2 Location                                       |
| ------------------ | ------------------------------------------------- |
| player_name        | ticket_legs.effective_participant_name            |
| team               | participants (via event.home/away_participant_id) |
| opponent           | participants (via event.home/away_participant_id) |
| line               | ticket_legs.effective_line                        |
| pick               | ticket_legs.selection                             |
| odds               | ticket_legs.effective_odds                        |
| market             | markets.market_key                                |
| sport              | events.sport_key                                  |
| game_segment       | event_segments.segment_key                        |
| prop_snapshot      | (provider\_\* fields in ticket_legs)              |
| closing_line       | ticket_legs.closing_line (settlement time)        |
| bet_status         | ticket_legs.leg_status                            |
| settlement_status  | ticket_legs.settlement_status                     |

---

**Contract Owner**: Smart Form Team **Last Updated**: 2026-02-20 **Status**:
DRAFT

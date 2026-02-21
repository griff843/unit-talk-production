# Canonical Schema V2 Architecture

> **Version**: 2.0.0 **Status**: DRAFT - Pending Canonical Schema Decision
> **Source**:
> `out/audits/CANONICAL_SCHEMA_DECISION/2026-02-20/CANONICAL_SCHEMA_AUDIT.md`

---

## 1. Executive Summary

Canonical Schema V2 replaces the monolithic `unified_picks` table with a
normalized, sport-agnostic data model. This architecture supports:

- **Any sport**: NBA, NFL, MLB, NHL, UFC, Boxing, Tennis, Golf, Soccer, F1,
  NASCAR, and future additions
- **Any market**: Player props, game bets, futures, exotics
- **Any segment**: Full game, halves, quarters, periods, sets, rounds, innings
- **Provider snapshot + override pattern**: Preserves feed data while allowing
  manual corrections
- **Time-bounded roster tracking**: Player-team relationships with history

---

## 2. Design Principles

### 2.1 Polymorphic Participants

Instead of separate `teams` and `players` tables, we use a single `participants`
table with a `participant_type` discriminator:

```
participant_type: 'team' | 'player' | 'fighter' | 'driver' | 'golfer'
```

This enables:

- Single lookup for any bet participant
- Unified external ID mapping
- Consistent API across all sports

### 2.2 Time-Bounded Memberships

Player-team relationships are stored in `participant_memberships` with
`active_from` and `active_to` timestamps:

```sql
-- Current roster query
SELECT * FROM participant_memberships
WHERE team_id = $1 AND active_to IS NULL;

-- Historical roster (e.g., "Who was on Lakers on 2025-03-15?")
SELECT * FROM participant_memberships
WHERE team_id = $1
  AND active_from <= '2025-03-15'
  AND (active_to IS NULL OR active_to > '2025-03-15');
```

### 2.3 Event Segments

Games/matches/fights are broken into segments representing betting periods:

| Sport   | Segments                                                |
| ------- | ------------------------------------------------------- |
| NFL/NBA | full_game, 1H, 2H, 1Q, 2Q, 3Q, 4Q                       |
| NHL     | full_game, 1P, 2P, 3P                                   |
| MLB     | full_game, first_5_innings                              |
| Soccer  | full_game, 1H, 2H                                       |
| Tennis  | full_match, set_1, set_2, set_3, set_4, set_5           |
| UFC     | full_fight, round_1, round_2, round_3, round_4, round_5 |
| Boxing  | full_fight, round_1...round_12                          |
| Golf    | tournament, round_1, round_2, round_3, round_4          |

### 2.4 Provider Snapshot + Override

Every `ticket_leg` captures both the original provider data and any manual
overrides:

```
provider_line:     24.5     <- What the sportsbook showed
override_line:     25.5     <- Manual correction (optional)
effective_line:    25.5     <- COALESCE(override, provider)
```

This pattern:

- Preserves audit trail
- Allows manual entry for markets not in feed
- Supports CLV (Closing Line Value) analysis with original data

---

## 3. Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────────────┐
│   participants  │       │ participant_memberships │
├─────────────────┤       ├─────────────────────────┤
│ id (PK)         │──┐    │ id (PK)                 │
│ participant_type│  │    │ participant_id (FK)─────┼──┐
│ name            │  │    │ team_id (FK)────────────┼──┤
│ sport_key       │  │    │ active_from             │  │
│ external_ids    │  │    │ active_to               │  │
│ active          │  │    │ jersey_number           │  │
└─────────────────┘  │    │ position                │  │
                     │    └─────────────────────────┘  │
                     │                                 │
                     ▼                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     events      │     │  event_segments │     │     markets     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ event_id (FK)   │     │ id (PK)         │
│ sport_key       │     │ id (PK)         │     │ sport_key       │
│ event_type      │     │ segment_key     │     │ market_key      │
│ home_part_id(FK)│     │ segment_number  │     │ display_name    │
│ away_part_id(FK)│     │ display_name    │     │ bet_type        │
│ scheduled_start │     │ status          │     │ requires_part   │
│ status          │     └─────────────────┘     │ requires_line   │
│ external_ids    │                             │ allowed_segments│
└─────────────────┘                             │ selection_shape │
        │                                       └─────────────────┘
        │                                               │
        │         ┌─────────────────┐                   │
        │         │     tickets     │                   │
        │         ├─────────────────┤                   │
        │         │ id (PK)         │                   │
        │         │ bet_slip_id (U) │                   │
        │         │ user_id         │                   │
        │         │ sportsbook      │                   │
        │         │ stake_units     │                   │
        │         │ ticket_type     │                   │
        │         │ parlay_odds     │                   │
        │         │ submitted_at    │                   │
        │         └────────┬────────┘                   │
        │                  │                            │
        │                  ▼                            │
        │         ┌─────────────────────────────────────┴──┐
        │         │              ticket_legs               │
        │         ├────────────────────────────────────────┤
        └────────►│ id (PK)                                │
                  │ ticket_id (FK)                         │
                  │ event_id (FK)                          │
                  │ event_segment_id (FK)                  │
                  │ market_id (FK)                         │
                  │ participant_id (FK) [nullable]         │
                  │ ─────────────────────────────────────  │
                  │ provider_line                          │
                  │ provider_odds                          │
                  │ provider_participant_name              │
                  │ provider_event_description             │
                  │ ─────────────────────────────────────  │
                  │ override_line                          │
                  │ override_odds                          │
                  │ override_participant_name              │
                  │ ─────────────────────────────────────  │
                  │ effective_line (computed)              │
                  │ effective_odds (computed)              │
                  │ effective_participant_name (computed)  │
                  │ ─────────────────────────────────────  │
                  │ selection                              │
                  │ leg_status                             │
                  │ settlement_status                      │
                  │ closing_line                           │
                  │ actual_result                          │
                  └────────────────────────────────────────┘
```

---

## 4. Table Definitions

### 4.1 participants

```sql
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_type TEXT NOT NULL,  -- 'team' | 'player' | 'fighter' | 'driver' | 'golfer'
    name TEXT NOT NULL,
    sport_key TEXT NOT NULL,         -- 'NBA' | 'NFL' | 'MLB' | etc.
    external_ids JSONB DEFAULT '{}', -- {"sportradar": "...", "espn": "...", "odds_api": "..."}
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',     -- Sport-specific: {"conference": "Western", "division": "Pacific"}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_participant_type CHECK (
        participant_type IN ('team', 'player', 'fighter', 'driver', 'golfer')
    )
);

CREATE INDEX idx_participants_sport ON participants(sport_key);
CREATE INDEX idx_participants_type ON participants(participant_type);
CREATE INDEX idx_participants_external ON participants USING GIN(external_ids);
```

### 4.2 participant_memberships

```sql
CREATE TABLE participant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id),
    team_id UUID NOT NULL REFERENCES participants(id),
    active_from DATE NOT NULL DEFAULT CURRENT_DATE,
    active_to DATE,  -- NULL = current membership
    jersey_number TEXT,
    position TEXT,
    role TEXT,  -- 'starter' | 'reserve' | 'injured_reserve' | etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT membership_dates_valid CHECK (active_to IS NULL OR active_to > active_from),
    CONSTRAINT no_overlapping_memberships EXCLUDE USING gist (
        participant_id WITH =,
        team_id WITH =,
        daterange(active_from, active_to, '[]') WITH &&
    )
);

CREATE INDEX idx_memberships_participant ON participant_memberships(participant_id);
CREATE INDEX idx_memberships_team ON participant_memberships(team_id);
CREATE INDEX idx_memberships_active ON participant_memberships(team_id) WHERE active_to IS NULL;
```

### 4.3 events

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_key TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- 'game' | 'match' | 'fight' | 'tournament' | 'race'
    home_participant_id UUID REFERENCES participants(id),
    away_participant_id UUID REFERENCES participants(id),
    scheduled_start TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed'
    venue TEXT,
    external_ids JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',  -- {"broadcast": "ESPN", "weather": {...}}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_event_type CHECK (
        event_type IN ('game', 'match', 'fight', 'tournament', 'tournament_round', 'race')
    ),
    CONSTRAINT valid_event_status CHECK (
        status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed', 'delayed')
    )
);

CREATE INDEX idx_events_sport ON events(sport_key);
CREATE INDEX idx_events_start ON events(scheduled_start);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_external ON events USING GIN(external_ids);
```

### 4.4 event_segments

```sql
CREATE TABLE event_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    segment_key TEXT NOT NULL,  -- 'full_game' | '1H' | '2H' | '1Q' | 'round_1' | 'set_1' | etc.
    segment_number INTEGER,      -- NULL for full_game, 1 for 1H/1Q/1P, etc.
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_segment_per_event UNIQUE (event_id, segment_key),
    CONSTRAINT valid_segment_status CHECK (
        status IN ('scheduled', 'in_progress', 'completed')
    )
);

CREATE INDEX idx_segments_event ON event_segments(event_id);
CREATE INDEX idx_segments_key ON event_segments(segment_key);
```

### 4.5 markets

```sql
CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_key TEXT NOT NULL,
    market_key TEXT NOT NULL,      -- 'PTS' | 'REB' | 'MONEYLINE' | 'SPREAD' | etc.
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,        -- 'scoring' | 'rebounds' | 'passing' | 'game' | etc.
    bet_type TEXT NOT NULL,        -- 'player_prop' | 'game' | 'futures'
    requires_participant BOOLEAN NOT NULL DEFAULT false,
    requires_line BOOLEAN NOT NULL DEFAULT false,
    allowed_segments TEXT[] NOT NULL DEFAULT ARRAY['full_game'],
    selection_shape TEXT NOT NULL DEFAULT 'over_under',  -- 'over_under' | 'binary' | 'spread' | 'custom'
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_market_per_sport UNIQUE (sport_key, market_key),
    CONSTRAINT valid_bet_type CHECK (
        bet_type IN ('player_prop', 'game', 'futures')
    ),
    CONSTRAINT valid_selection_shape CHECK (
        selection_shape IN ('over_under', 'binary', 'spread', 'custom')
    )
);

CREATE INDEX idx_markets_sport ON markets(sport_key);
CREATE INDEX idx_markets_key ON markets(market_key);
CREATE INDEX idx_markets_type ON markets(bet_type);
```

### 4.6 tickets

```sql
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_slip_id TEXT UNIQUE NOT NULL,  -- Idempotency key
    user_id UUID NOT NULL,
    sportsbook TEXT NOT NULL,
    stake_units NUMERIC NOT NULL,
    stake_amount NUMERIC,
    potential_payout NUMERIC,
    ticket_type TEXT NOT NULL DEFAULT 'straight',  -- 'straight' | 'parlay' | 'teaser' | 'round_robin'
    parlay_odds INTEGER,  -- Combined odds for parlays
    ticket_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'won' | 'lost' | 'push' | 'void'
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    discord_message_id TEXT,
    discord_channel_id TEXT,
    posted_to_discord BOOLEAN DEFAULT false,
    promotion_status TEXT DEFAULT 'pending',
    tier TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_ticket_type CHECK (
        ticket_type IN ('straight', 'parlay', 'teaser', 'round_robin')
    ),
    CONSTRAINT valid_ticket_status CHECK (
        ticket_status IN ('pending', 'won', 'lost', 'push', 'void', 'partial')
    )
);

CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(ticket_status);
CREATE INDEX idx_tickets_submitted ON tickets(submitted_at);
CREATE INDEX idx_tickets_betslip ON tickets(bet_slip_id);
```

### 4.7 ticket_legs

```sql
CREATE TABLE ticket_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id),
    event_segment_id UUID NOT NULL REFERENCES event_segments(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    participant_id UUID REFERENCES participants(id),  -- NULL for game bets

    -- Provider snapshot (original data from feed/sportsbook)
    provider_line NUMERIC,
    provider_odds INTEGER NOT NULL,
    provider_participant_name TEXT,
    provider_event_description TEXT,
    provider_snapshot_at TIMESTAMPTZ DEFAULT NOW(),

    -- Override fields (manual corrections, NULL = use provider value)
    override_line NUMERIC,
    override_odds INTEGER,
    override_participant_name TEXT,
    override_reason TEXT,

    -- Effective values (computed: COALESCE(override, provider))
    effective_line NUMERIC GENERATED ALWAYS AS (COALESCE(override_line, provider_line)) STORED,
    effective_odds INTEGER GENERATED ALWAYS AS (COALESCE(override_odds, provider_odds)) STORED,
    effective_participant_name TEXT GENERATED ALWAYS AS (COALESCE(override_participant_name, provider_participant_name)) STORED,

    -- Selection
    selection TEXT NOT NULL,  -- 'over' | 'under' | 'home' | 'away' | 'yes' | 'no' | etc.

    -- Settlement
    leg_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'won' | 'lost' | 'push' | 'void'
    settlement_status TEXT DEFAULT 'pending',    -- 'pending' | 'graded' | 'settled' | 'manual'
    closing_line NUMERIC,
    actual_result NUMERIC,
    settled_at TIMESTAMPTZ,
    settlement_source TEXT,  -- 'auto' | 'manual' | 'api'

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_leg_status CHECK (
        leg_status IN ('pending', 'won', 'lost', 'push', 'void')
    ),
    CONSTRAINT valid_settlement_status CHECK (
        settlement_status IN ('pending', 'graded', 'settled', 'manual')
    )
);

CREATE INDEX idx_legs_ticket ON ticket_legs(ticket_id);
CREATE INDEX idx_legs_event ON ticket_legs(event_id);
CREATE INDEX idx_legs_participant ON ticket_legs(participant_id);
CREATE INDEX idx_legs_status ON ticket_legs(leg_status);
CREATE INDEX idx_legs_settlement ON ticket_legs(settlement_status);
```

---

## 5. Contract Views

Views provide a stable API for applications, insulating them from schema
changes.

### 5.1 Read Views

```sql
-- Unified participant catalog
CREATE VIEW catalog_participants_v2 AS
SELECT
    p.id,
    p.participant_type,
    p.name,
    p.sport_key,
    p.external_ids,
    p.active,
    pm.team_id AS current_team_id,
    t.name AS current_team_name,
    pm.jersey_number,
    pm.position
FROM participants p
LEFT JOIN participant_memberships pm
    ON pm.participant_id = p.id AND pm.active_to IS NULL
LEFT JOIN participants t
    ON t.id = pm.team_id;

-- Active events catalog
CREATE VIEW catalog_events_v2 AS
SELECT
    e.id,
    e.sport_key,
    e.event_type,
    e.home_participant_id,
    hp.name AS home_name,
    e.away_participant_id,
    ap.name AS away_name,
    e.scheduled_start,
    e.status,
    e.venue,
    e.external_ids
FROM events e
LEFT JOIN participants hp ON hp.id = e.home_participant_id
LEFT JOIN participants ap ON ap.id = e.away_participant_id;

-- Segments catalog
CREATE VIEW catalog_segments_v2 AS
SELECT
    es.id,
    es.event_id,
    es.segment_key,
    es.segment_number,
    es.display_name,
    es.status,
    e.sport_key
FROM event_segments es
JOIN events e ON e.id = es.event_id;

-- Market taxonomy
CREATE VIEW market_taxonomy_v2 AS
SELECT
    id,
    sport_key,
    market_key,
    display_name,
    category,
    bet_type,
    requires_participant,
    requires_line,
    allowed_segments,
    selection_shape,
    active
FROM markets
WHERE active = true;

-- Full ticket view (for agents)
CREATE VIEW tickets_full_v2 AS
SELECT
    t.id AS ticket_id,
    t.bet_slip_id,
    t.user_id,
    t.sportsbook,
    t.stake_units,
    t.stake_amount,
    t.ticket_type,
    t.parlay_odds,
    t.ticket_status,
    t.posted_to_discord,
    t.discord_message_id,
    t.promotion_status,
    t.tier,
    t.submitted_at,
    tl.id AS leg_id,
    tl.event_id,
    tl.event_segment_id,
    tl.market_id,
    tl.participant_id,
    tl.effective_line,
    tl.effective_odds,
    tl.effective_participant_name,
    tl.selection,
    tl.leg_status,
    tl.closing_line,
    tl.actual_result,
    e.sport_key,
    e.scheduled_start AS event_start,
    hp.name AS home_team,
    ap.name AS away_team,
    es.segment_key,
    m.market_key,
    m.display_name AS market_name
FROM tickets t
JOIN ticket_legs tl ON tl.ticket_id = t.id
JOIN events e ON e.id = tl.event_id
LEFT JOIN participants hp ON hp.id = e.home_participant_id
LEFT JOIN participants ap ON ap.id = e.away_participant_id
JOIN event_segments es ON es.id = tl.event_segment_id
JOIN markets m ON m.id = tl.market_id;
```

### 5.2 Compatibility View (Migration Period)

```sql
-- Provides unified_picks shape from V2 tables
CREATE VIEW unified_picks_compat AS
SELECT
    tl.id,
    t.user_id,
    tl.effective_participant_name AS player_name,
    CASE
        WHEN e.home_participant_id = tl.participant_id THEN hp.name
        ELSE ap.name
    END AS team,
    CASE
        WHEN e.home_participant_id = tl.participant_id THEN ap.name
        ELSE hp.name
    END AS opponent,
    tl.effective_line AS line,
    tl.selection AS pick,
    tl.effective_odds AS odds,
    m.market_key AS market,
    e.sport_key AS sport,
    es.segment_key AS game_segment,
    tl.leg_status AS bet_status,
    t.sportsbook,
    t.stake_units AS units,
    e.scheduled_start AS game_time,
    t.submitted_at AS created_at,
    t.posted_to_discord,
    t.discord_message_id,
    t.discord_channel_id,
    t.promotion_status,
    t.tier,
    tl.settlement_status,
    tl.closing_line,
    tl.actual_result,
    tl.settled_at,
    t.ticket_type,
    CASE WHEN t.ticket_type = 'parlay' THEN t.id ELSE NULL END AS parlay_id
FROM ticket_legs tl
JOIN tickets t ON t.id = tl.ticket_id
JOIN events e ON e.id = tl.event_id
LEFT JOIN participants hp ON hp.id = e.home_participant_id
LEFT JOIN participants ap ON ap.id = e.away_participant_id
JOIN event_segments es ON es.id = tl.event_segment_id
JOIN markets m ON m.id = tl.market_id;
```

---

## 6. Write Surface

### 6.1 RPCs

| RPC                          | Purpose                     | Writer            |
| ---------------------------- | --------------------------- | ----------------- |
| `atomic_submit_ticket_v2`    | Submit new ticket with legs | Smart Form        |
| `lifecycle_update_ticket_v2` | Update ticket fields        | Lifecycle Adapter |
| `settle_ticket_leg_v2`       | Settle individual leg       | SettlementAgent   |
| `batch_settle_ticket_v2`     | Settle entire ticket        | SettlementAgent   |

### 6.2 Lifecycle Adapter Integration

```typescript
// apps/api/src/lib/lifecycle/write-adapter-v2.ts

export async function lifecycleInsertV2(
  supabase: SupabaseClient,
  ticket: TicketInsert,
  legs: LegInsert[],
  options: { writerRole: WriterRole }
): Promise<InsertResult> {
  // Calls atomic_submit_ticket_v2 RPC
}

export async function lifecycleUpdateV2(
  supabase: SupabaseClient,
  ticketId: string,
  updates: TicketUpdate,
  options: { writerRole: WriterRole }
): Promise<UpdateResult> {
  // Enforces single-writer discipline
}

export async function lifecycleSettleV2(
  supabase: SupabaseClient,
  legId: string,
  settlement: SettlementData,
  options: { writerRole: WriterRole }
): Promise<SettleResult> {
  // Settles individual leg, updates ticket status
}
```

---

## 7. Agent Integration Points

### 7.1 BridgeWorker

```
Read: bridge_outbox (event: 'ticket_submitted')
Write: unified_picks (via dual-write during migration)
       tickets.promotion_status = 'ingested'
```

### 7.2 GradingAgent

```
Read: tickets_full_v2 (pending legs)
       raw_props (box scores)
Write: ticket_legs.promotion_status
       ticket_legs.tier
```

### 7.3 DiscordPromotionAgent

```
Read: tickets_full_v2 (promotion_status = 'approved')
Write: tickets.discord_message_id
       tickets.discord_channel_id
       tickets.posted_to_discord
```

### 7.4 SettlementAgent

```
Read: tickets_full_v2 (pending settlement)
       scored_props (results)
Write: ticket_legs.leg_status
       ticket_legs.settlement_status
       ticket_legs.actual_result
       ticket_legs.closing_line
       tickets.ticket_status
```

### 7.5 RecapAgent

```
Read: tickets_full_v2 (settled today)
Write: (none - read-only for recaps)
```

---

## 8. Seed Data

See: `out/audits/CANONICAL_SCHEMA_DECISION/2026-02-20/seed_pack/`

- `sports.json`: 14 sports with segment models
- `segments.json`: Segment types per sport
- `markets.json`: Baseline markets by sport (85+ markets)

---

## 9. Performance Considerations

### 9.1 Indexes

Key indexes for cascading filter performance (<200ms target):

```sql
-- Participant lookups
CREATE INDEX idx_participants_sport_type ON participants(sport_key, participant_type);
CREATE INDEX idx_memberships_active_team ON participant_memberships(team_id) WHERE active_to IS NULL;

-- Event lookups
CREATE INDEX idx_events_sport_status_start ON events(sport_key, status, scheduled_start);

-- Segment lookups
CREATE INDEX idx_segments_event_status ON event_segments(event_id, status);

-- Market lookups
CREATE INDEX idx_markets_sport_active ON markets(sport_key) WHERE active = true;

-- Ticket lookups
CREATE INDEX idx_tickets_user_status ON tickets(user_id, ticket_status);
CREATE INDEX idx_legs_pending ON ticket_legs(leg_status) WHERE leg_status = 'pending';
```

### 9.2 Query Patterns

Cascading filter expected query pattern:

```sql
-- Step 1: Sport selection (instant, small table)
SELECT * FROM catalog_sports_v2;

-- Step 2: Events for sport (indexed, should be <50ms)
SELECT * FROM catalog_events_v2
WHERE sport_key = 'NBA' AND status = 'scheduled';

-- Step 3: Segments for event (indexed, should be <10ms)
SELECT * FROM catalog_segments_v2
WHERE event_id = $1;

-- Step 4: Markets for sport+segment (indexed, should be <20ms)
SELECT * FROM market_taxonomy_v2
WHERE sport_key = 'NBA' AND 'full_game' = ANY(allowed_segments);

-- Step 5: Participants for event (indexed, should be <30ms)
SELECT * FROM catalog_participants_v2
WHERE sport_key = 'NBA' AND current_team_id IN ($home_id, $away_id);
```

---

## 10. Migration Impact

See: `docs/migrations/CANONICAL_SCHEMA_MIGRATION_PLAN.md`

**Files requiring updates:**

| Component           | File Count | Impact                            |
| ------------------- | ---------- | --------------------------------- |
| apps/api            | 130+ files | High - lifecycle adapters, agents |
| apps/smart-form     | 23 files   | High - new RPC, views             |
| apps/command-center | 20 files   | Medium - read-only, view changes  |
| apps/discord-bot    | 5 files    | Low - minimal changes             |

---

## Appendix A: Comparison with V1 (unified_picks)

| Aspect           | V1 (unified_picks)   | V2 (normalized)           |
| ---------------- | -------------------- | ------------------------- |
| Tables           | 1 monolithic         | 7 normalized              |
| Columns          | 40+                  | Distributed across tables |
| Sports           | Hardcoded            | Seed data driven          |
| Segments         | String field         | First-class entity        |
| Participants     | Denormalized         | Polymorphic + memberships |
| Provider data    | Mixed with user data | Separate snapshot fields  |
| Flexibility      | Low                  | High                      |
| Query complexity | Simple               | JOINs required            |
| Maintenance      | Difficult            | Easier                    |

---

**Architecture Owner**: Engineering Team **Last Updated**: 2026-02-20
**Status**: DRAFT

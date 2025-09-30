-- ==========================================
-- Unit Talk - Test Data Seeder (Plain SQL)
-- Creates a dummy user, raw prop, and pick
-- ==========================================

-- 1. Ensure Dummy User Exists
INSERT INTO users (
    discord_id,
    username,
    email,
    created_at,
    updated_at
) VALUES (
    'dummy-discord-123',
    'testuser',
    'test@example.com',
    now(),
    now()
)
ON CONFLICT (discord_id) DO UPDATE
SET username = EXCLUDED.username;

-- 2. Ensure Dummy Raw Prop Exists
INSERT INTO raw_props (
    player_name,
    sport,
    team,
    stat_type,
    line,
    odds,
    matchup,
    created_at,
    source
) VALUES (
    'LeBron James',
    'NBA',
    'Lakers',
    'PTS',
    26.5,
    -110,
    'Lakers vs Celtics',
    now(),
    'test-seed'
)
ON CONFLICT DO NOTHING;

-- 3. Insert Dummy Unified Pick (linked to above user + prop)
INSERT INTO unified_picks (
    user_id, prop_id, game_id,
    pick_type, status, selection, line, odds,
    stake, potential_payout, confidence,
    tier_when_placed, pick_source, workflow_stage, promotion_status,
    placed_at, posted_at, professional_score, kelly_fraction,
    devigged_edge, clv_tracking_id, promoted_at
) VALUES (
    (SELECT id FROM users WHERE discord_id = 'dummy-discord-123' LIMIT 1),
    (SELECT id FROM raw_props WHERE player_name = 'LeBron James' AND stat_type = 'PTS' ORDER BY created_at DESC LIMIT 1),
    gen_random_uuid(),
    'single',
    'pending',
    'LeBron James o26.5 PTS',
    26.5,
    -110,
    1.0,
    1.91,
    90,
    'S',
    'system',
    'approved',
    'promoted',
    now(),
    now(),
    75,
    0.05,
    0.12,
    'clv-test-1',
    now()
)
RETURNING id, selection, professional_score, kelly_fraction, devigged_edge, status, posted_at;
